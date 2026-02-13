import { supabase } from '../lib/supabase'

export interface AsaasPixQRCodeResponse {
  encodedImage: string
  payload: string
  expirationDate: string
}

export interface CreatePixPaymentParams {
  // MODIFIQUEI AQUI - exigidos pela Edge Function (body_validation)
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
}

export interface CreatePixPaymentResponse {
  id: string
  qrCode: AsaasPixQRCodeResponse
  status: string
  dueDate: string
}

/**
 * Cria pagamento PIX e retorna QR Code
 *
 * Chama apenas a Edge Function asaas-create-pix que:
 * - Valida autenticação e ownership
 * - Cria pagamento no Asaas
 * - Busca QR Code (com retry automático)
 * - Salva no banco
 * - Retorna resposta completa
 *
 * @param params Parâmetros do pagamento PIX
 * @returns Resposta com ID do pagamento e QR Code
 */
export async function createPixPayment(
  params: CreatePixPaymentParams
): Promise<CreatePixPaymentResponse> {
  // MODIFIQUEI AQUI - validação local para evitar erro misterioso vindo do backend
  if (!params?.contestId) {
    throw new Error('contestId é obrigatório (step: body_validation)')
  }

  // Verificar autenticação - getUser() valida o token no servidor
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuário não autenticado. Faça login novamente.')
  }

  // Obter sessão atualizada
  let { data: sessionData, error: sessionError } = await supabase.auth.getSession()

  // Se não tiver sessão válida, tentar refresh
  if (sessionError || !sessionData?.session) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshData?.session) {
      throw new Error('Sessão expirada. Faça login novamente.')
    }
    sessionData = refreshData
  }

  // Verificar se temos token válido
  const accessToken = sessionData?.session?.access_token
  if (!accessToken) {
    throw new Error('Token de acesso não disponível. Faça login novamente.')
  }

  // MODIFIQUEI AQUI - Em vez de supabase.functions.invoke (que esconde o body do erro),
  // chamar via fetch para:
  // - forçar Authorization Bearer
  // - capturar o JSON do 401/403/500 com { error, debug.step }
  const supabaseUrl =
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    (import.meta as any).env?.SUPABASE_URL

  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL não configurado.')
  }

  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/asaas-create-pix`

  // MODIFIQUEI AQUI - log de contexto (ajuda a matar “misterios”)
  console.log('[createPixPayment] chamando Edge Function:', {
    url,
    hasAccessToken: !!accessToken,
    accessTokenPrefix: accessToken.substring(0, 12) + '...',
    // MODIFIQUEI AQUI - loga contestId (sem expor dados sensíveis)
    contestId: String(params.contestId),
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // MODIFIQUEI AQUI - garante Bearer correto SEM depender do invoke
      'Authorization': `Bearer ${accessToken}`,
      // MODIFIQUEI AQUI - REMOVIDO apikey (isso estava causando Invalid JWT)
      // ...(anonKey ? { apikey: anonKey } : {}),
    },
      body: JSON.stringify({
    // MODIFIQUEI AQUI - campos exigidos pela Edge Function
    contestId: params.contestId,
    selectedNumbers: params.selectedNumbers,

    participationId: params.participationId,
    ticketCode: params.ticketCode,
    amount: params.amount,
    description: params.description,
    customerName: params.customerName,
    customerEmail: params.customerEmail,
    customerPhone: params.customerPhone,
    customerCpfCnpj: params.customerCpfCnpj,
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
    // MODIFIQUEI AQUI - logs “não colapsáveis” (JSON stringify)
    console.error('[createPixPayment] Edge Function status:', res.status)
    console.error('[createPixPayment] Edge Function response JSON:', JSON.stringify(data, null, 2))
    console.error('[createPixPayment] Edge Function details:', {
      url,
      statusText: res.statusText,
    })

    // Se for erro 401, pode ser token expirado
    if (res.status === 401) {
      const msg =
        data?.error ||
        data?.message || // MODIFIQUEI AQUI - alguns gateways retornam message (ex: Invalid JWT)
        'Token inválido ou expirado. Por favor, faça login novamente.'
      const debugStep = data?.debug?.step ? ` (step: ${data.debug.step})` : ''
      throw new Error(`${msg}${debugStep}`)
    }

    const errorMessage =
      data?.error ||
      data?.message ||
      `Erro ao criar pagamento PIX (status ${res.status})`
    const debugStep = data?.debug?.step ? ` (step: ${data.debug.step})` : ''
    throw new Error(`${errorMessage}${debugStep}`)
  }

  if (!data || !data.id || !data.qrCode) {
    // MODIFIQUEI AQUI - log da resposta inesperada
    console.error('[createPixPayment] Resposta inválida:', JSON.stringify(data, null, 2))
    throw new Error('Resposta inválida do servidor')
  }

  return {
    id: data.id,
    status: data.status || 'PENDING',
    dueDate: data.dueDate || '',
    qrCode: {
      encodedImage: data.qrCode.encodedImage,
      payload: data.qrCode.payload,
      expirationDate: data.qrCode.expirationDate || data.dueDate || '',
    },
  }
}