/**
 * MODIFIQUEI AQUI - Pool de premiação (base dos percentuais TOP/SECOND/LOWEST/ADMIN)
 * quando o concurso tem prêmio adicional fixo opcional.
 */
import type { Contest } from '../types'

export type ContestPrizeExtraFields = Pick<Contest, 'has_extra_prize' | 'extra_prize_amount'>

/**
 * MODIFIQUEI AQUI - Total arrecadado (pagamentos) + valor extra fixo, se a opção estiver ativa.
 * Se has_extra_prize for false, retorna apenas totalArrecadado (comportamento anterior).
 */
export function getPrizePoolTotalForContest(
  totalArrecadado: number,
  contest: ContestPrizeExtraFields | null | undefined
): number {
  const base = Number(totalArrecadado)
  const safeBase = Number.isFinite(base) ? base : 0
  if (!contest?.has_extra_prize) {
    return safeBase
  }
  const extra = Number(contest.extra_prize_amount)
  const safeExtra = Number.isFinite(extra) && extra > 0 ? extra : 0
  return safeBase + safeExtra
}

/**
 * MODIFIQUEI AQUI - Valor extra exibido isoladamente (0 se desativado ou inválido)
 */
export function getExtraPrizeDisplayAmount(contest: ContestPrizeExtraFields | null | undefined): number {
  if (!contest?.has_extra_prize) return 0
  const extra = Number(contest.extra_prize_amount)
  return Number.isFinite(extra) && extra > 0 ? extra : 0
}

/** Mesmos padrões de `reprocessService` / `calculateDrawPayouts` */
export function getRateioPercentagesFromContest(contest: {
  first_place_pct?: number
  second_place_pct?: number
  lowest_place_pct?: number
  admin_fee_pct?: number
}) {
  return {
    top: contest.first_place_pct ?? 65,
    second: contest.second_place_pct ?? 10,
    lowest: contest.lowest_place_pct ?? 7,
    admin: contest.admin_fee_pct ?? 18,
  }
}

/** Valores de cada faixa = % × premiação total (igual rateioCalculator sobre o pool) */
export function getCategoryPrizeAmountsFromPool(
  prizePoolTotal: number,
  contest: { first_place_pct?: number; second_place_pct?: number; lowest_place_pct?: number }
) {
  const pool = Number.isFinite(prizePoolTotal) ? Math.max(0, prizePoolTotal) : 0
  const p = getRateioPercentagesFromContest(contest)
  return {
    topAmount: (pool * p.top) / 100,
    secondAmount: (pool * p.second) / 100,
    lowestAmount: (pool * p.lowest) / 100,
    pctTop: p.top,
    pctSecond: p.second,
    pctLowest: p.lowest,
  }
}
