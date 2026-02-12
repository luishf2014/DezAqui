/**
 * Calculadora de Ranking Centralizada
 * FONTE UNICA DE VERDADE para todas as colunas do ranking
 *
 * MODELO ACUMULATIVO: Score = numeros UNICOS do bilhete acertados em QUALQUER sorteio.
 * Numeros nao repetem entre sorteios. Score nunca diminui.
 * TOP = acumulou TODOS os N numeros. SECOND = acumulou N-1.
 *
 * Todas as UI devem usar este resultado:
 * - hitNumbers: numeros acertados (unicos de todos os sorteios)
 * - score: quantidade de numeros unicos acertados
 * - category: TOP/SECOND/LOWEST/NONE
 * - isWinner: se eh premiado
 * - prizeValue: valor do premio
 * - highlightRow: faixa amarela
 * - medal: emoji da medalha
 */

import { Participation, Draw, Contest } from '../types'
import { getAllHitNumbers } from './rankingHelpers'

export interface RankingEntry {
  participationId: string
  userId: string
  userName: string
  userEmail?: string
  ticketCode?: string
  numbers: number[]
  createdAt: string

  // Dados calculados (fonte unica)
  hitNumbers: number[]
  hitsCount: number
  score: number

  // Categoria e premiacao
  category: 'TOP' | 'SECOND' | 'LOWEST' | 'NONE'
  isWinner: boolean
  prizeValue: number

  // Exibicao
  highlightRow: boolean
  medal: string | null
  position: number
}

export interface RankingConfig {
  contest: Contest
  participations: Array<Participation & { user?: { id: string; name: string; email: string } | null }>
  draws: Draw[]
  selectedDrawId?: string
  totalCollected: number
}

export interface RankingSummary {
  topWinnersCount: number
  secondWinnersCount: number
  lowestWinnersCount: number
  maxScore: number
  lowestWinningScore: number | null
  hasAnyWinner: boolean
}

export interface RankingResult {
  entries: RankingEntry[]
  summary: RankingSummary
  invalidParticipationsCount: number // MODIFIQUEI AQUI - Participações criadas após o primeiro sorteio
}

/**
 * Calcula ranking completo com fonte unica de verdade
 * TODAS as colunas da UI devem usar este resultado
 */
export function calculateRanking(config: RankingConfig): RankingResult {
  const { contest, participations, draws, selectedDrawId, totalCollected } = config

  // Se nao ha participacoes, retornar vazio
  if (participations.length === 0) {
    return {
      entries: [],
      summary: {
        topWinnersCount: 0,
        secondWinnersCount: 0,
        lowestWinnersCount: 0,
        maxScore: 0,
        lowestWinningScore: null,
        hasAnyWinner: false,
      },
      invalidParticipationsCount: 0,
    }
  }

  // 1. Ordenar draws cronologicamente
  const drawsSortedAsc = [...draws].sort(
    (a, b) => new Date(a.draw_date).getTime() - new Date(b.draw_date).getTime()
  )

  // 2. Filtrar draws ate o selecionado (se houver)
  const getDrawsUpTo = (drawId: string): Draw[] => {
    const idx = drawsSortedAsc.findIndex((d) => d.id === drawId)
    if (idx === -1) return drawsSortedAsc
    return drawsSortedAsc.slice(0, idx + 1)
  }
  const drawsToUse = selectedDrawId ? getDrawsUpTo(selectedDrawId) : drawsSortedAsc

  // 3. Anti-fraude: filtrar draws validos para cada participacao
  const getValidDrawsFor = (createdAt: string): Draw[] => {
    const participationDate = new Date(createdAt)
    return drawsToUse.filter((d) => new Date(d.draw_date) >= participationDate)
  }

  // MODIFIQUEI AQUI - Verificar se participação foi criada após o sorteio selecionado (ou último sorteio)
  // Determinar a data limite: sorteio selecionado ou último sorteio
  let cutoffDate: Date | null = null
  if (selectedDrawId) {
    const selectedDraw = drawsSortedAsc.find(d => d.id === selectedDrawId)
    cutoffDate = selectedDraw ? new Date(selectedDraw.draw_date) : null
  } else if (drawsSortedAsc.length > 0) {
    // Se não há sorteio selecionado, usar o último sorteio
    cutoffDate = new Date(drawsSortedAsc[drawsSortedAsc.length - 1].draw_date)
  }
  
  const isCreatedAfterCutoff = (createdAt: string): boolean => {
    if (!cutoffDate) return false
    return new Date(createdAt) > cutoffDate
  }

  // 4. Separar participações válidas (antes do sorteio limite) das inválidas (após)
  const validParticipations = participations.filter((p) => !isCreatedAfterCutoff(p.created_at))
  const invalidParticipations = participations.filter((p) => isCreatedAfterCutoff(p.created_at))

  // 5. Calcular dados base para cada participacao válida
  const entriesBase = validParticipations.map((p) => {
    const validDraws = getValidDrawsFor(p.created_at)
    const hitNumbers = getAllHitNumbers(p.numbers, validDraws, p.created_at)
    
    // Score = contagem de numeros UNICOS do bilhete acertados em QUALQUER sorteio (acumulativo)
    const score = hitNumbers.length

    // TOP = acumulou TODOS os N numeros unicos
    const isTop = hitNumbers.length === p.numbers.length

    return {
      participationId: p.id,
      userId: p.user_id,
      userName: p.user?.name || 'Anonimo',
      userEmail: p.user?.email,
      ticketCode: p.ticket_code,
      numbers: p.numbers,
      createdAt: p.created_at,
      hitNumbers,
      hitsCount: hitNumbers.length,
      score,
      isTop,
    }
  })

  // 5. Classificar categorias (TOP > SECOND > LOWEST)
  const topWinnerIds = new Set(
    entriesBase.filter((e) => e.isTop).map((e) => e.participationId)
  )

  // SECOND = maior score entre nao-TOP com score > 0 (cascata: se nao tem N-1, vai pra N-2, N-3, etc.)
  const nonTopWithScore = entriesBase.filter(
    (e) => !topWinnerIds.has(e.participationId) && e.score > 0
  )
  const secondScore = nonTopWithScore.length > 0
    ? Math.max(...nonTopWithScore.map((e) => e.score))
    : null
  const secondWinnerIds = new Set(
    secondScore !== null
      ? nonTopWithScore.filter((e) => e.score === secondScore).map((e) => e.participationId)
      : []
  )

  // LOWEST: menor score (>=0) excluindo TOP e SECOND
  const othersWithScore = entriesBase.filter(
    (e) =>
      !topWinnerIds.has(e.participationId) &&
      !secondWinnerIds.has(e.participationId) &&
      e.score >= 0
  )
  const lowestScore =
    othersWithScore.length > 0 ? Math.min(...othersWithScore.map((e) => e.score)) : null
  const lowestWinnerIds = new Set(
    lowestScore !== null
      ? othersWithScore.filter((e) => e.score === lowestScore).map((e) => e.participationId)
      : []
  )

  // 6. Calcular premios por categoria
  const topPct = contest.first_place_pct || 65
  const secondPct = contest.second_place_pct || 10
  const lowestPct = contest.lowest_place_pct || 7

  const topTotal = topWinnerIds.size > 0 ? (totalCollected * topPct) / 100 : 0
  const secondTotal = secondWinnerIds.size > 0 ? (totalCollected * secondPct) / 100 : 0
  const lowestTotal = lowestWinnerIds.size > 0 ? (totalCollected * lowestPct) / 100 : 0

  const topPrizePerWinner = topWinnerIds.size > 0 ? topTotal / topWinnerIds.size : 0
  const secondPrizePerWinner = secondWinnerIds.size > 0 ? secondTotal / secondWinnerIds.size : 0
  const lowestPrizePerWinner = lowestWinnerIds.size > 0 ? lowestTotal / lowestWinnerIds.size : 0

  // 7. Ordenar por score (desc), depois por created_at (asc)
  const sorted = [...entriesBase].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  // 8. Montar resultado final
  const entries: RankingEntry[] = sorted.map((entry, idx) => {
    let category: 'TOP' | 'SECOND' | 'LOWEST' | 'NONE' = 'NONE'
    let prizeValue = 0

    if (topWinnerIds.has(entry.participationId)) {
      category = 'TOP'
      prizeValue = topPrizePerWinner
    } else if (secondWinnerIds.has(entry.participationId)) {
      category = 'SECOND'
      prizeValue = secondPrizePerWinner
    } else if (lowestWinnerIds.has(entry.participationId)) {
      category = 'LOWEST'
      prizeValue = lowestPrizePerWinner
    }

    const isWinner = category !== 'NONE'
    const medal =
      category === 'TOP' ? '🥇' : category === 'SECOND' ? '🥈' : category === 'LOWEST' ? '🥉' : null

    return {
      participationId: entry.participationId,
      userId: entry.userId,
      userName: entry.userName,
      userEmail: entry.userEmail,
      ticketCode: entry.ticketCode,
      numbers: entry.numbers,
      createdAt: entry.createdAt,
      hitNumbers: entry.hitNumbers,
      hitsCount: entry.hitsCount,
      score: entry.score,
      category,
      isWinner,
      prizeValue,
      highlightRow: isWinner,
      medal,
      position: idx + 1,
    }
  })

  // 9. Montar resumo
  const maxScore = entries.length > 0 ? Math.max(...entries.map((e) => e.score)) : 0
  const summary: RankingSummary = {
    topWinnersCount: topWinnerIds.size,
    secondWinnersCount: secondWinnerIds.size,
    lowestWinnersCount: lowestWinnerIds.size,
    maxScore,
    lowestWinningScore: lowestScore,
    hasAnyWinner: topWinnerIds.size > 0 || secondWinnerIds.size > 0 || lowestWinnerIds.size > 0,
  }

  // MODIFIQUEI AQUI - Retornar contagem de participações inválidas (criadas após primeiro sorteio)
  return { entries, summary, invalidParticipationsCount: invalidParticipations.length }
}

/**
 * Cria um Map para lookup rapido por participationId
 */
export function createRankingMap(entries: RankingEntry[]): Map<string, RankingEntry> {
  const map = new Map<string, RankingEntry>()
  entries.forEach((e) => map.set(e.participationId, e))
  return map
}
