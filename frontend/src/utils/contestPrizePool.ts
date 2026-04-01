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
