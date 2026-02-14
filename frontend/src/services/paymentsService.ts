/**
 * Serviço de acesso a dados de pagamentos
 * FASE 3: Pagamentos e Ativação
 * 
 * Funções para criar e gerenciar pagamentos
 */
import { supabase } from '../lib/supabase'
import { Payment } from '../types'

/**
 * Cria um registro de pagamento em dinheiro para uma participação
 * MODIFIQUEI AQUI - Função para admin registrar pagamento em dinheiro
 * 
 * @param params Parâmetros do pagamento
 * @returns Pagamento criado
 */
export async function createCashPayment(params: {
  participationId: string
  amount: number
  notes?: string
}): Promise<Payment> {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      participation_id: params.participationId,
      amount: params.amount,
      status: 'paid', // Pagamento em dinheiro é marcado como pago imediatamente
      payment_method: 'cash',
      paid_at: new Date().toISOString(),
      external_data: params.notes ? { notes: params.notes } : null,
    })
    .select('*')
    .maybeSingle() // MODIFIQUEI AQUI - Usar maybeSingle() ao invés de single() para evitar erro 406

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para criar este pagamento')
    }
    throw new Error(`Erro ao registrar pagamento: ${error.message}`)
  }

  return data
}

/**
 * Cria um registro de pagamento Pix para uma participação
 * MODIFIQUEI AQUI - Função para criar pagamento Pix (aguardando confirmação)
 * 
 * @param params Parâmetros do pagamento Pix
 * @returns Pagamento criado
 */
export async function createPixPaymentRecord(params: {
  participationId: string
  amount: number
  externalId: string // ID do pagamento no Asaas
  qrCodeData?: {
    payload: string
    expirationDate: string
  }
}): Promise<Payment> {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      participation_id: params.participationId,
      amount: params.amount,
      status: 'pending', // Pagamento Pix inicia como pendente
      payment_method: 'pix',
      external_id: params.externalId,
      external_data: params.qrCodeData ? {
        payload: params.qrCodeData.payload,
        expirationDate: params.qrCodeData.expirationDate,
      } : null,
    })
    .select('*')
    .maybeSingle()

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para criar este pagamento')
    }
    throw new Error(`Erro ao registrar pagamento: ${error.message}`)
  }

  return data
}

/**
 * Busca pagamentos de uma participação específica
 * MODIFIQUEI AQUI - Função para verificar se participação já tem pagamento registrado
 * 
 * @param participationId ID da participação
 * @returns Lista de pagamentos da participação
 */
export async function getPaymentsByParticipation(participationId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('participation_id', participationId)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para visualizar estes pagamentos')
    }
    throw new Error(`Erro ao buscar pagamentos: ${error.message}`)
  }

  return data || []
}

/**
 * Verifica se uma participação já tem pagamento registrado e pago
 * MODIFIQUEI AQUI - Função auxiliar para verificar se pode ativar
 * 
 * @param participationId ID da participação
 * @returns true se tem pagamento pago, false caso contrário
 */
export async function hasPaidPayment(participationId: string): Promise<boolean> {
  const payments = await getPaymentsByParticipation(participationId)
  return payments.some(p => p.status === 'paid')
}

/**
 * Lista todos os pagamentos do sistema (apenas para administradores)
 * MODIFIQUEI AQUI - Função para histórico financeiro
 * 
 * @param filters Filtros opcionais (contestId, status, paymentMethod, startDate, endDate)
 * @returns Lista de pagamentos com informações de participação e concurso
 */
export interface PaymentFilters {
  contestId?: string
  status?: 'pending' | 'paid' | 'cancelled' | 'refunded'
  paymentMethod?: 'pix' | 'cash' | 'manual'
  startDate?: string
  endDate?: string
}

export interface PaymentWithDetails extends Payment {
  participation?: {
    id: string
    ticket_code?: string
    contest_id: string
    user_id: string
  } | null
  contest?: {
    id: string
    name: string
  } | null
}

// MODIFIQUEI AQUI - helper para endDate incluir o dia inteiro
function normalizeEndDate(endDate: string): string {
  // se vier "YYYY-MM-DD", transforma em "YYYY-MM-DDT23:59:59.999"
  if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return `${endDate}T23:59:59.999`
  }
  return endDate
}

export async function listAllPayments(filters?: PaymentFilters): Promise<PaymentWithDetails[]> {
  // Quando filtrar por concurso: buscar IDs de participações primeiro (filtro via tabela relacionada pode falhar no PostgREST)
  let participationIds: string[] | null = null
  if (filters?.contestId) {
    const { data: participationsData } = await supabase
      .from('participations')
      .select('id')
      .eq('contest_id', filters.contestId)
    participationIds = (participationsData || []).map((p) => p.id)
    if (participationIds.length === 0) {
      return [] // Nenhuma participação no concurso = nenhum pagamento
    }
  }

  let query = supabase
    .from('payments')
    .select(`
      *,
      participations!inner (
        id,
        ticket_code,
        contest_id,
        user_id,
        contests (
          id,
          name
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod)
  }

  if (filters?.startDate) {
    query = query.gte('created_at', /^\d{4}-\d{2}-\d{2}$/.test(filters.startDate) ? `${filters.startDate}T00:00:00.000` : filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte('created_at', normalizeEndDate(filters.endDate))
  }

  if (participationIds !== null) {
    query = query.in('participation_id', participationIds)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para visualizar estes pagamentos')
    }
    throw new Error(`Erro ao buscar pagamentos: ${error.message}`)
  }

  const rows = (data || []) as any[]

  // MODIFIQUEI AQUI - mapear sem chamadas extras
  const paymentsWithDetails: PaymentWithDetails[] = rows.map((item: any) => {
    const participationData = Array.isArray(item.participations)
      ? item.participations[0] || null
      : item.participations || null

    const contestData =
      participationData?.contests
        ? (Array.isArray(participationData.contests) ? participationData.contests[0] : participationData.contests)
        : null

    return {
      ...item,
      participation: participationData ? {
        id: participationData.id,
        ticket_code: participationData.ticket_code,
        contest_id: participationData.contest_id,
        user_id: participationData.user_id,
      } : null,
      contest: contestData ? {
        id: contestData.id,
        name: contestData.name,
      } : null,
    }
  })

  return paymentsWithDetails
}

/**
 * Verifica se um pagamento Pix foi confirmado (para exibir mensagem de sucesso)
 * Usado em CheckoutPage e CartPage para polling enquanto o usuário vê o QR Code
 *
 * @param externalId ID do pagamento no Asaas (retornado por createPixPayment)
 * @returns Objeto com status e códigos dos tickets quando confirmado
 */
export interface PixPaymentStatusResult {
  paid: boolean
  ticketCodes: string[]
  contestId?: string
}

export async function checkPixPaymentStatus(
  externalId: string
): Promise<PixPaymentStatusResult> {
  if (!externalId?.trim()) {
    return { paid: false, ticketCodes: [] }
  }

  const { data: payments, error } = await supabase
    .from('payments')
    .select(
      `
      id,
      status,
      participation_id,
      participations (
        ticket_code,
        contest_id
      )
    `
    )
    .eq('external_id', externalId)

  if (error) {
    console.error('[checkPixPaymentStatus] Erro:', error)
    return { paid: false, ticketCodes: [] }
  }

  const list = (payments || []) as any[]
  const paidPayments = list.filter((p) => p.status === 'paid')

  if (paidPayments.length === 0) {
    return { paid: false, ticketCodes: [] }
  }

  const ticketCodes: string[] = []
  let contestId: string | undefined

  for (const p of paidPayments) {
    const part = Array.isArray(p.participations) ? p.participations[0] : p.participations
    if (part?.ticket_code) {
      ticketCodes.push(part.ticket_code)
      if (!contestId && part.contest_id) {
        contestId = part.contest_id
      }
    }
  }

  return {
    paid: true,
    ticketCodes,
    contestId,
  }
}

/**
 * Calcula estatísticas financeiras gerais
 * MODIFIQUEI AQUI - Função para estatísticas financeiras
 * 
 * @param filters Filtros opcionais
 * @returns Estatísticas financeiras
 */
export interface FinancialStats {
  totalRevenue: number
  totalPayments: number
  revenueByMethod: {
    pix: number
    cash: number
    manual: number
  }
  revenueByStatus: {
    paid: number
    pending: number
    cancelled: number
    refunded: number
  }
  averagePayment: number
}

export async function getFinancialStats(filters?: PaymentFilters): Promise<FinancialStats> {
  // Mantive sua lógica para não mudar comportamento, mas agora listAllPayments retorna consistente
  const payments = await listAllPayments(filters)

  const stats: FinancialStats = {
    totalRevenue: 0,
    totalPayments: payments.length,
    revenueByMethod: {
      pix: 0,
      cash: 0,
      manual: 0,
    },
    revenueByStatus: {
      paid: 0,
      pending: 0,
      cancelled: 0,
      refunded: 0,
    },
    averagePayment: 0,
  }

  payments.forEach(payment => {
    if (payment.status === 'paid') {
      stats.totalRevenue += payment.amount
    }

    // Por método
    if (payment.payment_method === 'pix') {
      if (payment.status === 'paid') {
        stats.revenueByMethod.pix += payment.amount
      }
    } else if (payment.payment_method === 'cash') {
      if (payment.status === 'paid') {
        stats.revenueByMethod.cash += payment.amount
      }
    } else if (payment.payment_method === 'manual') {
      if (payment.status === 'paid') {
        stats.revenueByMethod.manual += payment.amount
      }
    }

    // Por status
    if (payment.status === 'paid') {
      stats.revenueByStatus.paid += payment.amount
    } else if (payment.status === 'pending') {
      stats.revenueByStatus.pending += payment.amount
    } else if (payment.status === 'cancelled') {
      stats.revenueByStatus.cancelled += payment.amount
    } else if (payment.status === 'refunded') {
      stats.revenueByStatus.refunded += payment.amount
    }
  })

  const paidCount = payments.filter(p => p.status === 'paid').length
  stats.averagePayment = paidCount > 0 ? stats.totalRevenue / paidCount : 0 // MODIFIQUEI AQUI - evita NaN

  return stats
}
