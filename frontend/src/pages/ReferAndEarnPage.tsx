/**
 * MODIFIQUEI AQUI — página «Indique e Ganhe» (cliente comum; cambistas não entram).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import CustomSelect from '../components/CustomSelect'
import NumberPicker from '../components/NumberPicker'
import ContestStatusBadge from '../components/ContestStatusBadge'
import { useAuth } from '../contexts/AuthContext'
import { normalizeIsSellerFlag } from '../services/profilesService'
import { listActiveContests } from '../services/contestsService'
import {
  fetchReferIndicateDashboardRpc,
  type ReferIndicateContestProgress,
  type ReferIndicateDashboardPayload,
} from '../services/referIndicateService'
import { redeemReferralFreeCreditParticipation } from '../services/participationsService'
import { formatCurrency } from '../utils/formatters'
import { filterContestsAcceptingParticipations } from '../utils/contestHelpers'
import { buildConcursosShareUrl, shareTelegramUrl, shareWhatsAppUrl } from '../utils/contestShareLink'
import type { Contest } from '../types'

function progressPercent(row: ReferIndicateContestProgress): number {
  if (row.target_sales <= 0) return 0
  return Math.min(100, Math.round((row.current_cycle_sales / row.target_sales) * 100))
}

function progressRewardLabel(row: ReferIndicateContestProgress): string {
  if (row.reward_type === 'free_ticket') {
    return 'Prêmio ao completar: 1 jogo grátis (crédito)'
  }
  const v = row.reward_value ?? 0
  return `Prêmio ao completar: bônus Pix ${formatCurrency(v)}`
}

export default function ReferAndEarnPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const isSeller = normalizeIsSellerFlag(profile?.is_seller)

  const [dash, setDash] = useState<ReferIndicateDashboardPayload | null>(null)
  const [dashLoading, setDashLoading] = useState(true)
  const [dashErr, setDashErr] = useState<string | null>(null)

  /** Bolões que ainda aceitam participação (exclui cancelados, finalizados e «Aguardando Resultado»). */
  const [contests, setContests] = useState<Contest[]>([])
  const [contestsLoading, setContestsLoading] = useState(true)
  const [linkContestId, setLinkContestId] = useState('')
  const [copied, setCopied] = useState(false)

  const [creditSelectedNumbers, setCreditSelectedNumbers] = useState<number[]>([])
  const [creditContestId, setCreditContestId] = useState('')
  const [redeemBusy, setRedeemBusy] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null)

  const loadDash = useCallback(async () => {
    setDashLoading(true)
    setDashErr(null)
    try {
      const d = await fetchReferIndicateDashboardRpc()
      setDash(d)
    } catch (e) {
      setDash(null)
      setDashErr(e instanceof Error ? e.message : 'Erro ao carregar Indique e Ganhe')
    } finally {
      setDashLoading(false)
    }
  }, [])

  const loadContests = useCallback(async () => {
    setContestsLoading(true)
    try {
      const all = await listActiveContests()
      const accepting = filterContestsAcceptingParticipations(all)
      setContests(accepting)
      setLinkContestId((prev) => {
        if (!accepting.length) return ''
        const ok = prev && accepting.some((c) => c.id === prev)
        return ok ? prev : accepting[0].id
      })
      setCreditContestId((prev) => {
        if (!accepting.length) return ''
        const ok = prev && accepting.some((c) => c.id === prev)
        return ok ? prev : accepting[0].id
      })
    } catch {
      setContests([])
    } finally {
      setContestsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user || isSeller) return
    void loadDash()
  }, [authLoading, user, isSeller, loadDash])

  useEffect(() => {
    if (authLoading || !user || isSeller) return
    void loadContests()
  }, [authLoading, user, isSeller, loadContests])

  const contestById = useMemo(() => {
    const map = new Map<string, Contest>()
    for (const c of contests) map.set(c.id, c)
    return map
  }, [contests])

  const contestProgress = dash?.contest_progress ?? []

  const visibleContestProgress = useMemo(() => {
    if (contestsLoading) return []
    const acceptingIds = new Set(contests.map((c) => c.id))
    return contestProgress.filter((row) => acceptingIds.has(row.contest_id))
  }, [contestProgress, contests, contestsLoading])

  const referralCode = dash?.profile.referral_code?.trim() ?? profile?.referral_code?.trim() ?? ''
  const shareUrl = useMemo(() => {
    if (!linkContestId) return ''
    return buildConcursosShareUrl(linkContestId, referralCode || null)
  }, [linkContestId, referralCode])

  const contestCredit = contests.find((c) => c.id === creditContestId)

  const availableCredits = useMemo(() => {
    const fromDash = dash?.profile.referral_bonus_credits
    if (fromDash != null) return Math.max(0, fromDash)
    return Math.max(0, profile?.referral_bonus_credits ?? 0)
  }, [dash?.profile.referral_bonus_credits, profile?.referral_bonus_credits])

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2400)
    } catch {
      setDashErr('Não foi possível copiar o link.')
    }
  }

  const handleRedeem = async () => {
    if (!creditContestId || !contestCredit) {
      setRedeemMsg('Escolha um bolão.')
      return
    }
    const nums = [...creditSelectedNumbers].sort((a, b) => a - b)
    if (nums.length !== contestCredit.numbers_per_participation) {
      setRedeemMsg(`Selecione exatamente ${contestCredit.numbers_per_participation} número(s) no volante.`)
      return
    }
    if (nums.some((n) => n < contestCredit.min_number || n > contestCredit.max_number)) {
      setRedeemMsg(`Números entre ${contestCredit.min_number} e ${contestCredit.max_number}.`)
      return
    }
    if (redeemBusy) return
    if (availableCredits < 1) {
      setRedeemMsg('Sem jogos grátis disponíveis no momento.')
      return
    }
    const creditsBefore = availableCredits
    setRedeemBusy(true)
    setRedeemMsg(null)
    try {
      const res = await redeemReferralFreeCreditParticipation({
        contestId: creditContestId,
        numbers: nums,
      })
      const freshDash = await fetchReferIndicateDashboardRpc()
      setDash(freshDash)
      await refreshProfile()
      const creditsAfter = freshDash.profile.referral_bonus_credits
      if (creditsAfter >= creditsBefore) {
        setRedeemMsg(
          'O bilhete pode ter sido criado, mas o crédito não foi debitado. Atualize a página ou contacte o suporte.'
        )
        setRedeemBusy(false)
        return
      }
      setRedeemMsg(
        `Jogo grátis criado! Código ${res.ticket_code ?? '(veja em Meus tickets)'} — sem Pix, sem comissão, valor R$ 0,00.`
      )
      setCreditSelectedNumbers([])
      setRedeemBusy(false)
    } catch (e) {
      setRedeemMsg(e instanceof Error ? e.message : 'Falha ao usar jogo grátis')
      setRedeemBusy(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43]" />
        </div>
        <Footer />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (isSeller) {
    return <Navigate to="/meu-link" replace />
  }

  const st = dash?.stats
  const lineShare = 'Indique amigos na DezAqui e acompanhe seus bônus aqui.'
  const waHref = shareUrl ? shareWhatsAppUrl(lineShare, shareUrl) : '#'
  const tgHref = shareUrl ? shareTelegramUrl(lineShare, shareUrl) : '#'

  const last = dash?.last_bonus
  const lastLabel =
    last && typeof last === 'object'
      ? (() => {
          const rt = String((last as Record<string, unknown>).reward_type ?? '')
          if (rt === 'free_ticket') return 'Último: jogo grátis liberado'
          if (rt === 'manual_pix_bonus')
            return `Último: bônus Pix ${formatCurrency(Number((last as Record<string, unknown>).amount_brl ?? 0))} (${String((last as Record<string, unknown>).status ?? '')})`
          return 'Último bônus'
        })()
      : 'Nenhum bônus registado ainda'

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-10 max-w-lg sm:max-w-2xl space-y-6">
      <Link
          to="/contests"
          className="inline-flex text-sm font-bold text-[#1E7F43]"
        >
          ← Voltar aos bolões
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F1F1F] tracking-tight">
            Indique e Ganhe
          </h1>
          <p className="text-sm text-[#1F1F1F]/70 mt-2">
            Cada bolão com meta configurada tem sua própria barra de progresso. Ao atingir a meta, o bônus é gerado e a
            barra recomeça do zero para o próximo ciclo.
          </p>
        </div>

        {dashErr && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {dashErr}
          </div>
        )}

        {/* Progresso por bolão */}
        <section className="rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#1F1F1F]">Progresso por bolão</h2>
            <p className="text-sm text-[#1F1F1F]/65 mt-1">
              Vendas confirmadas no ciclo atual. Ao fechar a meta, o crédito ou bônus Pix é liberado e a contagem zera
              para continuar indicando.
            </p>
          </div>

          {dashLoading || contestsLoading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E7F43]" />
            </div>
          ) : visibleContestProgress.length === 0 ? (
            <p className="text-sm text-[#1F1F1F]/60 rounded-xl border border-dashed border-[#E5E5E5] px-4 py-5 text-center">
              Nenhum bolão aceitando participações com meta de indicação no momento. Quando houver um bolão aberto para
              inscrições, sua barra aparecerá aqui.
            </p>
          ) : (
            <ul className="space-y-4">
              {visibleContestProgress.map((row) => {
                const pct = progressPercent(row)
                const atGoal = row.target_sales > 0 && row.current_cycle_sales === 0 && row.confirmed_sales_total > 0
                const contest = contestById.get(row.contest_id)
                return (
                  <li
                    key={row.contest_id}
                    className="rounded-xl border border-[#EEF1F6] bg-[#FAFBFC] px-4 py-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-2">
                        {contest ? (
                          <ContestStatusBadge contest={contest} variant="card" />
                        ) : null}
                        <h3 className="font-bold text-[#1F1F1F] truncate">{row.contest_name}</h3>
                        <p className="text-xs text-[#1F1F1F]/60">{progressRewardLabel(row)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-extrabold text-[#1E7F43] tabular-nums">
                          {row.current_cycle_sales} / {row.target_sales}
                        </div>
                        <div className="text-[11px] text-[#1F1F1F]/50">vendas neste ciclo</div>
                      </div>
                    </div>

                    <div
                      className="h-3 w-full rounded-full bg-[#E5E7EB] overflow-hidden"
                      role="progressbar"
                      aria-valuenow={row.current_cycle_sales}
                      aria-valuemin={0}
                      aria-valuemax={row.target_sales}
                      aria-label={`Progresso em ${row.contest_name}`}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#1F1F1F]/55">
                      <span>
                        Total no bolão: <strong className="text-[#1F1F1F]">{row.confirmed_sales_total}</strong> venda(s)
                      </span>
                      <span>
                        Metas batidas: <strong className="text-[#1F1F1F]">{row.milestones_reached}</strong>
                      </span>
                      {atGoal && (
                        <span className="text-[#1E7F43] font-semibold">
                          Meta recém-atingida — barra reiniciada para o próximo ciclo
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {[
            { k: 'Indicados', v: dashLoading ? '…' : String(st?.referred_buyers_count ?? '—') },
            { k: 'Vendas confirmadas', v: dashLoading ? '…' : String(st?.confirmed_sales_count ?? '—') },
            { k: 'Bônus gerados', v: dashLoading ? '…' : String(st?.bonuses_generated_count ?? '—') },
            { k: 'Bônus pendentes', v: dashLoading ? '…' : formatCurrency(st?.bonuses_pending_pix_brl ?? 0) },
            { k: 'Bônus pagos', v: dashLoading ? '…' : formatCurrency(st?.bonuses_paid_pix_brl ?? 0) },
            { k: 'Jogos grátis (disp./usados)', v: dashLoading ? '…' : `${st?.free_tickets_available ?? 0} / ${st?.free_tickets_used ?? 0}` },
          ].map((x) => (
            <div
              key={x.k}
              className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-sm"
            >
              <div className="text-[11px] sm:text-xs font-semibold uppercase text-[#1F1F1F]/55">{x.k}</div>
              <div className="text-lg sm:text-xl font-extrabold text-[#1F1F1F] tabular-nums mt-1">{x.v}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#1E7F43]/25 bg-white p-4 sm:p-5 shadow-sm">
          <div className="text-xs font-semibold text-[#1F1F1F]/60 uppercase mb-1">Último bônus recebido</div>
          <p className="text-sm font-bold text-[#1E7F43]">{dashLoading ? '…' : lastLabel}</p>
        </div>

        {/* Link */}
        <section className="rounded-2xl border-2 border-[#F4C430]/35 bg-white p-4 sm:p-6 shadow-md space-y-4">
          <h2 className="text-lg font-bold text-[#1F1F1F]">Seu código e link</h2>
          <div>
            <span className="text-xs font-semibold text-[#1F1F1F]/50 uppercase">Código</span>
            <div className="mt-1 font-mono text-xl font-extrabold text-[#1E7F43] bg-[#F4C430]/20 rounded-xl px-3 py-2">
              {referralCode || '—'}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#1F1F1F]/70">Bolão para o link</label>
            <CustomSelect
              value={linkContestId}
              options={
                contests.length
                  ? contests.map((c) => ({ value: c.id, label: c.name }))
                  : [{ value: '', label: contestsLoading ? 'Carregando…' : 'Nenhum bolão ativo' }]
              }
              onChange={(v: string) => setLinkContestId(v)}
              disabled={contestsLoading}
            />
          </div>
          <input
            readOnly
            className="w-full rounded-xl border border-[#E5E5E5] bg-[#F9F9F9] px-3 py-2.5 text-xs sm:text-sm font-mono"
            value={shareUrl || 'Escolha um bolão ativo'}
          />
          <div className="d-flex flex-column flex-sm-row flex-wrap gap-2">
            <button
              type="button"
              disabled={!shareUrl}
              onClick={() => void copyLink()}
              className="btn btn-success flex-grow-1 fw-bold py-3"
              style={{ backgroundColor: '#1E7F43', borderColor: '#1E7F43' }}
            >
              Copiar link
            </button>
            <a
              href={shareUrl ? waHref : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!shareUrl}
              className={`btn flex-grow-1 fw-bold py-3 d-inline-flex align-items-center justify-content-center gap-2 text-white border-0 ${
                shareUrl ? '' : 'disabled opacity-50 pe-none'
              }`}
              style={shareUrl ? { backgroundColor: '#25D366' } : undefined}
              tabIndex={shareUrl ? 0 : -1}
            >
              <i className="bi bi-whatsapp fs-5" aria-hidden />
              WhatsApp
            </a>
            <a
              href={shareUrl ? tgHref : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!shareUrl}
              className={`btn flex-grow-1 fw-bold py-3 d-inline-flex align-items-center justify-content-center gap-2 text-white border-0 ${
                shareUrl ? '' : 'disabled opacity-50 pe-none'
              }`}
              style={shareUrl ? { backgroundColor: '#229ED9' } : undefined}
              tabIndex={shareUrl ? 0 : -1}
            >
              <i className="bi bi-telegram fs-5" aria-hidden />
              Telegram
            </a>
          </div>
          {copied && <p className="text-sm font-bold text-[#1E7F43]">Link copiado.</p>}
        </section>

        {/* Jogo grátis */}
        {availableCredits > 0 && profile?.is_active !== false && (
          <section className="rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-sm space-y-3">
            <h2 className="text-lg font-bold text-[#1F1F1F]">Usar jogo grátis</h2>
            <p className="text-sm text-[#1F1F1F]/75">
              Você tem <strong>{availableCredits}</strong> crédito(s) disponível(is). Cada confirmação consome{' '}
              <strong>1</strong> crédito e gera <strong>1</strong> bilhete — sem Pix e sem comissão (valor R$ 0,00).
            </p>
            <CustomSelect
              value={creditContestId}
              options={contests.length ? contests.map((c) => ({ value: c.id, label: c.name })) : [{ value: '', label: '—' }]}
              onChange={(v: string) => {
                setCreditContestId(v)
                setCreditSelectedNumbers([])
                setRedeemMsg(null)
              }}
            />
            {contestCredit ? (
              <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-5 shadow-sm">
                <h3 className="text-lg sm:text-xl font-extrabold text-[#1F1F1F] mb-4">
                  Escolha seus números
                </h3>
                <NumberPicker
                  min={contestCredit.min_number}
                  max={contestCredit.max_number}
                  maxSelected={contestCredit.numbers_per_participation}
                  selectedNumbers={creditSelectedNumbers}
                  onChange={setCreditSelectedNumbers}
                />
              </div>
            ) : (
              <p className="text-sm text-[#1F1F1F]/60">Escolha um bolão ativo para abrir o volante.</p>
            )}
            <button
              type="button"
              disabled={redeemBusy || !contestCredit || availableCredits < 1}
              onClick={() => void handleRedeem()}
              className="rounded-xl bg-[#1E7F43] text-white font-bold px-6 py-3 hover:bg-[#3CCB7F] disabled:opacity-50 w-full sm:w-auto min-h-[48px] touch-manipulation"
            >
              {redeemBusy ? '…' : 'Confirmar jogo grátis'}
            </button>
            {redeemMsg && <p className="text-sm text-[#1F1F1F]/85">{redeemMsg}</p>}
          </section>
        )}

        {/* Histórico curto */}
        {dash && dash.recent_rewards.length > 0 && (
          <section className="rounded-2xl border border-[#E5E5E5] bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-[#FAFAFA] font-bold text-[#1F1F1F]">Últimos bônus</div>
            <ul className="divide-y max-h-72 overflow-auto">
              {dash.recent_rewards.map((r) => (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <div className="font-semibold text-[#1F1F1F]">{r.contest_name}</div>
                  <div className="text-xs text-[#1F1F1F]/65">
                    {r.reward_type === 'free_ticket' ? 'Jogo grátis' : `Bônus Pix ${formatCurrency(r.amount_brl ?? 0)}`}{' '}
                    · {r.status === 'paid' ? 'pago via Pix' : r.status === 'pending' ? 'pendente' : 'cancelado'} · meta{' '}
                    {r.sales_milestone_total} vendas
                  </div>
                  {r.admin_payment_note && (
                    <div className="text-[11px] text-[#1F1F1F]/50 mt-1">Obs.: {r.admin_payment_note}</div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
