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
 * - Chama Edge Function mercadopago-create-pix via supabase.functions.invoke
 * - O cliente Supabase inclui automaticamente o JWT da sessão
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

  const { data, error } = await supabase.functions.invoke('mercadopago-create-pix', {
    body: {
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
    },
  })

  if (error) {
    console.error('[createPixPayment][MP] erro:', error)
    throw new Error(error.message || 'Erro ao criar pagamento PIX')
  }

  const response = (data ?? {}) as any
  if (response?.error) {
    throw new Error(response.error)
  }
  if (!response?.id || !response?.qrCode) {
    console.error('[createPixPayment][MP] resposta inválida:', response)
    throw new Error(response?.message || 'Resposta inválida do servidor')
  }

  return {
    id: response.id,
    status: response.status || 'pending',
    expirationDate: response.expirationDate || response.qrCode?.expirationDate,
    qrCode: {
      payload: response.qrCode.payload,
      encodedImage: response.qrCode.encodedImage,
      expirationDate:
        response.qrCode.expirationDate || response.expirationDate || '',
    },
  }
}
