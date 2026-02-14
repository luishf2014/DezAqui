/**
 * Edge Function: asaas-webhook
 *
 * Responsabilidade:
 * - Receber webhooks do Asaas
 * - Validar token de segurança
 * - Confirmar pagamento PIX
 * - Atualizar pagamento como "paid"
 * - Ativar participação automaticamente
 *
 * Segurança:
 * - Validação de token do webhook (ASAAS)
 * - Uso de Service Role (bypass RLS)
 * - Idempotência garantida
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, asaas-access-token, access_token',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface AsaasWebhookEvent {
  event?: string
  payment?: {
    id?: string
    status?: string
    paymentDate?: string
  }
  id?: string
  status?: string
  paymentDate?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    // 🔐 Token do webhook (ASAAS)
    const webhookToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')

    const receivedToken =
      req.headers.get('asaas-access-token') ||
      req.headers.get('access_token')

    if (!webhookToken || receivedToken !== webhookToken) {
      console.warn('[asaas-webhook] token inválido')
      return jsonResponse({ error: 'Webhook não autorizado' }, 401)
    }

    const webhookData: AsaasWebhookEvent = await req.json()

    const paymentId = webhookData.payment?.id || webhookData.id
    const paymentStatus = webhookData.payment?.status || webhookData.status
    const paymentDate =
      webhookData.payment?.paymentDate ||
      webhookData.paymentDate ||
      new Date().toISOString()

    if (!paymentId || !paymentStatus) {
      return jsonResponse({ error: 'Webhook inválido: dados incompletos' }, 400)
    }

    console.log('[asaas-webhook] recebido:', {
      event: webhookData.event,
      paymentId,
      paymentStatus,
    })

    // ✅ Status válidos para confirmar pagamento PIX
    const validStatuses = ['RECEIVED', 'CONFIRMED', 'CREDITED']

    if (!validStatuses.includes(paymentStatus)) {
      return jsonResponse({ message: 'Evento ignorado' }, 200)
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

    const { data: payments, error: payFindErr } = await supabase
      .from('payments')
      .select('id, participation_id, intent_id, status')
      .eq('external_id', paymentId)

    if (payFindErr) {
      console.error('[asaas-webhook] erro find payment:', payFindErr)
      return jsonResponse({ error: 'Falha ao buscar pagamento' }, 500)
    }

    const paymentList = payments || []
    if (paymentList.length === 0) {
      console.log('[asaas-webhook] pagamento não encontrado:', paymentId)
      return jsonResponse({ message: 'Pagamento não encontrado' }, 200)
    }

    const participationIdsToActivate: string[] = []

    for (const payment of paymentList) {
      if (payment.status === 'paid') continue

      let participationId = payment.participation_id

      // Se não tem participação (fluxo Pix com intent - CheckoutPage), criar a partir do intent
      if (!participationId && payment.intent_id) {
        const { data: intent, error: intentErr } = await supabase
          .from('pix_payment_intents')
          .select('id, user_id, contest_id, selected_numbers, amount')
          .eq('id', payment.intent_id)
          .maybeSingle()

        if (intentErr || !intent) {
          console.error('[asaas-webhook] intent não encontrado:', payment.intent_id, intentErr)
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
          console.error('[asaas-webhook] erro ao criar participação:', partInsertErr)
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
          paid_at: paymentDate,
          participation_id: participationId,
        })
        .eq('id', payment.id)

      if (payRes) {
        console.error('[asaas-webhook] erro update payment:', payRes)
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
    console.error('[asaas-webhook] erro inesperado:', error)
    return jsonResponse({ error: 'Erro interno do servidor' }, 500)
  }
})