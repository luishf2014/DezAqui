import { supabase } from '../lib/supabase'

// MODIFIQUEI AQUI - nome genérico (não mais Asaas)
export interface PixQRCodeResponse {
  encodedImage: string
  payload: string
  expirationDate: string
}

export interface CartItemForPix {
  contestId: string
  selectedNumbers: number[]
  amount: number
}

export interface CreatePixPaymentParams {
  contestId: string
  selectedNumbers: number[]
  participationId: string
  ticketCode: string
  amount: number
  description: string
  customerName: string
  customerCpfCnpj?: string
  customerEmail?: string
  customerPhone?: string
  discountCode?: string
  cartItems?: CartItemForPix[]
}

export interface CreatePixPaymentResponse {
  id: string
  qrCode: PixQRCodeResponse
  status: string
  expirationDate: string
}

/**
 * Cria pagamento PIX via Mercado Pago
 *
 * Fluxo:
 * - Chama Edge Function mercadopago-create-pix
 * - Recebe QR Code direto na criação
 * - Webhook confirma pagamento e ativa participação
 */
export async function createPixPayment(
  params: CreatePixPaymentParams
): Promise<CreatePixPaymentResponse> {
  if (!params?.contestId) {
    throw new Error('contestId é obrigatório (step: body_validation)')
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuário não autenticado. Faça login novamente.')
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.refreshSession()

  if (sessionError || !sessionData?.session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.')
  }

  const accessToken = sessionData.session.access_token

  const supabaseUrl =
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    (import.meta as any).env?.SUPABASE_URL

  const anonKey =
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    (import.meta as any).env?.SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase env não configurado')
  }

  // MODIFIQUEI AQUI - endpoint Mercado Pago
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/mercadopago-create-pix`

  console.log('[createPixPayment][MP] chamando Edge Function:', {
    url,
    contestId: params.contestId,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': anonKey,
    },
    body: JSON.stringify({
      contestId: params.contestId,
      selectedNumbers: params.selectedNumbers,
      amount: params.amount,
      description: params.description,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      customerCpfCnpj: params.customerCpfCnpj,
      discountCode: params.discountCode,
      cartItems: params.cartItems,
    }),
  })

  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    console.error('[createPixPayment][MP] erro:', data)
    throw new Error(
      data?.error || data?.message || 'Erro ao criar pagamento PIX'
    )
  }

  if (!data?.id || !data?.qrCode) {
    console.error('[createPixPayment][MP] resposta inválida:', data)
    throw new Error('Resposta inválida do servidor')
  }

  return {
    id: data.id,
    status: data.status || 'pending',
    expirationDate: data.expirationDate || data.qrCode.expirationDate,
    qrCode: {
      payload: data.qrCode.payload,
      encodedImage: data.qrCode.encodedImage,
      expirationDate:
        data.qrCode.expirationDate || data.expirationDate || '',
    },
  }
}
