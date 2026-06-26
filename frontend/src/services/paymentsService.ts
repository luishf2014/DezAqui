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
  /** UUID do cambista ou `'none'` para vendas directas (sem cambista) */
  sellerId?: string
}

export interface PaymentWithDetails extends Payment {
  participation?: {
    id: string
    ticket_code?: string
    contest_id: string
    user_id: string
    status?: ParticipationStatus
    /** MODIFIQUEI AQUI: bilhetes bonificados ficam de fora da arrecadação */
    is_bonus?: boolean
  } | null
  contest?: {
    id: string
    name: string
  } | null
  seller?: {
    id: string
    name: string
  } | null
  /** Bilhete pendente registado mas ainda sem linha em payments (ex.: venda em dinheiro) */
  awaitingValidation?: boolean
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
      p.participation.status === 'active' &&
      !p.participation.is_bonus
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

function mapPaymentRow(item: Record<string, unknown>): PaymentWithDetails {
  const participationData = Array.isArray(item.participations)
    ? (item.participations[0] as Record<string, unknown> | undefined) || null
    : (item.participations as Record<string, unknown> | null)

  const intentData = Array.isArray(item.pix_payment_intents)
    ? (item.pix_payment_intents[0] as Record<string, unknown> | undefined) || null
    : (item.pix_payment_intents as Record<string, unknown> | null)

  const contestFromParticipation = participationData?.contests
    ? (Array.isArray(participationData.contests)
        ? participationData.contests[0]
        : participationData.contests) as { id: string; name: string }
    : null

  const contestFromIntent = intentData?.contests
    ? (Array.isArray(intentData.contests)
        ? intentData.contests[0]
        : intentData.contests) as { id: string; name: string }
    : null

  const referrerData = participationData?.referrer
    ? (Array.isArray(participationData.referrer)
        ? participationData.referrer[0]
        : participationData.referrer) as { id: string; name?: string }
    : null

  const contestData = contestFromParticipation ?? contestFromIntent

  return {
    ...(item as Payment),
    participation: participationData
      ? {
          id: String(participationData.id),
          ticket_code: participationData.ticket_code as string | undefined,
          contest_id: String(participationData.contest_id),
          user_id: String(participationData.user_id),
          status: participationData.status as ParticipationStatus | undefined,
          is_bonus: Boolean(participationData.is_bonus),
        }
      : null,
    contest: contestData
      ? { id: String(contestData.id), name: String(contestData.name) }
      : null,
    seller: referrerData
      ? { id: String(referrerData.id), name: String(referrerData.name ?? 'Cambista') }
      : null,
  }
}

/** Participações pendentes (dinheiro) ainda sem registo em payments — aparecem no financeiro, não na arrecadação. */
async function listPendingParticipationsAwaitingPayment(
  filters?: PaymentFilters
): Promise<PaymentWithDetails[]> {
  if (filters?.status && filters.status !== 'pending') return []
  if (filters?.paymentMethod && filters.paymentMethod !== 'cash') return []

  let query = supabase
    .from('participations')
    .select(`
      id,
      ticket_code,
      contest_id,
      user_id,
      status,
      is_bonus,
      amount,
      created_at,
      updated_at,
      referred_by_profile_id,
      contests ( id, name ),
      referrer:referred_by_profile_id ( id, name )
    `)
    .eq('status', 'pending')
    .eq('is_bonus', false)

  if (filters?.contestId) {
    query = query.eq('contest_id', filters.contestId)
  }
  if (filters?.sellerId === 'none') {
    query = query.is('referred_by_profile_id', null)
  } else if (filters?.sellerId) {
    query = query.eq('referred_by_profile_id', filters.sellerId)
  }
  if (filters?.startDate) {
    query = query.gte(
      'created_at',
      /^\d{4}-\d{2}-\d{2}$/.test(filters.startDate)
        ? `${filters.startDate}T00:00:00.000`
        : filters.startDate
    )
  }
  if (filters?.endDate) {
    query = query.lte('created_at', normalizeEndDate(filters.endDate))
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) {
    throw new Error(`Erro ao buscar bilhetes pendentes: ${error.message}`)
  }

  const rows = (data || []) as Record<string, unknown>[]
  if (rows.length === 0) return []

  const participationIds = rows.map((r) => String(r.id))
  const { data: existingPayments } = await supabase
    .from('payments')
    .select('participation_id')
    .in('participation_id', participationIds)

  const withPayment = new Set(
    (existingPayments || [])
      .map((p) => p.participation_id)
      .filter((id): id is string => Boolean(id))
  )

  return rows
    .filter((row) => !withPayment.has(String(row.id)))
    .map((row) => {
      const contestRaw = row.contests
      const contest = contestRaw
        ? (Array.isArray(contestRaw) ? contestRaw[0] : contestRaw) as { id: string; name: string }
        : null
      const referrerRaw = row.referrer
      const referrer = referrerRaw
        ? (Array.isArray(referrerRaw) ? referrerRaw[0] : referrerRaw) as { id: string; name?: string }
        : null

      return {
        id: `awaiting-${String(row.id)}`,
        participation_id: String(row.id),
        amount: Number(row.amount ?? 0),
        status: 'pending' as const,
        payment_method: 'cash' as const,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at ?? row.created_at),
        awaitingValidation: true,
        participation: {
          id: String(row.id),
          ticket_code: row.ticket_code as string | undefined,
          contest_id: String(row.contest_id),
          user_id: String(row.user_id),
          status: 'pending' as ParticipationStatus,
          is_bonus: false,
        },
        contest: contest ? { id: String(contest.id), name: String(contest.name) } : null,
        seller: referrer
          ? { id: String(referrer.id), name: String(referrer.name ?? 'Cambista') }
          : null,
      }
    })
}

function isUnpaidPixAttempt(p: PaymentWithDetails): boolean {
  return p.status === 'pending' && p.payment_method === 'pix'
}

/** Entradas que contam para o histórico financeiro admin (Pix não pago fica de fora). */
function financeHistoryEntries(payments: PaymentWithDetails[]): PaymentWithDetails[] {
  return payments.filter((p) => !isUnpaidPixAttempt(p))
}

export async function listAllPayments(filters?: PaymentFilters): Promise<PaymentWithDetails[]> {
  let participationIds: string[] | null = null
  if (filters?.contestId || filters?.sellerId) {
    let participationQuery = supabase.from('participations').select('id')

    if (filters.contestId) {
      participationQuery = participationQuery.eq('contest_id', filters.contestId)
    }
    if (filters.sellerId === 'none') {
      participationQuery = participationQuery.is('referred_by_profile_id', null)
    } else if (filters.sellerId) {
      participationQuery = participationQuery.eq('referred_by_profile_id', filters.sellerId)
    }

    const { data: participationsData, error: participationError } = await participationQuery
    if (participationError) {
      throw new Error(`Erro ao filtrar participações: ${participationError.message}`)
    }

    participationIds = (participationsData || []).map((p) => p.id)
    if (participationIds.length === 0) {
      return []
    }
  }

  let query = supabase
    .from('payments')
    .select(`
      *,
      participations (
        id,
        ticket_code,
        contest_id,
        user_id,
        status,
        is_bonus,
        referred_by_profile_id,
        contests (
          id,
          name
        ),
        referrer:referred_by_profile_id (
          id,
          name
        )
      ),
      pix_payment_intents (
        id,
        contest_id,
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

  const rows = (data || []) as Record<string, unknown>[]

  const paymentsWithDetails = rows.map(mapPaymentRow)

  const awaitingCash = await listPendingParticipationsAwaitingPayment(filters)

  const merged = financeHistoryEntries(
    [...paymentsWithDetails, ...awaitingCash].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  )

  return merged
}

/**
 * Soma dos valores efetivamente pagos no bolão (bilhetes ativos, último pago por participação).
 * RPC `sum_bolao_collected_public` (visitantes/admin); fallback via listAllPayments se precisar.
 */
export async function sumBolaoCollectedForContest(contestId: string): Promise<number | null> {
  const rpcOnce = async (): Promise<number | null> => {
    const { data, error } = await supabase.rpc('sum_bolao_collected_public', {
      p_contest_id: contestId,
    })
    if (!error && data != null) {
      const n = Number(data)
      return Number.isFinite(n) ? n : null
    }
    return null
  }

  let summed = await rpcOnce()
  if (summed === null) {
    await new Promise((r) => setTimeout(r, 400))
    summed = await rpcOnce()
  }
  if (summed !== null) {
    return summed
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
