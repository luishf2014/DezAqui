/**
 * Edge Function: mercadopago-webhook
 *
 * Responsabilidade:
 * - Receber webhooks do Mercado Pago
 * - (Opcional) Validar token/segredo simples (igual Asaas)
 * - Buscar detalhes do pagamento na API do Mercado Pago (fonte da verdade)
 * - Confirmar pagamento PIX quando status = approved
 * - Atualizar pagamento como "paid"
 * - Ativar participação automaticamente
 *
 * Segurança:
 * - Token simples via header (MERCADOPAGO_WEBHOOK_TOKEN) (opcional, mas recomendado)
 * - Uso de Service Role (bypass RLS)
 * - Idempotência garantida
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, mp-access-token, x-mp-token, authorization',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type MPWebhookBody = {
  type?: string
  action?: string
  data?: { id?: string }
  // alguns envios podem vir com "id" direto
  id?: string
}

async function fetchMpPayment(paymentId: string, accessToken: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    // 🔐 Validação opcional por token do webhook (não Authorization header)
    const webhookToken = Deno.env.get('MERCADOPAGO_WEBHOOK_TOKEN')
    
    // Mercado Pago não envia Authorization header - validar apenas se webhook token estiver configurado
    if (webhookToken) {
      const receivedToken =
        req.headers.get('mp-access-token') ||
        req.headers.get('x-mp-token') ||
        null

      if (receivedToken !== webhookToken) {
        console.warn('[mercadopago-webhook] token inválido')
        return jsonResponse({ error: 'Webhook não autorizado' }, 401)
      }
    }

    // Mercado Pago pode enviar body, mas também pode vir como query em alguns modos (IPN antigo)
    let body: MPWebhookBody = {}
    try {
      body = (await req.json()) as MPWebhookBody
    } catch {
      body = {}
    }

    const url = new URL(req.url)
    const qpId = url.searchParams.get('id') || url.searchParams.get('data.id') || null

    const paymentId = body.data?.id || body.id || qpId

    if (!paymentId) {
      return jsonResponse({ error: 'Webhook inválido: paymentId ausente' }, 400)
    }

    console.log('[mercadopago-webhook] recebido:', {
      type: body.type,
      action: body.action,
      paymentId,
    })

    // 🔑 Token do Mercado Pago (para consultar o pagamento e confirmar status real)
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    if (!mpAccessToken) {
      return jsonResponse({ error: 'MERCADOPAGO_ACCESS_TOKEN não configurado' }, 500)
    }

    // ✅ Confirma status real na API do Mercado Pago
    const mp = await fetchMpPayment(paymentId, mpAccessToken)

    if (!mp.ok) {
      console.error('[mercadopago-webhook] erro ao consultar payment no MP:', mp.status, mp.data)
      // responde 200 pra evitar retry infinito; e você investiga via logs
      return jsonResponse({ message: 'Pagamento não confirmado (consulta MP falhou)' }, 200)
    }

    const mpStatus = mp.data?.status // approved, pending, rejected, cancelled...
    const mpDate =
      mp.data?.date_approved ||
      mp.data?.date_last_updated ||
      new Date().toISOString()

    // ✅ Status válido para considerar pago
    const validStatuses = ['approved']

    if (!validStatuses.includes(mpStatus)) {
      return jsonResponse({ message: 'Evento ignorado (status não aprovado)', status: mpStatus }, 200)
    }

    // Supabase Admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      Deno.env.get('SERVICE_ROLE_KEY') ||
      ''

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Configuração do Supabase inválida' }, 500)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    console.log(`[mercadopago-webhook] 🔒 TENTATIVA DE PROCESSAMENTO: ${paymentId}`)

    // 🔥 LOCK ATÔMICO: Tentar "claim" o pagamento em uma operação atômica
    // Isso garante que apenas UM webhook consegue processar o pagamento
    const { data: claimedPayments, error: claimError } = await supabase
      .from('payments')
      .update({ 
        status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('external_id', paymentId)
      .eq('status', 'pending') // Só atualiza se ainda estiver pending
      .select('id, participation_id, intent_id')

    if (claimError) {
      console.error('[mercadopago-webhook] erro ao fazer claim do pagamento:', claimError)
      return jsonResponse({ error: 'Falha ao processar pagamento' }, 500)
    }

    // Se não conseguiu fazer claim de nenhum payment, significa que já foi processado
    if (!claimedPayments || claimedPayments.length === 0) {
      console.log(`[mercadopago-webhook] ⚠️ PAGAMENTO JÁ PROCESSADO - ${paymentId} (claim falhou)`)
      return jsonResponse({ message: 'Pagamento já foi processado por outro webhook' }, 200)
    }

    const paymentList = claimedPayments
    console.log(`[mercadopago-webhook] ✅ CLAIM SUCCESSFUL - Processando ${paymentList.length} payment(s) para ${paymentId}`)

    const participationIdsToActivate: string[] = []

    for (const payment of paymentList) {
      if (payment.status === 'paid') continue

      let participationId = payment.participation_id

        // 🚀 PROCESSAMENTO ATÔMICO: Só processar se ainda não tem participação
        if (!participationId && payment.intent_id) {
        const { data: intent, error: intentErr } = await supabase
          .from('pix_payment_intents')
          .select('id, user_id, contest_id, selected_numbers, amount')
          .eq('id', payment.intent_id)
          .maybeSingle()

        if (intentErr || !intent) {
          console.error('[mercadopago-webhook] intent não encontrado:', payment.intent_id, intentErr)
          return jsonResponse({ error: 'Intent não encontrado' }, 500)
        }

        // Como já fizemos lock, podemos criar a participação diretamente
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
          let randomPart = ''
          for (let i = 0; i < 6; i++) {
            randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
          }
          const ticketCode = `TK-${randomPart}`

          try {
            const { data: newPart, error: partInsertErr } = await supabase
              .from('participations')
              .insert({
                contest_id: intent.contest_id,
                user_id: intent.user_id,
                numbers: intent.selected_numbers,
                amount: Number(intent.amount),
                status: 'active',
                ticket_code: ticketCode,
              })
              .select('id')
              .single()

            if (partInsertErr || !newPart) {
              console.error('[mercadopago-webhook] erro ao criar participação:', partInsertErr)
              return jsonResponse({ error: 'Erro ao criar participação' }, 500)
            }

            participationId = newPart.id
          } catch (duplicateError) {
            console.log('[mercadopago-webhook] Possível tentativa de criação duplicada, verificando participação existente...')
            
            // Se deu erro, pode ser duplicata. Buscar participação existente
            const { data: existingPart } = await supabase
              .from('participations')
              .select('id')
              .eq('user_id', intent.user_id)
              .eq('contest_id', intent.contest_id)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (existingPart) {
              console.log('[mercadopago-webhook] Usando participação existente:', existingPart.id)
              participationId = existingPart.id
            } else {
              console.error('[mercadopago-webhook] Erro inesperado ao criar participação:', duplicateError)
              return jsonResponse({ error: 'Erro ao processar participação' }, 500)
            }
          }

        await supabase
          .from('pix_payment_intents')
          .update({ status: 'PAID', updated_at: new Date().toISOString() })
          .eq('id', intent.id)
      }

      if (participationId) {
        participationIdsToActivate.push(participationId)
      }

      const { error: payRes } = await supabase
        .from('payments')
        .update({
          status: 'paid',
          paid_at: mpDate,
          participation_id: participationId,
        })
        .eq('id', payment.id)

      if (payRes) {
        console.error('[mercadopago-webhook] erro update payment:', payRes)
        return jsonResponse({ error: 'Erro ao atualizar pagamento' }, 500)
      }
    }

    for (const pid of participationIdsToActivate) {
      await supabase
        .from('participations')
        .update({ status: 'active' })
        .eq('id', pid)
    }

    return jsonResponse({ message: 'Pagamento confirmado com sucesso' }, 200)
  } catch (error) {
    console.error('[mercadopago-webhook] erro inesperado:', error)
    return jsonResponse({ error: 'Erro interno do servidor' }, 500)
  }
})
