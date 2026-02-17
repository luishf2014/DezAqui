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
    // 🔐 (Opcional, mas recomendado) token simples do webhook, igual seu padrão do Asaas
    const webhookToken = Deno.env.get('MERCADOPAGO_WEBHOOK_TOKEN')
    const receivedToken =
      req.headers.get('mp-access-token') ||
      req.headers.get('x-mp-token') ||
      (req.headers.get('authorization')?.replace('Bearer ', '') ?? null)

    if (webhookToken && receivedToken !== webhookToken) {
      console.warn('[mercadopago-webhook] token inválido')
      return jsonResponse({ error: 'Webhook não autorizado' }, 401)
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

    // 🔎 Busca pagamento(s) vinculados a esse paymentId do MP
    const { data: payments, error: payFindErr } = await supabase
      .from('payments')
      .select('id, participation_id, intent_id, status')
      .eq('external_id', paymentId)

    if (payFindErr) {
      console.error('[mercadopago-webhook] erro find payment:', payFindErr)
      return jsonResponse({ error: 'Falha ao buscar pagamento' }, 500)
    }

    const paymentList = payments || []
    if (paymentList.length === 0) {
      console.log('[mercadopago-webhook] pagamento não encontrado:', paymentId)
      return jsonResponse({ message: 'Pagamento não encontrado' }, 200)
    }

    const participationIdsToActivate: string[] = []

    for (const payment of paymentList) {
      if (payment.status === 'paid') continue

      let participationId = payment.participation_id

      // MODIFIQUEI AQUI - Mesmo fluxo do Asaas: se veio por intent, cria a participação
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

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let randomPart = ''
        for (let i = 0; i < 6; i++) {
          randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        const ticketCode = `TK-${randomPart}`

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
