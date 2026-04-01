/**
 * MODIFIQUEI AQUI - Exibe valor adicional de premiação e, quando possível, arrecadação estimada + total da premiação
 */
import { Contest } from '../types'
import { getExtraPrizeDisplayAmount, getPrizePoolTotalForContest } from '../utils/contestPrizePool'

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type Props = {
  contest: Contest
  /** Quantidade de participações ativas (para estimar arrecadação = quantidade × valor da cota) */
  participationsCount?: number
  /** 'banner' = bloco completo na página de detalhes; 'compact' = uma linha em cards / participar */
  variant?: 'banner' | 'compact'
}

export default function ContestPrizePoolInfo({ contest, participationsCount, variant = 'banner' }: Props) {
  const extra = getExtraPrizeDisplayAmount(contest)
  if (!contest.has_extra_prize || extra <= 0) return null

  const pv = Number(contest.participation_value) || 0
  const canEstimate =
    participationsCount !== undefined && participationsCount >= 0 && pv > 0
  const baseArrecadado = canEstimate ? participationsCount * pv : null
  const poolTotal =
    baseArrecadado !== null ? getPrizePoolTotalForContest(baseArrecadado, contest) : null

  if (variant === 'compact') {
    return (
      <div className="rounded-lg border border-[#1E7F43]/25 bg-[#1E7F43]/5 px-3 py-2 text-xs text-[#1F1F1F]/85 mb-3">
        <span className="font-semibold text-[#1E7F43]">Prêmio adicional fixo: {fmt(extra)}</span>
        <span className="block text-[#1F1F1F]/65 mt-0.5 leading-snug">
          Somado à arrecadação das cotas pagas para formar a premiação total do bolão.
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#1E7F43]/30 bg-gradient-to-r from-[#1E7F43]/8 to-[#3CCB7F]/8 p-4 sm:p-5 mb-6 sm:mb-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#1E7F43] mb-2">Premiação do bolão</p>
      {baseArrecadado !== null && poolTotal !== null ? (
        <p className="text-sm text-[#1F1F1F]/90 leading-relaxed">
          <span className="text-[#1F1F1F]/70">Arrecadação estimada (cotas): </span>
          <strong>{fmt(baseArrecadado)}</strong>
          <span className="mx-1.5 text-[#1F1F1F]/45">·</span>
          <span className="text-[#1F1F1F]/70">Valor adicional: </span>
          <strong>{fmt(extra)}</strong>
          <span className="mx-1.5 text-[#1F1F1F]/45">·</span>
          <span className="text-[#1F1F1F]/70">Premiação total (base dos %): </span>
          <strong className="text-[#1E7F43]">{fmt(poolTotal)}</strong>
        </p>
      ) : (
        <div className="text-sm text-[#1F1F1F]/90">
          <p>
            <span className="text-[#1F1F1F]/70">Valor adicional: </span>
            <strong className="text-[#1E7F43]">{fmt(extra)}</strong>
          </p>
          <p className="text-xs text-[#1F1F1F]/65 mt-1">
            A premiação total é a arrecadação das cotas pagas somada a este valor (percentuais aplicados sobre o total).
          </p>
        </div>
      )}
    </div>
  )
}
