/**
 * Calculadora de Ranking Centralizada
 * FONTE UNICA DE VERDADE para todas as colunas do ranking
 *
 * Todas as UI devem usar este resultado:
 * - hitNumbers: numeros acertados
 * - score: pontuacao cumulativa
 * - category: TOP/SECOND/LOWEST/NONE
 * - isWinner: se eh premiado
 * - prizeValue: valor do premio
 * - highlightRow: faixa amarela
 * - medal: emoji da medalha
 */

import { Participation, Draw, Contest } from '../types'
import { calculateHits, getAllHitNumbers, calculateTotalScore } from './rankingHelpers'

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
}

/**
 * Calcula ranking completo com fonte unica de verdade
 * TODAS as colunas da UI devem usar este resultado
 */
export function calculateRanking(config: RankingConfig): RankingResult {
  const { contest, participations, draws, selectedDrawId, totalCollected } = config
  const N = contest.numbers_per_participation || 0

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

  // 4. Calcular dados base para cada participacao
  const entriesBase = participations.map((p) => {
    const validDraws = getValidDrawsFor(p.created_at)
    const hitNumbers = getAllHitNumbers(p.numbers, validDraws, p.created_at)
    const score = calculateTotalScore(p.numbers, validDraws, p.created_at)

    // Verificar se atingiu TOP (todos em um sorteio)
    const isTop = validDraws.some(
      (draw) => calculateHits(draw.numbers, p.numbers) === p.numbers.length
    )

    // Verificar se atingiu SECOND (N-1 em um sorteio)
    const isSecond = validDraws.some(
      (draw) => calculateHits(draw.numbers, p.numbers) === p.numbers.length - 1
    )

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
      isSecond,
    }
  })

  // 5. Classificar categorias (TOP > SECOND > LOWEST)
  const topWinnerIds = new Set(
    entriesBase.filter((e) => e.isTop).map((e) => e.participationId)
  )
  const secondWinnerIds = new Set(
    entriesBase
      .filter((e) => !topWinnerIds.has(e.participationId) && e.isSecond)
      .map((e) => e.participationId)
  )

  // LOWEST: menor score positivo excluindo TOP e SECOND
  const othersWithScore = entriesBase.filter(
    (e) =>
      !topWinnerIds.has(e.participationId) &&
      !secondWinnerIds.has(e.participationId) &&
      e.score > 0
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

  return { entries, summary }
}

/**
 * Cria um Map para lookup rapido por participationId
 */
export function createRankingMap(entries: RankingEntry[]): Map<string, RankingEntry> {
  const map = new Map<string, RankingEntry>()
  entries.forEach((e) => map.set(e.participationId, e))
  return map
}
