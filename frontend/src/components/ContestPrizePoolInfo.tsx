/**
 * Premiação do bolão (3 colunas). Sempre visível; prêmio adicional só entra no resumo quando existir.
 */
import { Contest } from '../types'
import {
  getCategoryPrizeAmountsFromPool,
  getExtraPrizeDisplayAmount,
  getPrizePoolTotalForContest,
  getRateioPercentagesFromContest,
} from '../utils/contestPrizePool'

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type Props = {
  contest: Contest
  variant?: 'banner' | 'compact'
  showAmounts?: boolean
  participationsCount?: number
}

export default function ContestPrizePoolInfo({
  contest,
  variant = 'banner',
  showAmounts = false,
  participationsCount,
}: Props) {
  const extra = getExtraPrizeDisplayAmount(contest)
  const hasExtra = extra > 0

  const { top: pctTop, second: pctSecond, lowest: pctLowest, admin: pctAdmin } =
    getRateioPercentagesFromContest(contest)

  const pv = Number(contest.participation_value) || 0
  const canEstimate =
    participationsCount !== undefined && participationsCount >= 0 && pv > 0
  const baseArrecadado = canEstimate ? participationsCount * pv : 0
  const poolTotal = getPrizePoolTotalForContest(baseArrecadado, contest)
  const adminFeeAmount = (poolTotal * pctAdmin) / 100

  const amounts = showAmounts ? getCategoryPrizeAmountsFromPool(poolTotal, contest) : null

  const n = Math.max(1, Number(contest.numbers_per_participation) || 1)
  const secondLabel = n > 1 ? `${n - 1} PONTOS` : '2º FAIXA'

  const isCompact = variant === 'compact'
  const titleClass = isCompact
    ? 'text-[10px] sm:text-xs font-semibold uppercase tracking-[0.12em] text-[#1F1F1F]/90 text-center px-2 pt-3 pb-2.5'
    : 'text-xs sm:text-sm font-semibold uppercase tracking-[0.14em] text-[#1F1F1F]/90 text-center px-3 pt-4 pb-3'
  const headClass = isCompact
    ? 'font-bold text-[10px] sm:text-xs text-[#1F1F1F] mb-1 sm:mb-1.5 leading-tight'
    : 'font-bold text-xs sm:text-sm text-[#1F1F1F] mb-1.5 sm:mb-2'
  const valueClass = isCompact
    ? 'font-bold text-[11px] sm:text-xs text-[#1E7F43] tabular-nums mb-0.5'
    : 'font-bold text-sm sm:text-base text-[#1E7F43] tabular-nums mb-1'
  const subClass = isCompact
    ? 'text-[9px] sm:text-[10px] text-[#1F1F1F]/55 leading-snug mt-0.5 px-0.5'
    : 'text-[10px] sm:text-xs text-[#1F1F1F]/55 leading-snug mt-1 px-1'

  const col = (title: string, pct: number, amountMoney: number | undefined) => (
    <div
      className={`flex flex-col items-center justify-center text-center px-1.5 sm:px-3 min-w-0 ${
        showAmounts
          ? isCompact
            ? 'py-3 bg-gradient-to-b from-white to-[#FAFAFA]'
            : 'py-4 sm:py-5 bg-gradient-to-b from-white to-[#F8FAF9]'
          : isCompact
            ? 'py-2.5 sm:py-4'
            : 'py-4 sm:py-5'
      }`}
    >
      <div className={headClass}>{title}</div>
      {showAmounts && amountMoney !== undefined && <div className={valueClass}>{fmt(amountMoney)}</div>}
      <p className={subClass}>{pct}% do valor total do bolão</p>
    </div>
  )

  const outerClass = isCompact
    ? `rounded-xl border mb-3 overflow-hidden ${
        showAmounts
          ? 'border-[#1E7F43]/20 shadow-md shadow-[#1E7F43]/5'
          : 'border-[#D1D1D1] shadow-sm'
      }`
    : `rounded-2xl mb-6 sm:mb-8 overflow-hidden ${
        showAmounts
          ? 'border border-[#1E7F43]/20 shadow-lg shadow-[#1E7F43]/8'
          : 'border border-[#D1D1D1] shadow-sm'
      }`

  return (
    <div className={`${outerClass} bg-white`}>
      <div
        className={showAmounts ? 'bg-gradient-to-r from-[#1E7F43]/10 via-white to-[#3CCB7F]/10' : undefined}
      >
        <h3 className={titleClass}>Premiação do bolão</h3>
      </div>

      {showAmounts && (
        <div
          className={
            isCompact
              ? 'border-t border-[#E5E5E5] bg-gradient-to-b from-[#F6FAF8] to-[#EFF5F2] px-2.5 py-3'
              : 'border-t border-[#E5E5E5] bg-gradient-to-b from-[#F6FAF8] to-[#EDF3F0] px-3 py-4 sm:px-5 sm:py-5'
          }
        >
          <p
            className={
              isCompact
                ? 'text-[9px] font-semibold uppercase tracking-wider text-[#1E7F43]/75 mb-2.5 text-center'
                : 'text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#1E7F43]/80 mb-3 sm:mb-4 text-center sm:text-left'
            }
          >
            Resumo financeiro
          </p>

          <div
            className={
              hasExtra
                ? isCompact
                  ? 'grid grid-cols-2 gap-2'
                  : 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3'
                : 'grid grid-cols-1 gap-2 sm:gap-3'
            }
          >
            <div className="rounded-lg bg-white/95 border border-[#E3E8E5] px-3 py-2.5 shadow-sm">
              <p className="text-[9px] sm:text-[10px] text-[#1F1F1F]/50 mb-1 leading-tight">
                Arrecadação estimada (cotas)
              </p>
              <p className="text-sm font-bold tabular-nums text-[#1F1F1F]">{fmt(baseArrecadado)}</p>
            </div>
            {hasExtra && (
              <div className="rounded-lg bg-white/95 border border-[#E3E8E5] px-3 py-2.5 shadow-sm">
                <p className="text-[9px] sm:text-[10px] text-[#1F1F1F]/50 mb-1 leading-tight">Valor adicional</p>
                <p className="text-sm font-bold tabular-nums text-[#1F1F1F]">{fmt(extra)}</p>
              </div>
            )}
          </div>

          <div
            className={
              isCompact
                ? 'mt-2.5 rounded-xl bg-gradient-to-br from-[#1E7F43]/15 via-[#1E7F43]/8 to-[#3CCB7F]/10 border border-[#1E7F43]/25 px-3 py-3 text-center shadow-sm'
                : 'mt-3 sm:mt-4 rounded-2xl bg-gradient-to-br from-[#1E7F43]/12 via-[#1E7F43]/6 to-[#3CCB7F]/12 border border-[#1E7F43]/20 px-4 py-4 sm:px-5 sm:py-4 text-center sm:text-left shadow-sm'
            }
          >
            <p
              className={
                isCompact
                  ? 'text-[9px] text-[#1F1F1F]/60 mb-1'
                  : 'text-[10px] sm:text-xs text-[#1F1F1F]/60 mb-1.5'
              }
            >
              {hasExtra
                ? 'Premiação total (arrecadação + adicional)'
                : 'Premiação total (arrecadação)'}
            </p>
            <p
              className={
                isCompact
                  ? 'text-xl font-extrabold tabular-nums text-[#1E7F43] tracking-tight'
                  : 'text-2xl sm:text-3xl font-extrabold tabular-nums text-[#1E7F43] tracking-tight'
              }
            >
              {fmt(poolTotal)}
            </p>
          </div>

          <div
            className={
              isCompact
                ? 'mt-2 flex flex-col gap-0.5 rounded-lg border border-dashed border-[#1F1F1F]/12 bg-white/60 px-3 py-2'
                : 'mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 rounded-xl border border-dashed border-[#1F1F1F]/10 bg-white/70 px-4 py-3'
            }
          >
            <span
              className={
                isCompact
                  ? 'text-[9px] text-[#1F1F1F]/50'
                  : 'text-[10px] sm:text-xs text-[#1F1F1F]/55'
              }
            >
              Taxa administrativa ({pctAdmin}%)
            </span>
            <span
              className={
                isCompact
                  ? 'text-sm font-bold tabular-nums text-[#1F1F1F]'
                  : 'text-base sm:text-lg font-bold tabular-nums text-[#1F1F1F]'
              }
            >
              {fmt(adminFeeAmount)}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 border-t border-[#E5E5E5] divide-x divide-[#E8E8E8]">
        {col(`${n} PONTOS`, pctTop, amounts?.topAmount)}
        {col(secondLabel, pctSecond, amounts?.secondAmount)}
        {col('MENOS PONTOS', pctLowest, amounts?.lowestAmount)}
      </div>
    </div>
  )
}
