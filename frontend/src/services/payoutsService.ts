/**
 * Serviço de acesso a dados de prêmios (payouts)
 * FASE 4: Sorteios e Rateio
 * 
 * MODIFIQUEI AQUI - Serviço para buscar prêmios de participações
 */
import { supabase } from '../lib/supabase'

export interface DrawPayout {
  id: string
  draw_id: string
  contest_id: string
  participation_id: string
  user_id: string
  category: 'TOP' | 'SECOND' | 'LOWEST' | 'NONE'
  score: number
  amount_won: number
  processed_at: string
}

/**
 * Busca prêmios de uma participação em um sorteio específico
 * MODIFIQUEI AQUI - Função para buscar prêmio de participação em sorteio
 */
export async function getPayoutByParticipationAndDraw(
  participationId: string,
  drawId: string
): Promise<DrawPayout | null> {
  const { data, error } = await supabase
    .from('draw_payouts')
    .select('*')
    .eq('participation_id', participationId)
    .eq('draw_id', drawId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Não encontrado
    }
    throw new Error(`Erro ao buscar prêmio: ${error.message}`)
  }

  return data
}

/**
 * Busca todos os prêmios de uma participação (todos os sorteios)
 * MODIFIQUEI AQUI - Função para buscar todos os prêmios de uma participação
 */
export async function getPayoutsByParticipation(
  participationId: string
): Promise<DrawPayout[]> {
  const { data, error } = await supabase
    .from('draw_payouts')
    .select('*')
    .eq('participation_id', participationId)
    .order('processed_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar prêmios: ${error.message}`)
  }

  return data || []
}

/**
 * Busca todos os prêmios de um sorteio
 * MODIFIQUEI AQUI - Função para buscar prêmios de um sorteio
 */
export async function getPayoutsByDraw(drawId: string): Promise<DrawPayout[]> {
  const { data, error } = await supabase
    .from('draw_payouts')
    .select('*')
    .eq('draw_id', drawId)
    .order('amount_won', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar prêmios do sorteio: ${error.message}`)
  }

  return data || []
}

/**
 * Busca resumo de categorias premiadas de um sorteio
 * MODIFIQUEI AQUI - Função para buscar resumo de categorias premiadas
 */
export async function getDrawPayoutSummary(drawId: string): Promise<{
  maxScore: number
  categories: {
    TOP: { score: number; winnersCount: number; amountPerWinner: number } | null
    SECOND: { score: number; winnersCount: number; amountPerWinner: number } | null
    LOWEST: { score: number; winnersCount: number; amountPerWinner: number } | null
  }
}> {
  const payouts = await getPayoutsByDraw(drawId)

  if (payouts.length === 0) {
    return {
      maxScore: 0,
      categories: {
        TOP: null,
        SECOND: null,
        LOWEST: null,
      },
    }
  }

  // Encontrar maior pontuação
  const maxScore = Math.max(...payouts.map(p => p.score))

  // Agrupar por categoria
  const topPayouts = payouts.filter(p => p.category === 'TOP' && p.amount_won > 0)
  const secondPayouts = payouts.filter(p => p.category === 'SECOND' && p.amount_won > 0)
  const lowestPayouts = payouts.filter(p => p.category === 'LOWEST' && p.amount_won > 0)

  return {
    maxScore,
    categories: {
      TOP: topPayouts.length > 0 ? {
        score: topPayouts[0].score,
        winnersCount: topPayouts.length,
        amountPerWinner: topPayouts[0].amount_won,
      } : null,
      SECOND: secondPayouts.length > 0 ? {
        score: secondPayouts[0].score,
        winnersCount: secondPayouts.length,
        amountPerWinner: secondPayouts[0].amount_won,
      } : null,
      LOWEST: lowestPayouts.length > 0 ? {
        score: lowestPayouts[0].score,
        winnersCount: lowestPayouts.length,
        amountPerWinner: lowestPayouts[0].amount_won,
      } : null,
    },
  }
}

/**
 * Interface para ganhador recente com informações completas
 */
export interface RecentWinner {
  id: string
  draw_id: string
  contest_id: string
  participation_id: string
  user_id: string
  category: 'TOP' | 'SECOND' | 'LOWEST' | 'NONE'
  score: number
  amount_won: number
  processed_at: string
  // Campos relacionados (joins)
  user_name?: string
  user_phone?: string
  contest_name?: string
  draw_date?: string
}

/**
 * Busca ganhadores recentes (categoria TOP com prêmio > 0)
 * Usado para notificar admins no Dashboard
 *
 * @param limit Quantidade máxima de ganhadores a retornar (padrão: 10)
 * @returns Lista de ganhadores recentes com informações do usuário e concurso
 */
export async function getRecentWinners(limit: number = 10): Promise<RecentWinner[]> {
  // Buscar payouts TOP com valor > 0, ordenados por data de processamento
  // Nota: Não podemos usar join direto profiles:user_id porque não há FK constraint
  const { data: payouts, error } = await supabase
    .from('draw_payouts')
    .select(`
      *,
      draws:draw_id (draw_date),
      contests:contest_id (name)
    `)
    .eq('category', 'TOP')
    .gt('amount_won', 0)
    .order('processed_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Erro ao buscar ganhadores recentes:', error)
    throw new Error(`Erro ao buscar ganhadores: ${error.message}`)
  }

  if (!payouts || payouts.length === 0) {
    return []
  }

  // Buscar perfis dos usuários separadamente
  const userIds = [...new Set(payouts.map(p => p.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, phone')
    .in('id', userIds)

  // Criar mapa de perfis para lookup rápido
  const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

  // Mapear os dados para o formato esperado
  return payouts.map((p: any) => {
    const profile = profilesMap.get(p.user_id)
    return {
      id: p.id,
      draw_id: p.draw_id,
      contest_id: p.contest_id,
      participation_id: p.participation_id,
      user_id: p.user_id,
      category: p.category,
      score: p.score,
      amount_won: p.amount_won,
      processed_at: p.processed_at,
      user_name: profile?.name || 'Usuário',
      user_phone: profile?.phone || '',
      contest_name: p.contests?.name || 'Concurso',
      draw_date: p.draws?.draw_date || '',
    }
  })
}

/**
 * Conta o total de ganhadores TOP pendentes de revisão
 * (processados nas últimas 24 horas)
 */
export async function countRecentWinners(): Promise<number> {
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const { count, error } = await supabase
    .from('draw_payouts')
    .select('*', { count: 'exact', head: true })
    .eq('category', 'TOP')
    .gt('amount_won', 0)
    .gte('processed_at', oneDayAgo.toISOString())

  if (error) {
    console.error('Erro ao contar ganhadores:', error)
    return 0
  }

  return count || 0
}
