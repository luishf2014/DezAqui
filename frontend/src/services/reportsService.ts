/**
 * Serviço de relatórios
 * FASE 4: Sorteios e Rateio
 * 
 * Funções para gerar dados de relatórios
 */
import { supabase } from '../lib/supabase'
import { Participation, Contest, Draw, Payment } from '../types'

export interface ReportData {
  contest: Contest
  draw?: Draw | null
  participations: Array<Participation & {
    user: { id: string; name: string; email: string } | null
    payment?: Payment | null
  }>
  draws: Draw[]
  totalParticipants: number
  totalParticipations: number
  totalRevenue: number
  reportType: 'initial' | 'intermediate' | 'final'
  // MODIFIQUEI AQUI - Dados de arrecadação por período
  revenueByPeriod?: {
    date: string
    revenue: number
    participations: number
  }[]
}

/**
 * Busca dados completos para relatório de um concurso
 * MODIFIQUEI AQUI - Função para gerar dados do relatório
 * 
 * @param contestId ID do concurso
 * @param drawId ID do sorteio específico (opcional)
 * @returns Dados completos do relatório
 */
export async function getReportData(contestId: string, drawId?: string): Promise<ReportData> {
  // Buscar concurso
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('*')
    .eq('id', contestId)
    .single()

  if (contestError || !contest) {
    throw new Error('Concurso não encontrado')
  }

  // Buscar todas as participações ATIVAS do concurso
  const { data: participationsData, error: participationsError } = await supabase
    .from('participations')
    .select(`
      *,
      profiles:user_id (
        id,
        name,
        email
      )
    `)
    .eq('contest_id', contestId)
    .eq('status', 'active') // MODIFIQUEI AQUI - Apenas participações ativas
    .order('created_at', { ascending: false })

  if (participationsError) {
    throw new Error(`Erro ao buscar participações: ${participationsError.message}`)
  }

  // Buscar pagamentos para cada participação
  const participationsWithPayments = await Promise.all(
    (participationsData || []).map(async (participation: any) => {
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('participation_id', participation.id)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(1)

      return {
        ...participation,
        user: participation.profiles ? {
          id: participation.profiles.id,
          name: participation.profiles.name,
          email: participation.profiles.email,
        } : null,
        payment: payments && payments.length > 0 ? payments[0] : null,
      }
    })
  )

  // Buscar todos os sorteios do concurso
  const { data: drawsData, error: drawsError } = await supabase
    .from('draws')
    .select('*')
    .eq('contest_id', contestId)
    .order('draw_date', { ascending: false })

  if (drawsError) {
    throw new Error(`Erro ao buscar sorteios: ${drawsError.message}`)
  }

  const draws = (drawsData || []) as Draw[]

  // Buscar sorteio específico se fornecido
  let selectedDraw: Draw | null = null
  if (drawId) {
    selectedDraw = draws.find(d => d.id === drawId) || null
  } else if (draws.length > 0) {
    // Se não especificado, usar o mais recente
    selectedDraw = draws[0]
  }

  // Calcular totais
  const totalParticipants = new Set(participationsWithPayments.map(p => p.user_id)).size
  const totalParticipations = participationsWithPayments.length
  const totalRevenue = participationsWithPayments.reduce((sum, p) => {
    return sum + (p.payment?.amount || 0)
  }, 0)

  // Determinar tipo de relatório
  let reportType: 'initial' | 'intermediate' | 'final' = 'initial'
  if (draws.length > 0) {
    if (contest.status === 'finished') {
      reportType = 'final'
    } else {
      reportType = 'intermediate'
    }
  }

  // MODIFIQUEI AQUI - Calcular arrecadação por período (últimos 30 dias)
  const revenueByPeriod: { date: string; revenue: number; participations: number }[] = []
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - i)
    return date.toISOString().split('T')[0]
  }).reverse()

  last30Days.forEach(dateStr => {
    const dayParticipations = participationsWithPayments.filter(p => {
      const createdDate = new Date(p.created_at).toISOString().split('T')[0]
      return createdDate === dateStr
    })
    const dayRevenue = dayParticipations.reduce((sum, p) => sum + (p.payment?.amount || 0), 0)
    
    // Incluir apenas dias com atividade
    if (dayRevenue > 0 || dayParticipations.length > 0) {
      revenueByPeriod.push({
        date: dateStr,
        revenue: dayRevenue,
        participations: dayParticipations.length,
      })
    }
  })

  return {
    contest,
    draw: selectedDraw,
    participations: participationsWithPayments,
    draws,
    totalParticipants,
    totalParticipations,
    totalRevenue,
    reportType,
    revenueByPeriod,
  }
}

/**
 * Busca dados de arrecadação por período
 * MODIFIQUEI AQUI - Função para relatório de arrecadação por período
 * 
 * @param contestId ID do concurso
 * @param startDate Data inicial (opcional)
 * @param endDate Data final (opcional)
 */
export async function getRevenueByPeriod(
  contestId: string,
  startDate?: string,
  endDate?: string
): Promise<{ date: string; revenue: number; participations: number }[]> {
  let query = supabase
    .from('participations')
    .select(`
      *,
      profiles:user_id (
        id,
        name,
        email
      )
    `)
    .eq('contest_id', contestId)
    .eq('status', 'active')

  if (startDate) {
    query = query.gte('created_at', startDate)
  }
  if (endDate) {
    query = query.lte('created_at', endDate)
  }

  const { data: participationsData, error } = await query.order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Erro ao buscar arrecadação: ${error.message}`)
  }

  // Buscar pagamentos e agrupar por data
  const revenueByDate = new Map<string, { revenue: number; participations: number }>()

  for (const participation of participationsData || []) {
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('participation_id', participation.id)
      .eq('status', 'paid')
      .limit(1)

    const date = new Date(participation.created_at).toISOString().split('T')[0]
    const current = revenueByDate.get(date) || { revenue: 0, participations: 0 }
    
    revenueByDate.set(date, {
      revenue: current.revenue + (payments?.[0]?.amount || 0),
      participations: current.participations + 1,
    })
  }

  return Array.from(revenueByDate.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
