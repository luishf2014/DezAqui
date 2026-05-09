/**
 * MODIFIQUEI AQUI — página do cambista (/meu-link e /minhas-vendas): link vem sempre do seu próprio perfil (RLS);
 * totais opcionais via RPC servidor (precisa migração 041 aplicada no Supabase).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import CustomSelect from '../components/CustomSelect'
import { useAuth } from '../contexts/AuthContext'
import { listActiveContests } from '../services/contestsService'
import {
  fetchSellerAreaDashboardRpc,
  type SellerAreaDashboardPayload,
  type SellerAreaSaleRow,
} from '../services/sellerAreaService'
import { redeemReferralFreeCreditParticipation } from '../services/participationsService'
import { formatCurrency } from '../utils/formatters'
import type { Contest } from '../types'

function commissionStatusPt(s: string): string {
  const v = String(s || '').toLowerCase()
  if (v === 'pending') return 'Pendente (repasse)'
  if (v === 'paid') return 'Paga'
  if (v === 'canceled') return 'Cancelada'
  return s || '—'
}

function participationStatusPt(s: string): string {
  const v = String(s || '').toLowerCase()
  if (v === 'pending') return 'Pendente'
  if (v === 'active') return 'Ativa'
  if (v === 'cancelled' || v === 'canceled') return 'Cancelada'
  return s || '—'
}

export default function SellerAreaPage() {
  const { profile, loading: authLoading, refreshProfile } = useAuth()
  const [contests, setContests] = useState<Contest[]>([])
  /** MODIFIQUEI AQUI — bolões sempre carregam; link não espera pela RPC */
  const [contestsLoading, setContestsLoading] = useState(true)
  const [contestsError, setContestsError] = useState<string | null>(null)

  const [dash, setDash] = useState<SellerAreaDashboardPayload | null>(null)
  const [dashLoading, setDashLoading] = useState(true)
  const [dashError, setDashError] = useState<string | null>(null)

  const [globalError, setGlobalError] = useState<string | null>(null)
  const [linkContestId, setLinkContestId] = useState('')
  const [copiedNotice, setCopiedNotice] = useState(false)

  const [creditNumbersRaw, setCreditNumbersRaw] = useState('')
  const [creditContestId, setCreditContestId] = useState('')
  const [redeemBusy, setRedeemBusy] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null)

  /** MODIFIQUEI AQUI — código de referência sempre do perfil próprio (+ fallback RPC) */
  const referralCode = useMemo(() => {
    const p = profile?.referral_code?.trim() ?? ''
    const r = dash?.profile.referral_code?.trim() ?? ''
    return (p || r || '').trim()
  }, [profile?.referral_code, dash?.profile.referral_code])

  const sellerDisplayName = useMemo(() => {
    const n = profile?.name?.trim()
    if (n) return n
    const pe = profile?.email?.trim()
    if (pe && !pe.includes('@dezaqui.local')) return pe.split('@')[0] ?? pe
    return 'Vendedor'
  }, [profile?.name, profile?.email])

  const fullSellerLink = useMemo(() => {
    if (!referralCode || !linkContestId) return ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/concursos/${encodeURIComponent(linkContestId)}?ref=${encodeURIComponent(referralCode)}`
  }, [referralCode, linkContestId])

  const loadContests = useCallback(async () => {
    setContestsLoading(true)
    setContestsError(null)
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
    } catch (e) {
      setContests([])
      setContestsError(e instanceof Error ? e.message : 'Erro ao carregar bolões ativos')
    } finally {
      setContestsLoading(false)
    }
  }, [])

  const loadDashboard = useCallback(async () => {
    setDashLoading(true)
    setDashError(null)
    try {
      const d = await fetchSellerAreaDashboardRpc()
      setDash(d)
    } catch (e) {
      setDash(null)
      setDashError(
        e instanceof Error
          ? e.message
          : 'Não foi possível carregar o resumo de vendas/comissões. O link continua disponível usando seu código de perfil; confirme no Supabase a migração 041.'
      )
    } finally {
      setDashLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadContests()
  }, [loadContests])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  /** MODIFIQUEI AQUI */
  const copyLink = async () => {
    const url = fullSellerLink.trim()
    if (!url) {
      setGlobalError(
        contests.length === 0
          ? 'Nenhum bolão ativo encontrado para montar o link — aguarde a abertura de um novo sorteio ou fale com o administrador.'
          : 'Monte seu link escolhendo um bolão e confirmando seu código de referência no perfil.'
      )
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopiedNotice(true)
      window.setTimeout(() => setCopiedNotice(false), 2800)
    } catch {
      setGlobalError('Não foi possível copiar — copie manualmente do campo ao lado.')
    }
  }

  const contestCredit = contests.find((c) => c.id === creditContestId)

  /** MODIFIQUEI AQUI */
  const handleRedeemCredit = async () => {
    if (!creditContestId) {
      setRedeemMsg('Escolha um bolão primeiro.')
      return
    }
    const nums = creditNumbersRaw
      .split(/[\s,;]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n))
    if (!contestCredit) {
      setRedeemMsg('Bolão não encontrado.')
      return
    }
    if (nums.length !== contestCredit.numbers_per_participation) {
      setRedeemMsg(
        `Informe exatamente ${contestCredit.numbers_per_participation} número(s) para este bolão.`
      )
      return
    }
    if (nums.some((n) => n < contestCredit.min_number || n > contestCredit.max_number)) {
      setRedeemMsg(`Números devem ficar entre ${contestCredit.min_number} e ${contestCredit.max_number}.`)
      return
    }
    if ((profile?.referral_bonus_credits ?? 0) < 1) {
      setRedeemMsg('Você não tem créditos disponíveis.')
      return
    }
    if (profile?.is_active === false) {
      setRedeemMsg('Conta inativa — entre em contato com o administrador.')
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
        `Bilhete bonificado criado! Código ${res.ticket_code ?? '(ver em Meus tickets)'} — sem Pix nem comissão.`
      )
      setCreditNumbersRaw('')
      await refreshProfile()
      await loadDashboard()
    } catch (e) {
      setRedeemMsg(e instanceof Error ? e.message : 'Falha ao usar crédito')
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

  const creditsAvail = dash?.profile.referral_bonus_credits ?? profile?.referral_bonus_credits ?? 0

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl space-y-8">
        <div>
          {/* MODIFIQUEI AQUI — foco cambista */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F1F1F] mb-1">Meu link de venda</h1>
          <p className="text-base font-semibold text-[#1E7F43]">{sellerDisplayName}</p>
          <p className="text-sm text-[#1F1F1F]/65 max-w-2xl mt-2">
            {/* MODIFIQUEI AQUI */}
            Comissões só aparecem <strong>após pagamento confirmado</strong>.
            {' '}Cada <strong>10 vendas pagas qualificadas</strong> pela sua indicação podem liberar{' '}
            <strong>1 jogo bonificado gratuito</strong> (bilhetes grátis não somam à arrecadação nem geram nova comissão).
          </p>
        </div>

        {globalError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 text-sm">
            {globalError}
            <button type="button" className="ml-3 underline font-semibold" onClick={() => setGlobalError(null)}>
              Ok
            </button>
          </div>
        )}

        {contestsError && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-sm">
            {contestsError}
          </div>
        )}

        {/* MODIFIQUEI AQUI — bloco obrigatório */}
        <section className="rounded-2xl border-2 border-[#1E7F43]/30 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-[#1F1F1F]">Seu código e link de indicação</h2>

          {!referralCode && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {/* MODIFIQUEI AQUI */}
              Não encontramos código de referência no seu cadastro ({' '}
              <button type="button" className="underline font-semibold" onClick={() => void refreshProfile()}>
                atualizar perfil
              </button>
              ). Caso falhe, procure o administrador.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase font-semibold text-[#1F1F1F]/50">Código ref.</span>
            <code className="text-xl font-bold font-mono px-3 py-1.5 bg-[#F4C430]/25 rounded-lg text-[#1E7F43]">
              {referralCode || '—'}
            </code>
          </div>

          <div className="max-w-xl space-y-1">
            <label className="text-xs font-semibold text-[#1F1F1F]/70">Bolão ativo para o cliente abrir quando clicar no link</label>
            <CustomSelect
              value={linkContestId}
              options={
                contests.length
                  ? contests.map((c) => ({
                      value: c.id,
                      label: contestsLoading ? `${c.name}…` : `${c.name} (${c.numbers_per_participation} nº)`,
                    }))
                  : [{ value: '', label: contestsLoading ? 'Carregando bolões…' : 'Nenhum bolão ativo' }]
              }
              onChange={(v: string) => setLinkContestId(v)}
              disabled={contestsLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#1F1F1F]/70">Link público gerado automaticamente</label>
            <input
              type="text"
              readOnly
              className="w-full rounded-xl border border-[#E5E5E5] bg-[#F9F9F9] px-3 py-2.5 text-sm font-mono text-[#1F1F1F]"
              value={
                contestsLoading ? 'Gerando URL… (aguarde o carregamento dos bolões)' : fullSellerLink || 'Escolha o bolão e confirme seu código acima'
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={contestsLoading || !fullSellerLink.trim()}
              onClick={() => void copyLink()}
              className="inline-flex items-center px-6 py-2.5 rounded-xl bg-[#1E7F43] text-white font-semibold hover:bg-[#3CCB7F] disabled:opacity-50 transition-colors"
            >
              Copiar link
            </button>
            {copiedNotice && (
              <span className="text-sm font-bold text-[#1E7F43]" role="status">
                Link copiado com sucesso
              </span>
            )}
          </div>

          {!contestsLoading && referralCode && linkContestId && (
            <p className="text-[11px] text-[#1F1F1F]/50">
              Moldura esperada pela plataforma:{' '}
              <strong>https://{typeof window !== 'undefined' ? window.location.host : ''}/concursos/{linkContestId}?ref={referralCode}</strong>
            </p>
          )}
        </section>

        {/* MODIFIQUEI AQUI — 4 cartões solicitados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-sm">
            <div className="text-xs uppercase font-semibold text-[#1F1F1F]/55">Total de vendas pagas pelo seu link*</div>
            <div className="text-2xl font-extrabold tabular-nums mt-1 text-[#1F1F1F]">
              {dashLoading ? '…' : dash?.stats?.paid_sales_via_commission_lines ?? '—'}
            </div>
            <p className="text-[10px] text-[#999] mt-1">
              *Só conta após confirmação de pagamento; exige servidor com migração 041 quando mostra número — senão aparece travessão ou consulte ADM.
            </p>
          </div>
          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-sm">
            <div className="text-xs uppercase font-semibold text-[#1F1F1F]/55">Total vendido (via você)</div>
            <div className="text-xl font-extrabold tabular-nums mt-1 text-[#1E7F43]">
              {dashLoading ? '…' : dash ? formatCurrency(dash.stats.total_sold_via_link_brl) : '—'}
            </div>
          </div>
          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-sm">
            <div className="text-xs uppercase font-semibold text-[#1F1F1F]/55">Comissão gerada (pend.+pagas)**</div>
            <div className="text-xl font-extrabold tabular-nums mt-1 text-[#1F1F1F]">
              {dashLoading ? '…' : dash ? formatCurrency(dash.stats.commission_generated_total_brl) : '—'}
            </div>
            <p className="text-[10px] text-[#999] mt-1">**Liquidações finais combinadas com seu administrador</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
            <div className="text-xs uppercase font-semibold text-[#1F1F1F]/55">Créditos grátis disponíveis</div>
            <div className="text-3xl font-extrabold tabular-nums mt-1 text-[#1E7F43]">{creditsAvail}</div>
          </div>
        </div>

        {dashError && (
          <p className="text-xs text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{dashError}</p>
        )}

        {/* Resgate opcional mesmo sem RPC de painel */}
        {(profile?.referral_bonus_credits ?? 0) > 0 && profile?.is_active !== false && (
          <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm space-y-3">
            <h3 className="text-lg font-bold text-[#1F1F1F]">Usar crédito em um bolão</h3>
            <p className="text-sm text-[#1F1F1F]/75">
              {/* MODIFIQUEI AQUI */}
              Mesmo fluxo seguro já usado no checkout: bilhete <strong>R$ 0,00</strong>.
            </p>
            <div className="max-w-md space-y-1">
              <label className="text-xs font-semibold">Bolão ativo</label>
              <CustomSelect
                value={creditContestId}
                options={
                  contests.length
                    ? contests.map((c) => ({ value: c.id, label: c.name }))
                    : [{ value: '', label: 'Nenhum bolão ativo' }]
                }
                onChange={(v: string) => setCreditContestId(v)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">
                Números {contestCredit ? `(${contestCredit.numbers_per_participation} valores)` : ''}
              </label>
              <input
                className="w-full border rounded-xl px-3 py-2"
                placeholder={
                  contestCredit ? `Ex.: ${Array.from({ length: contestCredit.numbers_per_participation }, () => '05').join(' ')}` : '—'
                }
                value={creditNumbersRaw}
                onChange={(e) => setCreditNumbersRaw(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={redeemBusy || !creditContestId || contests.length === 0}
              onClick={() => void handleRedeemCredit()}
              className="px-6 py-2.5 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              {redeemBusy ? 'Processando…' : 'Resgatar 1 bilhete grátis'}
            </button>
            {redeemMsg && <p className="text-sm text-[#1F1F1F]/80">{redeemMsg}</p>}
          </section>
        )}

        {dash && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="text-xs uppercase font-semibold text-[#1F1F1F]/50">Vendas p/ bonificação (contador oficial)</div>
                <div className="text-3xl font-extrabold text-[#1F1F1F]">{dash.profile.referral_qualifying_sales_count}</div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="text-xs uppercase font-semibold text-[#1F1F1F]/50">Comissões a liquidar vs pagas</div>
                <div className="text-sm font-semibold tabular-nums">{formatCurrency(dash.stats.commission_pending_brl)}</div>
                <div className="text-sm font-semibold tabular-nums text-[#3CCB7F]">{formatCurrency(dash.stats.commission_paid_brl)}</div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="text-xs uppercase font-semibold text-[#1F1F1F]/50">Percentual combinado*</div>
                <div className="text-2xl font-extrabold text-[#1F1F1F]">{Number(dash.profile.commission_percent).toLocaleString('pt-BR')}%</div>
                <p className="text-[10px] text-[#888] mt-1">*Definido pelo administrador</p>
              </div>
            </div>

            {dash.stats.commission_canceled_rows > 0 && (
              <p className="text-xs text-[#1F1F1F]/50">
                {/* MODIFIQUEI AQUI */}
                Há <strong>{dash.stats.commission_canceled_rows}</strong> comissões canceladas (não aparecem na lista abaixo).
              </p>
            )}

            <section className="rounded-2xl border border-[#E5E5E5] bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b bg-[#FAFAFA]">
                <h2 className="text-lg font-bold text-[#1F1F1F]">Vendas atribuídas ao seu código</h2>
                <button type="button" className="text-xs underline text-[#1E7F43]" onClick={() => void loadDashboard()} disabled={dashLoading}>
                  Recarregar
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-max w-full text-sm">
                  <thead className="bg-[#F5F5F5] border-b">
                    <tr className="text-left">
                      <th className="p-3">Data*</th>
                      <th className="p-3">Bolão</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3 text-right">Valor venda</th>
                      <th className="p-3">Status venda</th>
                      <th className="p-3 text-right">Comissão</th>
                      <th className="p-3">Status comissão</th>
                      <th className="p-3">Bilhete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dash.sales.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-[#1F1F1F]/60">
                          Ainda não há vendas pelo seu código com pagamento já confirmado pelo sistema financeiro (ou ficaram apenas canceladas).
                        </td>
                      </tr>
                    ) : (
                      dash.sales.map((row: SellerAreaSaleRow) => (
                        <tr key={row.commission_id} className="border-b hover:bg-[#FBFBFB]">
                          <td className="p-3 whitespace-nowrap">
                            {row.sale_at ? new Date(row.sale_at).toLocaleString('pt-BR') : '—'}
                          </td>
                          <td className="p-3 max-w-[10rem] break-words">{row.contest_name}</td>
                          <td className="p-3">
                            <div className="font-medium">{row.buyer_display}</div>
                            {row.buyer_public_contact && (
                              <div className="text-[11px] text-[#888]">{row.buyer_public_contact}</div>
                            )}
                          </td>
                          <td className="p-3 text-right tabular-nums">{formatCurrency(row.sale_value_brl)}</td>
                          <td className="p-3 text-xs">{row.sale_payment_status_pt}</td>
                          <td className="p-3 text-right tabular-nums">{formatCurrency(row.commission_value_brl)}</td>
                          <td className="p-3 text-xs font-semibold">{commissionStatusPt(row.commission_status)}</td>
                          <td className="p-3 text-xs">{participationStatusPt(row.participation_status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="p-3 text-[11px] text-[#888] bg-[#FCFCFD] border-t">
                *Datas no horário deste navegador; entrada criada assim que há pagamento marcado como pago pelo gateway.
              </p>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
