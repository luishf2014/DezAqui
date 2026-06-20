/**
 * MODIFIQUEI AQUI — página do cambista (/meu-link e /minhas-vendas): link vem sempre do seu próprio perfil (RLS);
 * totais opcionais via RPC servidor (precisa migração 041+ aplicada no Supabase).
 * Cambista não participa do «Indique e Ganhe»; apenas comissão % sobre vendas pagas (sem carteira).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import CustomSelect from '../components/CustomSelect'
import SellerOperationsPanel from '../components/SellerOperationsPanel'
import { useAuth } from '../contexts/AuthContext'
import { listActiveContests } from '../services/contestsService'
import {
  fetchSellerAreaDashboardRpc,
  listSellerBonusClientsRpc,
  type SellerAreaDashboardPayload,
  type SellerAreaSaleRow,
  type SellerBonusClientRow,
} from '../services/sellerAreaService'
import { formatCurrency } from '../utils/formatters'
import { shareTelegramUrl, shareWhatsAppUrl } from '../utils/contestShareLink'
import type { Contest } from '../types'

function commissionStatusPt(s: string): string {
  const v = String(s || '').toLowerCase()
  if (v === 'pending') return 'Pendente (pagamento manual via Pix)'
  if (v === 'paid') return 'Paga via Pix'
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

  const [bonusClients, setBonusClients] = useState<SellerBonusClientRow[]>([])
  const [bonusClientsLoading, setBonusClientsLoading] = useState(true)
  const [bonusClientsError, setBonusClientsError] = useState<string | null>(null)

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

  const shareLine = 'Olá! Use meu link para participar do bolão na DezAqui — comissões só após pagamento confirmado.'

  const shareWhatsAppHref = useMemo(() => {
    if (!fullSellerLink.trim()) return '#'
    return shareWhatsAppUrl(shareLine, fullSellerLink.trim())
  }, [fullSellerLink])

  const shareTelegramHref = useMemo(() => {
    if (!fullSellerLink.trim()) return '#'
    return shareTelegramUrl(shareLine, fullSellerLink.trim())
  }, [fullSellerLink])

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
    } catch (e) {
      setContests([])
      setContestsError(e instanceof Error ? e.message : 'Erro ao carregar bolões ativos')
    } finally {
      setContestsLoading(false)
    }
  }, [])

  const loadBonusClients = useCallback(async () => {
    setBonusClientsLoading(true)
    setBonusClientsError(null)
    try {
      const rows = await listSellerBonusClientsRpc()
      setBonusClients(rows)
    } catch (e) {
      setBonusClients([])
      setBonusClientsError(e instanceof Error ? e.message : 'Erro ao carregar clientes vinculados')
    } finally {
      setBonusClientsLoading(false)
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
          : 'Não foi possível carregar o resumo de vendas/comissões. O link continua disponível usando seu código de perfil; confirme no Supabase as migrações 041+.'
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

  useEffect(() => {
    void loadBonusClients()
  }, [loadBonusClients])

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
            Você <strong>não participa</strong> do programa «Indique e Ganhe» de clientes.             Suas vendas pelo link geram{' '}
            <strong>comissão percentual</strong> após <strong>pagamento confirmado</strong>, conforme o modo definido pelo
            administrador: <strong>só na primeira compra paga</strong> de cada cliente ou em <strong>todas as compras pagas</strong>.
            Você também pode <strong>registrar vendas</strong> e <strong>cadastrar clientes</strong> directamente nesta área.{' '}
            <strong>Não há carteira interna</strong> — as comissões são pagas manualmente pela administração via Pix.
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

        {dash && !dashLoading && (
          <section className="rounded-2xl border border-[#1E7F43]/25 bg-[#F0FDF4]/80 px-4 py-3 text-sm text-[#14532D]">
            {/* MODIFIQUEI AQUI */}
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#166534]/90">Modo de comissão actual</span>
            <p className="mt-1 font-semibold text-[#166534]">
              {dash.profile.commission_mode === 'first_purchase_only'
                ? 'Apenas na primeira compra paga de cada cliente indicado.'
                : 'Em todas as compras pagas dos clientes indicados (recorrente).'}
            </p>
          </section>
        )}

        {/* MODIFIQUEI AQUI — bloco obrigatório */}
        <section className="rounded-2xl border-2 border-[#1E7F43]/30 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-[#1F1F1F]">Seu código e link de venda</h2>

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

          <div className="d-flex flex-wrap align-items-center gap-3">
            <button
              type="button"
              disabled={contestsLoading || !fullSellerLink.trim()}
              onClick={() => void copyLink()}
              className="btn fw-semibold px-4 py-2 text-white border-0"
              style={{ backgroundColor: '#1E7F43' }}
            >
              Copiar link
            </button>
            <a
              href={shareWhatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn d-inline-flex align-items-center gap-2 px-4 py-2 fw-semibold text-white border-0 ${
                fullSellerLink.trim() ? '' : 'disabled opacity-50 pe-none'
              }`}
              style={fullSellerLink.trim() ? { backgroundColor: '#25D366' } : undefined}
              tabIndex={fullSellerLink.trim() ? 0 : -1}
            >
              <i className="bi bi-whatsapp fs-5" aria-hidden />
              WhatsApp
            </a>
            <a
              href={shareTelegramHref}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn d-inline-flex align-items-center gap-2 px-4 py-2 fw-semibold text-white border-0 ${
                fullSellerLink.trim() ? '' : 'disabled opacity-50 pe-none'
              }`}
              style={fullSellerLink.trim() ? { backgroundColor: '#229ED9' } : undefined}
              tabIndex={fullSellerLink.trim() ? 0 : -1}
            >
              <i className="bi bi-telegram fs-5" aria-hidden />
              Telegram
            </a>
            {copiedNotice && (
              <span className="text-sm font-bold text-[#1E7F43]" role="status">
                Link copiado com sucesso
              </span>
            )}
          </div>

          {!contestsLoading && referralCode && linkContestId && (
            <p className="text-[11px] text-[#1F1F1F]/50">
              Moldura esperada pela plataforma:{' '}
              <strong>
                https://{typeof window !== 'undefined' ? window.location.host : ''}/concursos/{linkContestId}?ref={referralCode}
              </strong>
            </p>
          )}
        </section>

        {bonusClientsError && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-sm">
            {bonusClientsError}
          </div>
        )}

        <SellerOperationsPanel
          clients={bonusClients}
          clientsLoading={bonusClientsLoading}
          contests={contests}
          contestsLoading={contestsLoading}
          commissionPercent={dash?.profile.commission_percent}
          commissionMode={dash?.profile.commission_mode}
          onError={(msg) => setGlobalError(msg)}
          onClientCreated={() => loadBonusClients()}
          onSaleCompleted={() => Promise.all([loadBonusClients(), loadDashboard()])}
        />

        {/* MODIFIQUEI AQUI — cartões de comissão */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-sm">
            <div className="text-xs uppercase font-semibold text-[#1F1F1F]/55">Clientes com venda paga*</div>
            <div className="text-2xl font-extrabold tabular-nums mt-1 text-[#1F1F1F]">
              {dashLoading ? '…' : dash?.stats?.referred_buyers_with_paid_sale_count ?? '—'}
            </div>
            <p className="text-[10px] text-[#999] mt-1">*Distintos (via código ou vínculo gravado).</p>
          </div>
          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-sm">
            <div className="text-xs uppercase font-semibold text-[#1F1F1F]/55">Total de vendas pagas pelo seu link*</div>
            <div className="text-2xl font-extrabold tabular-nums mt-1 text-[#1F1F1F]">
              {dashLoading ? '…' : dash?.stats?.paid_sales_via_commission_lines ?? '—'}
            </div>
            <p className="text-[10px] text-[#999] mt-1">*Somente bilhetes pagos; jogos grátis não entram.</p>
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
            <p className="text-[10px] text-[#999] mt-1">**Liquidada manualmente via Pix pelo ADM</p>
          </div>
        </div>

        {dashError && (
          <p className="text-xs text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{dashError}</p>
        )}

        {dash && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-sm">
                <div className="text-xs uppercase font-semibold text-[#1F1F1F]/50">Comissão pendente vs paga</div>
                <div className="text-lg font-extrabold tabular-nums text-amber-800">{formatCurrency(dash.stats.commission_pending_brl)}</div>
                <div className="text-lg font-extrabold tabular-nums text-[#3CCB7F]">{formatCurrency(dash.stats.commission_paid_brl)}</div>
              </div>
              <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-sm">
                <div className="text-xs uppercase font-semibold text-[#1F1F1F]/50">Percentual base (perfil)*</div>
                <div className="text-2xl font-extrabold text-[#1F1F1F]">{Number(dash.profile.commission_percent).toLocaleString('pt-BR')}%</div>
                <p className="text-[10px] text-[#888] mt-1">*O bolão pode ter % próprio definido pelo administrador.</p>
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
                <h2 className="text-lg font-bold text-[#1F1F1F]">Minhas vendas</h2>
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
