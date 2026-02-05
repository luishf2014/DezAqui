/**
 * Helper: Cria pagamento PIX no Asaas
 * 
 * ⚠️ IMPORTANTE:
 * O Asaas EXIGE o campo `customer` (ID).
 * Não é permitido criar pagamento passando name/email/cpf diretamente.
 */

export interface CreateAsaasPaymentParams {
  customerId: string // MODIFIQUEI AQUI - obrigatório no Asaas
  amount: number
  dueDate: string
  description: string
  externalReference: string
}

export interface CreateAsaasPaymentResponse {
  id: string
  status: string
  dueDate: string
}

export async function createAsaasPayment(
  asaasApiKey: string,
  asaasBaseUrl: string,
  params: CreateAsaasPaymentParams
): Promise<CreateAsaasPaymentResponse> {
  const res = await fetch(`${asaasBaseUrl}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': asaasApiKey,
    },
    body: JSON.stringify({
      customer: params.customerId, // MODIFIQUEI AQUI
      billingType: 'PIX',
      value: params.amount,
      dueDate: params.dueDate,
      description: params.description,
      externalReference: params.externalReference,
    }),
  })

  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {}

  if (!res.ok) {
    const msg =
      data?.errors?.[0]?.description ||
      data?.message ||
      'Erro ao criar cobrança no Asaas'
    throw new Error(msg)
  }

  if (!data?.id) {
    throw new Error('Resposta inválida do Asaas: pagamento sem ID')
  }

  return {
    id: data.id,
    status: data.status || 'PENDING',
    dueDate: data.dueDate || params.dueDate,
  }
}
