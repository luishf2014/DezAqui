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
    .select()
    .single()

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

export async function listAllPayments(filters?: PaymentFilters): Promise<PaymentWithDetails[]> {
  let query = supabase
    .from('payments')
    .select(`
      *,
      participations (
        id,
        ticket_code,
        contest_id,
        user_id
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
    query = query.gte('created_at', filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para visualizar estes pagamentos')
    }
    throw new Error(`Erro ao buscar pagamentos: ${error.message}`)
  }

  // Buscar informações dos concursos para cada participação
  const paymentsWithDetails = await Promise.all(
    (data || []).map(async (item: any) => {
      // participations pode ser um array ou objeto único
      const participationData = Array.isArray(item.participations) 
        ? item.participations[0] || null 
        : item.participations || null
      
      let contest = null

      // Se tiver filtro por concurso, verificar aqui
      if (filters?.contestId && participationData?.contest_id !== filters.contestId) {
        return null
      }

      // Buscar informações do concurso
      if (participationData?.contest_id) {
        try {
          const { data: contestData } = await supabase
            .from('contests')
            .select('id, name')
            .eq('id', participationData.contest_id)
            .single()
          contest = contestData || null
        } catch (err) {
          console.warn(`Erro ao buscar concurso ${participationData.contest_id}:`, err)
        }
      }

      return {
        ...item,
        participation: participationData ? {
          id: participationData.id,
          ticket_code: participationData.ticket_code,
          contest_id: participationData.contest_id,
          user_id: participationData.user_id,
        } : null,
        contest,
      }
    })
  )

  // Filtrar nulls (quando não passou no filtro de concurso)
  return paymentsWithDetails.filter((p): p is PaymentWithDetails => p !== null)
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

  stats.averagePayment = stats.totalPayments > 0 
    ? stats.totalRevenue / payments.filter(p => p.status === 'paid').length 
    : 0

  return stats
}
