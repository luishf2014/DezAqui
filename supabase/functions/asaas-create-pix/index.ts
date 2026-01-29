/**
 * Edge Function: asaas-create-pix
 *
 * Responsabilidade:
 * - Criar um pagamento PIX no Asaas de forma segura
 * - Validar o usuário autenticado (JWT Supabase)
 * - Garantir que a participação pertence ao usuário
 * - Gerar cobrança PIX e retornar QR Code
 *
 * Segurança:
 * - A chave da API do Asaas nunca vai para o frontend
 * - Autenticação feita via JWT enviado pelo Supabase
 * - Validação de ownership da participação
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Headers CORS
 * Necessários para permitir chamadas do frontend
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

/**
 * Estrutura esperada do payload enviado pelo frontend
 */
interface CreatePixPaymentRequest {
  participationId: string
  ticketCode: string
  amount: number
  description: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  customerCpfCnpj?: string
}

serve(async (req) => {
  /**
   * Resposta para requisições OPTIONS (preflight do CORS)
   */
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    /**
     * Validar presença do token JWT do usuário
     */
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    /**
     * Criar cliente Supabase com ANON KEY
     * Esse cliente é usado apenas para validar o JWT do usuário
     */
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Configuração do Supabase inválida' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    /**
     * Validar usuário autenticado
     */
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    /**
     * Ler e validar payload da requisição
     */
    const body: CreatePixPaymentRequest = await req.json()

    if (
      !body.participationId ||
      !body.ticketCode ||
      !body.amount ||
      body.amount <= 0 ||
      !body.description ||
      !body.customerName
    ) {
      return new Response(
        JSON.stringify({ error: 'Dados inválidos para criação do pagamento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    /**
     * Verificar se a participação pertence ao usuário autenticado
     */
    const { data: participation } = await supabase
      .from('participations')
      .select('id, user_id')
      .eq('id', body.participationId)
      .single()

    if (!participation || participation.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para essa participação' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    /**
     * Ler credenciais do Asaas a partir dos secrets
     */
    const asaasApiKey = Deno.env.get('ASAAS_API_KEY')
    const asaasBaseUrl = Deno.env.get('ASAAS_BASE_URL') || 'https://sandbox.asaas.com/api/v3'

    if (!asaasApiKey) {
      return new Response(
        JSON.stringify({ error: 'Configuração do Asaas não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    /**
     * Criar cobrança PIX no Asaas
     */
    const paymentResponse = await fetch(`${asaasBaseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey,
      },
      body: JSON.stringify({
        billingType: 'PIX',
        value: body.amount,
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        description: body.description,
        externalReference: body.ticketCode,
        name: body.customerName,
        email: body.customerEmail,
        phone: body.customerPhone,
        cpfCnpj: body.customerCpfCnpj,
      }),
    })

    if (!paymentResponse.ok) {
      const err = await paymentResponse.json()
      return new Response(
        JSON.stringify({ error: err?.errors?.[0]?.description || 'Erro ao criar cobrança' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payment = await paymentResponse.json()

    /**
     * Buscar QR Code do pagamento criado
     */
    const qrCodeResponse = await fetch(`${asaasBaseUrl}/payments/${payment.id}/pixQrCode`, {
      headers: { 'access_token': asaasApiKey },
    })

    const qrCode = await qrCodeResponse.json()

    /**
     * Retornar dados para o frontend
     */
    return new Response(
      JSON.stringify({
        id: payment.id,
        status: payment.status,
        dueDate: payment.dueDate,
        qrCode: {
          encodedImage: qrCode.encodedImage,
          payload: qrCode.payload,
          expirationDate: qrCode.expirationDate || payment.dueDate,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[asaas-create-pix] Erro inesperado:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
