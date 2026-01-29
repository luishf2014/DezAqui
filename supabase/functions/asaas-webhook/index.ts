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
 * - Validação de token do webhook
 * - Uso de Service Role (bypass RLS)
 * - Idempotência garantida
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Estrutura flexível do webhook do Asaas
 */
interface AsaasWebhookEvent {
  event?: string
  payment?: {
    id?: string
    status?: string
    paymentDate?: string
    externalReference?: string
  }
  id?: string
  status?: string
  paymentDate?: string
  externalReference?: string
}

serve(async (req) => {
  try {
    /**
     * Validar token de autenticação do webhook
     */
    const webhookToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')
    const receivedToken = req.headers.get('X-Webhook-Token')

    if (!webhookToken || receivedToken !== webhookToken) {
      return new Response(
        JSON.stringify({ error: 'Webhook não autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    /**
     * Ler payload do webhook
     */
    const webhookData: AsaasWebhookEvent = await req.json()

    /**
     * Extrair dados do webhook (formato pode variar)
     * O Asaas pode enviar payment dentro de um objeto ou diretamente no root
     */
    const paymentId = webhookData.payment?.id || webhookData.id
    const paymentStatus = webhookData.payment?.status || webhookData.status
    const paymentDate =
      webhookData.payment?.paymentDate ||
      webhookData.paymentDate ||
      new Date().toISOString()

    /**
     * Validar dados mínimos necessários
     */
    if (!paymentId || !paymentStatus) {
      return new Response(
        JSON.stringify({ error: 'Webhook inválido: dados incompletos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    /**
     * Processar apenas pagamentos confirmados
     */
    if (paymentStatus !== 'CONFIRMED' && paymentStatus !== 'RECEIVED') {
      return new Response(
        JSON.stringify({ message: 'Evento ignorado' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    /**
     * Criar cliente Supabase com Service Role
     * Necessário para atualizar registros ignorando RLS
     */
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Configuração do Supabase inválida' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    /**
     * Buscar pagamento pelo external_id (ID do Asaas)
     */
    const { data: payment } = await supabase
      .from('payments')
      .select('id, participation_id, status')
      .eq('external_id', paymentId)
      .maybeSingle()

    if (!payment) {
      return new Response(
        JSON.stringify({ message: 'Pagamento não encontrado' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    /**
     * Garantir idempotência
     */
    if (payment.status === 'paid') {
      return new Response(
        JSON.stringify({ message: 'Pagamento já processado' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    /**
     * Atualizar pagamento e ativar participação
     */
    await Promise.all([
      supabase
        .from('payments')
        .update({ status: 'paid', paid_at: paymentDate })
        .eq('id', payment.id),

      supabase
        .from('participations')
        .update({ status: 'active' })
        .eq('id', payment.participation_id),
    ])

    return new Response(
      JSON.stringify({ message: 'Pagamento confirmado e participação ativada' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[asaas-webhook] Erro inesperado:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
