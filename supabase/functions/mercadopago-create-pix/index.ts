import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { createMpPixPayment } from './helpers/mercadopagoCreatePayment.ts'

// ============================================
// CORS (IGUAL AO ASAAS)
// ============================================
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
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
// Utils (IGUAL AO ASAAS)
// ============================================
const normalizeDigits = (v?: string) => (v || '').replace(/[^\d]/g, '')
const trim = (v?: string) => (v || '').trim()

// ============================================
// Edge Function
// ============================================
serve(async (req) => {
  // ✅ CORS PRE-FLIGHT
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  try {
    // ============================================
    // ENV
    // ============================================
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || ''
    const MP_BASE_URL = Deno.env.get('MERCADOPAGO_BASE_URL') || 'https://api.mercadopago.com'
    // Para Pix/QR Code, a URL de notificação DEVE ser passada na criação do pagamento
    const MP_NOTIFICATION_URL =
      Deno.env.get('MERCADOPAGO_NOTIFICATION_URL') ||
      `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/mercadopago-webhook`

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY || !MP_ACCESS_TOKEN) {
      return jsonResponse({ error: 'Variáveis de ambiente ausentes' }, 500)
    }

    // ============================================
    // AUTH (IGUAL AO ASAAS)
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
    // BODY (IGUAL AO ASAAS)
    // ============================================
    const body = await req.json()

    const contestId = trim(body?.contestId)
    const selectedNumbersRaw = body?.selectedNumbers
    const amount = Number(body?.amount)
    const cartItemsRaw = body?.cartItems

    const isCartFlow = Array.isArray(cartItemsRaw) && cartItemsRaw.length > 0

    if (isCartFlow) {
      const cartItems = cartItemsRaw.map((it: any) => ({
        contestId: trim(it?.contestId),
        selectedNumbers: Array.isArray(it?.selectedNumbers)
          ? it.selectedNumbers.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 0)
          : [],
        amount: Number(it?.amount),
      }))

      if (cartItems.some((it: any) => !it.contestId || it.selectedNumbers.length === 0 || !Number.isFinite(it.amount) || it.amount <= 0)) {
        return jsonResponse({ error: 'cartItems inválido', debug: { step: 'body_validation' } }, 400)
      }

      const sumAmount = cartItems.reduce((s: number, it: any) => s + it.amount, 0)
      if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount - sumAmount) > 0.01) {
        return jsonResponse({ error: 'amount deve ser a soma dos cartItems', debug: { step: 'body_validation' } }, 400)
      }
    } else {
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
    }

    // ============================================
    // CPF (IGUAL AO SEU PADRÃO: obrigatório)
    // ============================================
    const normalizedCpf = normalizeDigits(body.customerCpfCnpj)
    if (!normalizedCpf || normalizedCpf.length !== 11) {
      return jsonResponse(
        { error: 'CPF é obrigatório para pagamentos Pix', debug: { step: 'cpf_validation' } },
        400
      )
    }

    const customerName = trim(body.customerName)
    if (!customerName) {
      return jsonResponse({ error: 'customerName é obrigatório', debug: { step: 'payer_validation' } }, 400)
    }

    const customerEmail = trim(body.customerEmail) || undefined

    // ============================================
    // DB ADMIN
    // ============================================
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    if (isCartFlow) {
      // ============================================
      // FLUXO CARRINHO: N intents, 1 Pix - tickets criados pelo webhook após pagamento
      // ============================================
      const cartItems = cartItemsRaw.map((it: any) => ({
        contestId: trim(it?.contestId),
        selectedNumbers: Array.isArray(it?.selectedNumbers)
          ? it.selectedNumbers.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 0)
          : [],
        amount: Number(it?.amount),
      }))

      const intentIds: string[] = []
      for (const it of cartItems) {
        const { data: intent, error: intentErr } = await admin
          .from('pix_payment_intents')
          .insert({
            user_id: user.id,
            contest_id: it.contestId,
            selected_numbers: it.selectedNumbers,
            amount: it.amount,
            status: 'PENDING',
          })
          .select('id')
          .single()

        if (intentErr || !intent?.id) {
          console.error('[mercadopago-create-pix] Erro ao criar intent (cart):', intentErr)
          return jsonResponse({ error: 'Erro ao criar pedido Pix', debug: { step: 'create_intents' } }, 500)
        }
        intentIds.push(intent.id)
      }

      const payment = await createMpPixPayment(MP_ACCESS_TOKEN, MP_BASE_URL, {
        amount,
        description: body.description,
        externalReference: intentIds[0],
        payer: { name: customerName, email: customerEmail, cpf: normalizedCpf },
        notificationUrl: MP_NOTIFICATION_URL,

        //idempotência por checkout (1 Pix)
        idempotencyKey: intentIds[0],
      })

      if (!payment.qrCode?.payload || !payment.qrCode?.encodedImage) {
        return jsonResponse({ error: 'QR Code não disponível', debug: { step: 'mp_qrcode' } }, 500)
      }

      for (let i = 0; i < intentIds.length; i++) {
        await admin
          .from('pix_payment_intents')
          .update({
            asaas_payment_id: payment.id, // ID do pagamento MP (coluna reutilizada)
            updated_at: new Date().toISOString(),
          })
          .eq('id', intentIds[i])
      }

      // Salvar payments de forma idempotente (evita duplicatas se usuário recarregar)
      try {
        for (let i = 0; i < cartItems.length; i++) {
          // Verificar se já existe payment para este external_id + intent
          const { data: existingPayment } = await admin
            .from('payments')
            .select('id')
            .eq('external_id', payment.id)
            .eq('intent_id', intentIds[i])
            .maybeSingle()

          if (!existingPayment) {
            await admin.from('payments').insert({
              participation_id: null,
              amount: cartItems[i].amount,
              status: 'pending',
              payment_method: 'pix',
              external_id: payment.id,
              intent_id: intentIds[i],
            })
          }
        }
      } catch (err) {
        console.error('[mercadopago-create-pix] Erro ao salvar payments (cart):', err)
        return jsonResponse({ error: 'Erro ao salvar pagamentos', debug: { step: 'save_payments' } }, 500)
      }

      return jsonResponse({
        id: payment.id,
        status: payment.status,
        expirationDate: payment.dateOfExpiration,
        qrCode: {
          payload: payment.qrCode.payload,
          encodedImage: payment.qrCode.encodedImage,
          expirationDate: payment.dateOfExpiration,
        },
      })
    }

    // ============================================
    // FLUXO CHECKOUT ÚNICO: intent (participação criada pelo webhook)
    // ============================================
    const selectedNumbers = (selectedNumbersRaw || [])
      .map((n: any) => Number(n))
      .filter((n: number) => Number.isInteger(n) && n >= 0)

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
      console.error('[mercadopago-create-pix] Erro ao criar intent:', intentError)
      return jsonResponse({ error: 'Erro ao criar pedido Pix', debug: { step: 'create_intent' } }, 500)
    }

    const payment = await createMpPixPayment(MP_ACCESS_TOKEN, MP_BASE_URL, {
      amount,
      description: body.description,
      externalReference: intent.id,
      payer: { name: customerName, email: customerEmail, cpf: normalizedCpf },
      notificationUrl: MP_NOTIFICATION_URL || undefined,

      // idempotência por intent
      idempotencyKey: intent.id,
    })

    if (!payment.qrCode?.payload || !payment.qrCode?.encodedImage) {
      return jsonResponse({ error: 'QR Code não disponível', debug: { step: 'mp_qrcode' } }, 500)
    }

    await admin
      .from('pix_payment_intents')
      .update({
        asaas_payment_id: payment.id, // ID do pagamento MP (coluna reutilizada)
        updated_at: new Date().toISOString(),
      })
      .eq('id', intent.id)

    // Salvar payment de forma idempotente
    try {
      const { data: existingPayment } = await admin
        .from('payments')
        .select('id')
        .eq('external_id', payment.id)
        .eq('intent_id', intent.id)
        .maybeSingle()

      if (!existingPayment) {
        await admin.from('payments').insert({
          participation_id: null,
          amount,
          status: 'pending',
          payment_method: 'pix',
          external_id: payment.id,
          intent_id: intent.id,
          contest_id: contestId,
          user_id: user.id,
        })
      }
    } catch (err) {
      console.error('[mercadopago-create-pix] Aviso: erro ao salvar payment:', err)
    }

    return jsonResponse({
      intentId: intent.id,
      id: payment.id,
      status: payment.status,
      expirationDate: payment.dateOfExpiration,
      qrCode: {
        payload: payment.qrCode.payload,
        encodedImage: payment.qrCode.encodedImage,
        expirationDate: payment.dateOfExpiration,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[mercadopago-create-pix] erro:', msg)
    return jsonResponse({ error: msg }, 500)
  }
})
