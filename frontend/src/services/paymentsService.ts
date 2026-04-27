/**
 * Serviço de acesso a dados de pagamentos
 * FASE 3: Pagamentos e Ativação
 * 
 * Funções para criar e gerenciar pagamentos
 */
import { supabase } from '../lib/supabase'
import type { ParticipationStatus } from '../types'
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

  const existing = await getPaymentsByParticipation(params.participationId)
  const paidCash = existing.find((p) => p.status === 'paid' && p.payment_method === 'cash')

  if (paidCash) {
    const { data, error } = await supabase
      .from('payments')
      .update({
        amount: params.amount,
        paid_at: new Date().toISOString(),
        external_data: params.notes ? { notes: params.notes } : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paidCash.id)
      .select('*')
      .maybeSingle()

    if (error) {
      if (error.code === '42501') {
        throw new Error('Você não tem permissão para atualizar este pagamento')
      }
      throw new Error(`Erro ao atualizar pagamento em dinheiro: ${error.message}`)
    }
    if (!data) throw new Error('Pagamento em dinheiro não encontrado após atualização')
    return data
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      participation_id: params.participationId,
      amount: params.amount,
      status: 'paid',
      payment_method: 'cash',
      paid_at: new Date().toISOString(),
      external_data: params.notes ? { notes: params.notes } : null,
    })
    .select('*')
    .maybeSingle()

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para criar este pagamento')
    }
    throw new Error(`Erro ao registrar pagamento: ${error.message}`)
  }

  if (!data) throw new Error('Pagamento não retornado após inserção')
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
    status?: ParticipationStatus
  } | null
  contest?: {
    id: string
    name: string
  } | null
}

function dedupeLatestPaidPerParticipation(payments: PaymentWithDetails[]): PaymentWithDetails[] {
  const sorted = [...payments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const byPid = new Map<string, PaymentWithDetails>()
  for (const p of sorted) {
    if (!byPid.has(p.participation_id)) byPid.set(p.participation_id, p)
  }
  return Array.from(byPid.values())
}

/** Pagamentos pagos que contam para arrecadação no bolão: só bilhetes já ativos; um valor por participação (último pago). */
function paymentsEligibleForBolaoTotals(payments: PaymentWithDetails[]): PaymentWithDetails[] {
  const paidActive = payments.filter(
    (p) =>
      p.status === 'paid' &&
      p.participation &&
      p.participation.status === 'active'
  )
  return dedupeLatestPaidPerParticipation(paidActive)
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
        status,
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
        status: participationData.status as ParticipationStatus | undefined,
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
 * Soma dos valores efetivamente pagos no bolão (bilhetes ativos, último pago por participação).
 * RPC `sum_bolao_collected_public` (visitantes/admin); fallback via listAllPayments se precisar.
 */
export async function sumBolaoCollectedForContest(contestId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('sum_bolao_collected_public', {
    p_contest_id: contestId,
  })
  if (!error && data != null) {
    const n = Number(data)
    return Number.isFinite(n) ? n : null
  }

  try {
    const payments = await listAllPayments({ contestId })
    return paymentsEligibleForBolaoTotals(payments).reduce((sum, p) => sum + Number(p.amount), 0)
  } catch {
    return null
  }
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

  console.log('[checkPixPaymentStatus] 🔍 Verificando pagamento:', externalId)

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
  console.log('[checkPixPaymentStatus] 📊 Total payments encontrados:', list.length, list.map(p => ({ id: p.id, status: p.status, hasParticipation: !!p.participation_id })))
  
  const paidPayments = list.filter((p) => p.status === 'paid')
  console.log('[checkPixPaymentStatus] 💰 Payments pagos:', paidPayments.length)

  if (paidPayments.length === 0) {
    return { paid: false, ticketCodes: [] }
  }

  // 🔍 VERIFICAÇÃO CRUCIAL: Todos os payments pagos devem ter participação criada
  const paymentsWithParticipation = paidPayments.filter(p => p.participation_id && p.participations)
  console.log('[checkPixPaymentStatus] 🎫 Payments com participação:', paymentsWithParticipation.length, 'de', paidPayments.length)

  // Se nem todos os payments pagos têm participação ainda, aguardar mais
  if (paymentsWithParticipation.length < paidPayments.length) {
    console.log('[checkPixPaymentStatus] ⏳ Aguardando criação de todas as participações...')
    return { paid: false, ticketCodes: [] }
  }

  const ticketCodes: string[] = []
  let contestId: string | undefined

  for (const p of paymentsWithParticipation) {
    const part = Array.isArray(p.participations) ? p.participations[0] : p.participations
    console.log('[checkPixPaymentStatus] 🎫 Processando payment:', p.id, 'participation:', part)
    
    if (part?.ticket_code) {
      ticketCodes.push(part.ticket_code)
      if (!contestId && part.contest_id) {
        contestId = part.contest_id
      }
    }
  }

  console.log('[checkPixPaymentStatus] ✅ Resultado final:', { paid: true, ticketCodes, contestId })

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
  const payments = await listAllPayments(filters)
  const bolaoPaid = paymentsEligibleForBolaoTotals(payments)

  const stats: FinancialStats = {
    totalRevenue: 0,
    totalPayments: bolaoPaid.length,
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

  bolaoPaid.forEach((payment) => {
    stats.totalRevenue += payment.amount
    const method = payment.payment_method
    if (method === 'pix') stats.revenueByMethod.pix += payment.amount
    else if (method === 'cash') stats.revenueByMethod.cash += payment.amount
    else if (method === 'manual') stats.revenueByMethod.manual += payment.amount
  })

  stats.revenueByStatus.paid = stats.totalRevenue

  payments.forEach((payment) => {
    if (payment.status === 'pending') {
      stats.revenueByStatus.pending += payment.amount
    } else if (payment.status === 'cancelled') {
      stats.revenueByStatus.cancelled += payment.amount
    } else if (payment.status === 'refunded') {
      stats.revenueByStatus.refunded += payment.amount
    }
  })

  stats.averagePayment =
    bolaoPaid.length > 0 ? stats.totalRevenue / bolaoPaid.length : 0

  return stats
}
