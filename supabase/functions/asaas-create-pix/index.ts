import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { createAsaasPayment } from './helpers/asaasCreatePayment.ts'
import { getAsaasPixQrCode } from './helpers/asaasGetPixQrCode.ts'

// ============================================
// CORS (CORREÇÃO DEFINITIVA)
// ============================================
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

// ============================================
// Utils
// ============================================
const normalizeDigits = (v?: string) => (v || '').replace(/[^\d]/g, '')
const trim = (v?: string) => (v || '').trim()

// ============================================
// Asaas Customer (INLINE)
// ============================================
async function getOrCreateCustomer(
  apiKey: string,
  baseUrl: string,
  params: {
    name: string
    email?: string
    phone?: string
    cpfCnpj?: string
  }
): Promise<{ id: string }> {
  const name = trim(params.name)
  const email = trim(params.email)
  const phone = normalizeDigits(params.phone)
  const cpfCnpj = normalizeDigits(params.cpfCnpj)

  if (!name) throw new Error('customerName é obrigatório')

  const query = cpfCnpj
    ? `cpfCnpj=${cpfCnpj}`
    : email
      ? `email=${encodeURIComponent(email)}`
      : ''

  if (query) {
    const search = await fetch(`${baseUrl}/customers?${query}`, {
      headers: { access_token: apiKey },
    })

    const sText = await search.text()
    let sJson: any = null
    try {
      sJson = sText ? JSON.parse(sText) : null
    } catch {}

    if (search.ok && sJson?.data?.length && sJson.data[0]?.id) {
      return { id: sJson.data[0].id }
    }
  }

  const create = await fetch(`${baseUrl}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
    },
    body: JSON.stringify({
      name,
      email: email || undefined,
      phone: phone || undefined,
      cpfCnpj: cpfCnpj || undefined,
    }),
  })

  const cText = await create.text()
  let cJson: any = null
  try {
    cJson = cText ? JSON.parse(cText) : null
  } catch {}

  if (!create.ok || !cJson?.id) {
    throw new Error(
      cJson?.errors?.[0]?.description ||
        cJson?.message ||
        'Erro ao criar customer no Asaas'
    )
  }

  return { id: cJson.id }
}

// ============================================
// Edge Function
// ============================================
serve(async (req) => {
  // ✅ CORS PRE-FLIGHT (ESSENCIAL)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  // ============================================
  // ENV
  // ============================================
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') || ''
  const ASAAS_BASE_URL =
    Deno.env.get('ASAAS_BASE_URL') || 'https://api.asaas.com/v3'

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY || !ASAAS_API_KEY) {
    return jsonResponse({ error: 'Variáveis de ambiente ausentes' }, 500)
  }

  // ============================================
  // AUTH
  // ============================================
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization inválido' }, 401)
  }

  const token = authHeader.replace('Bearer ', '')

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  })

  const user = await userRes.json()
  if (!user?.id) {
    return jsonResponse({ error: 'Token inválido ou expirado' }, 401)
  }

  // ============================================
  // BODY
  // ============================================
  const body = await req.json()

  // MODIFIQUEI AQUI - Novo contrato: NÃO recebe participationId/ticketCode.
  // Agora o Pix é gerado a partir de um "intent" (pedido pendente), e a participação
  // (ticket) só será criada quando o webhook confirmar o pagamento.
  const contestId = trim(body?.contestId)
  const selectedNumbersRaw = body?.selectedNumbers
  const amount = Number(body?.amount)

  if (!contestId) {
    return jsonResponse({ error: 'contestId é obrigatório', debug: { step: 'body_validation' } }, 400)
  }

  if (!Array.isArray(selectedNumbersRaw) || selectedNumbersRaw.length === 0) {
    return jsonResponse({ error: 'selectedNumbers é obrigatório', debug: { step: 'body_validation' } }, 400)
  }

  const selectedNumbers = selectedNumbersRaw
    .map((n: any) => Number(n))
    .filter((n: number) => Number.isInteger(n) && n >= 0)

  if (selectedNumbers.length !== selectedNumbersRaw.length) {
    return jsonResponse({ error: 'selectedNumbers inválido', debug: { step: 'body_validation' } }, 400)
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse({ error: 'amount inválido', debug: { step: 'body_validation' } }, 400)
  }

  // ============================================
  // ASAAS FLOW
  // ============================================
  // Validar CPF obrigatório para pagamentos Pix
  const normalizedCpf = normalizeDigits(body.customerCpfCnpj)
  if (!normalizedCpf || normalizedCpf.length !== 11) {
    return jsonResponse(
      { error: 'CPF é obrigatório para pagamentos Pix', debug: { step: 'cpf_validation' } },
      400
    )
  }

  const customer = await getOrCreateCustomer(ASAAS_API_KEY, ASAAS_BASE_URL, {
    name: body.customerName,
    email: body.customerEmail,
    phone: body.customerPhone,
    cpfCnpj: normalizedCpf,
  })

  const dueDate = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  // ============================================
  // SAVE INTENT (DB)
  // ============================================
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // MODIFIQUEI AQUI - cria um "intent" para esse pedido Pix (a participação só será criada após o webhook)
  const { data: intent, error: intentError } = await admin
    .from('pix_payment_intents')
    .insert({
      user_id: user.id,
      contest_id: contestId,
      selected_numbers: selectedNumbers,
      amount,
      discount_code: body.discountCode || null,
      status: 'PENDING',
    })
    .select('id')
    .single()

  if (intentError || !intent?.id) {
    console.error('[asaas-create-pix] Erro ao criar intent:', intentError)
    return jsonResponse(
      { error: 'Erro ao criar pedido Pix', debug: { step: 'create_intent' } },
      500
    )
  }

  // ============================================
  // CREATE ASAAS PAYMENT
  // ============================================
  const payment = await createAsaasPayment(ASAAS_API_KEY, ASAAS_BASE_URL, {
    customerId: customer.id,
    amount,
    dueDate,
    description: body.description,
    // MODIFIQUEI AQUI - externalReference agora é o intentId (não mais ticketCode)
    externalReference: intent.id,
  })

  const qrCode = await getAsaasPixQrCode(
    ASAAS_API_KEY,
    ASAAS_BASE_URL,
    payment.id
  )

  // MODIFIQUEI AQUI - vincular asaas_payment_id no intent
  const { error: updateIntentError } = await admin
    .from('pix_payment_intents')
    .update({
      asaas_payment_id: payment.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intent.id)

  if (updateIntentError) {
    // Não falha o checkout por isso; loga para correção.
    console.error('[asaas-create-pix] Erro ao atualizar intent:', updateIntentError)
  }

  // ============================================
  // SAVE DB (compat)
  // ============================================
  // MODIFIQUEI AQUI - antes salvava em payments com participation_id.
  // Agora não existe participation antes do pagamento. Se sua tabela payments exigir participation_id,
  // este insert pode falhar. Mantemos em try/catch para não quebrar o checkout.
  try {
    await admin.from('payments').insert({
      participation_id: null,
      amount,
      status: 'pending',
      payment_method: 'pix',
      external_id: payment.id,
      // campos extras (se existirem) ajudam no futuro
      intent_id: intent.id,
      contest_id: contestId,
      user_id: user.id,
    })
  } catch (err) {
    console.error('[asaas-create-pix] Aviso: não foi possível salvar em payments (compat):', err)
  }

  return jsonResponse({
    // MODIFIQUEI AQUI - retorna intentId para o frontend, para rastreamento
    intentId: intent.id,
    id: payment.id,
    status: payment.status,
    dueDate: payment.dueDate,
    qrCode: qrCode.qrCode,
  })
})
