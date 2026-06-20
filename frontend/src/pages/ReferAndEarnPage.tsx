/**
 * MODIFIQUEI AQUI — página «Indique e Ganhe» (cliente comum; cambistas não entram).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import CustomSelect from '../components/CustomSelect'
import { useAuth } from '../contexts/AuthContext'
import { normalizeIsSellerFlag } from '../services/profilesService'
import { listActiveContests } from '../services/contestsService'
import {
  fetchReferIndicateDashboardRpc,
  type ReferIndicateDashboardPayload,
} from '../services/referIndicateService'
import { redeemReferralFreeCreditParticipation } from '../services/participationsService'
import { formatCurrency } from '../utils/formatters'
import { buildConcursosShareUrl, shareTelegramUrl, shareWhatsAppUrl } from '../utils/contestShareLink'
import type { Contest } from '../types'

export default function ReferAndEarnPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const isSeller = normalizeIsSellerFlag(profile?.is_seller)

  const [dash, setDash] = useState<ReferIndicateDashboardPayload | null>(null)
  const [dashLoading, setDashLoading] = useState(true)
  const [dashErr, setDashErr] = useState<string | null>(null)

  const [contests, setContests] = useState<Contest[]>([])
  const [contestsLoading, setContestsLoading] = useState(true)
  const [linkContestId, setLinkContestId] = useState('')
  const [copied, setCopied] = useState(false)

  const [creditNumbersRaw, setCreditNumbersRaw] = useState('')
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
      const cs = await listActiveContests()
      setContests(cs)
      setLinkContestId((prev) => {
        if (!cs.length) return ''
        const ok = prev && cs.some((c) => c.id === prev)
        return ok ? prev : cs[0].id
      })
      setCreditContestId((prev) => {
        if (!cs.length) return ''
        const ok = prev && cs.some((c) => c.id === prev)
        return ok ? prev : cs[0].id
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

  const referralCode = dash?.profile.referral_code?.trim() ?? profile?.referral_code?.trim() ?? ''
  const shareUrl = useMemo(() => {
    if (!linkContestId) return ''
    return buildConcursosShareUrl(linkContestId, referralCode || null)
  }, [linkContestId, referralCode])

  const contestCredit = contests.find((c) => c.id === creditContestId)

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
    const nums = creditNumbersRaw
      .split(/[\s,;]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n))
    if (nums.length !== contestCredit.numbers_per_participation) {
      setRedeemMsg(`Informe exatamente ${contestCredit.numbers_per_participation} número(s).`)
      return
    }
    if (nums.some((n) => n < contestCredit.min_number || n > contestCredit.max_number)) {
      setRedeemMsg(`Números entre ${contestCredit.min_number} e ${contestCredit.max_number}.`)
      return
    }
    if ((profile?.referral_bonus_credits ?? 0) < 1) {
      setRedeemMsg('Sem jogos grátis disponíveis no momento.')
      return
    }
    setRedeemBusy(true)
    setRedeemMsg(null)
    try {
      const res = await redeemReferralFreeCreditParticipation({
        contestId: creditContestId,
        numbers: nums,
      })
      setRedeemMsg(
        `Jogo grátis criado! Código ${res.ticket_code ?? '(veja em Meus tickets)'} — sem Pix, sem comissão, valor R$ 0,00.`
      )
      setCreditNumbersRaw('')
      await refreshProfile()
      await loadDash()
    } catch (e) {
      setRedeemMsg(e instanceof Error ? e.message : 'Falha ao usar jogo grátis')
    } finally {
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
            {/* MODIFIQUEI AQUI */}
            Os bônus são conferidos pela administração e pagos manualmente via Pix quando aplicável.
          </p>
        </div>

        {dashErr && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {dashErr}
          </div>
        )}

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
        {(st?.free_tickets_available ?? 0) > 0 && profile?.is_active !== false && (
          <section className="rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-sm space-y-3">
            <h2 className="text-lg font-bold text-[#1F1F1F]">Usar jogo grátis</h2>
            <p className="text-sm text-[#1F1F1F]/75">
              {/* MODIFIQUEI AQUI */}Escolha os números; a participação entra no ranking, sem Pix e sem comissão (valor R$
              0,00).
            </p>
            <CustomSelect
              value={creditContestId}
              options={contests.length ? contests.map((c) => ({ value: c.id, label: c.name })) : [{ value: '', label: '—' }]}
              onChange={(v: string) => setCreditContestId(v)}
            />
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-sm min-h-[48px]"
              placeholder={
                contestCredit
                  ? `${contestCredit.numbers_per_participation} números (ex.: 01 02 03…)`
                  : 'Números'
              }
              value={creditNumbersRaw}
              onChange={(e) => setCreditNumbersRaw(e.target.value)}
            />
            <button
              type="button"
              disabled={redeemBusy}
              onClick={() => void handleRedeem()}
              className="rounded-xl bg-[#1E7F43] text-white font-bold px-6 py-3 hover:bg-[#3CCB7F] disabled:opacity-50 w-full sm:w-auto"
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
