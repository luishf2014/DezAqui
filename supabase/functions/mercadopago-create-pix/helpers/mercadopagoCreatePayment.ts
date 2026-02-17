/**
 * Helper: Cria pagamento PIX no Mercado Pago
 *
 * Retorna o paymentId + status + QR (payload e base64) + expiração.
 */

export interface CreateMpPixPaymentParams {
  amount: number
  description: string
  externalReference: string
  payer: {
    name: string
    email?: string
    cpf: string
  }
  notificationUrl?: string

  // Mercado Pago exige idempotência
  idempotencyKey: string
}

export interface CreateMpPixPaymentResponse {
  id: string
  status: string
  dateOfExpiration?: string
  qrCode?: {
    payload: string
    encodedImage: string // base64
  }
}

function splitName(full: string): { first_name: string; last_name: string } {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { first_name: parts[0] || 'Cliente', last_name: '' }
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
}

export async function createMpPixPayment(
  mpAccessToken: string,
  mpBaseUrl: string,
  params: CreateMpPixPaymentParams
): Promise<CreateMpPixPaymentResponse> {
  const { first_name, last_name } = splitName(params.payer.name)

  const body: any = {
    transaction_amount: params.amount,
    description: params.description,
    payment_method_id: 'pix',
    external_reference: params.externalReference,
    payer: {
      first_name,
      last_name,
      email: params.payer.email || undefined,
      identification: {
        type: 'CPF',
        number: params.payer.cpf,
      },
    },
  }

  // MODIFIQUEI AQUI - garante que o Mercado Pago chame seu webhook
  if (params.notificationUrl) {
    body.notification_url = params.notificationUrl
  }

  const res = await fetch(`${mpBaseUrl}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mpAccessToken}`,
      'Content-Type': 'application/json',
      //Header obrigatório no MP (senão dá "can't be null")
    'X-Idempotency-Key': params.idempotencyKey,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {}

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error ||
      data?.cause?.[0]?.description ||
      'Erro ao criar pagamento Pix no Mercado Pago'
    throw new Error(msg)
  }

  const paymentId = String(data?.id || '')
  if (!paymentId) {
    throw new Error('Resposta inválida do Mercado Pago: pagamento sem ID')
  }

  const qrPayload =
    data?.point_of_interaction?.transaction_data?.qr_code || ''
  const qrBase64 =
    data?.point_of_interaction?.transaction_data?.qr_code_base64 || ''

  return {
    id: paymentId,
    status: data?.status || 'pending',
    dateOfExpiration: data?.date_of_expiration || undefined,
    qrCode: qrPayload && qrBase64 ? { payload: qrPayload, encodedImage: qrBase64 } : undefined,
  }
}
