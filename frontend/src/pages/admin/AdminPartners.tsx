/**
 * ADMIN — MODIFIQUEI AQUI: Cambistas/indicações, comissões e bonificações
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import CustomSelect from '../../components/CustomSelect'
import SellerOperationsPanel from '../../components/SellerOperationsPanel'
import {
  fetchCommissionsForAdmin,
  fetchReferralIndicationRewardsForAdmin,
  listUsersWithTotalsForPartners,
  updateCommissionStatusAdmin,
  updateUserSellerFieldsAdmin,
  updateReferralIndicationRewardAdmin,
  adminCreateBonusParticipationRpc,
  type PartnerUserRow,
  type ReferralIndicationRewardAdminRow,
} from '../../services/partnersAdminService'
import { listAllContests, updateContest } from '../../services/contestsService'
import type { Contest } from '../../types'
import { formatCurrency, navigateToTop } from '../../utils/formatters'
import { normalizeIsSellerFlag } from '../../services/profilesService'

function contestStatusLabelPt(status: Contest['status']): string {
  const m: Record<string, string> = {
    draft: 'Rascunho',
    active: 'Ativo',
    finished: 'Encerrado',
    cancelled: 'Cancelado',
  }
  return m[status] ?? status
}

/** MODIFIQUEI AQUI — moldura visual consistente com o painel DezAqui (verde + neutros + sombra suave). */
function AdminSection({
  title,
  description,
  variant = 'neutral',
  actions,
  children,
}: {
  title: string
  description?: ReactNode
  variant?: 'neutral' | 'emerald' | 'amber'
  actions?: ReactNode
  children: ReactNode
}) {
  const dot =
    variant === 'emerald' ? 'bg-[#1E7F43]' : variant === 'amber' ? 'bg-[#F59E0B]' : 'bg-[#64748B]'
  const grad =
    variant === 'emerald'
      ? 'from-[#ECFDF5]/95 via-[#FAFFFE] to-white'
      : variant === 'amber'
        ? 'from-[#FFFBEB]/95 via-[#FFFCF7] to-white'
        : 'from-[#F8FAFC] via-white to-[#FAFBFC]'
  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_16px_rgba(31,31,31,0.06)] overflow-hidden ring-1 ring-[#1F1F1F]/[0.04]">
      <div
        className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-[#EEF1F6] bg-gradient-to-br ${grad}`}
      >
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
            <h2 className="text-lg sm:text-xl font-bold text-[#1F1F1F] tracking-tight">{title}</h2>
          </div>
          {description ? (
            <div className="text-sm text-[#4B5563] leading-relaxed max-w-4xl">{description}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="shrink-0 flex flex-wrap items-center gap-2 justify-end">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode
  tone: 'success' | 'warning' | 'muted' | 'danger'
}) {
  const cls =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200/90'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-950 border-amber-200/90'
        : tone === 'danger'
          ? 'bg-red-50 text-red-900 border-red-200/90'
          : 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]'
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {children}
    </span>
  )
}

function contestStatusTone(status: Contest['status']): 'success' | 'warning' | 'muted' | 'danger' {
  if (status === 'active') return 'success'
  if (status === 'draft') return 'muted'
  if (status === 'finished') return 'warning'
  return 'danger'
}

function payoutRowCommissionPt(raw: string): { label: string; tone: 'success' | 'warning' | 'muted' | 'danger' } {
  const v = String(raw || '').toLowerCase()
  if (v === 'pending') return { label: 'Pendente', tone: 'warning' }
  if (v === 'paid') return { label: 'Paga', tone: 'success' }
  if (v === 'canceled' || v === 'cancelled') return { label: 'Cancelada', tone: 'danger' }
  return { label: raw || '—', tone: 'muted' }
}

type ReferralIndicationDraft = {
  target: string
  rewardType: '' | 'free_ticket' | 'manual_pix_bonus'
  value: string
  /** % comissão só neste bolão; vazio = usa o % do perfil do cambista */
  sellerPctOverride: string
}

function buildReferralDraftsFromContests(cts: Contest[]): Record<string, ReferralIndicationDraft> {
  const o: Record<string, ReferralIndicationDraft> = {}
  for (const c of cts) {
    o[c.id] = {
      target:
        c.referral_target_sales != null && Number(c.referral_target_sales) > 0
          ? String(Math.floor(Number(c.referral_target_sales)))
          : '',
      rewardType:
        c.referral_reward_type === 'free_ticket' || c.referral_reward_type === 'manual_pix_bonus'
          ? c.referral_reward_type
          : '',
      value:
        c.referral_reward_value != null && c.referral_reward_value !== undefined
          ? String(c.referral_reward_value)
          : '',
      sellerPctOverride:
        c.seller_commission_percent_override != null && c.seller_commission_percent_override !== undefined
          ? String(c.seller_commission_percent_override)
          : '',
    }
  }
  return o
}

export default function AdminPartners() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [users, setUsers] = useState<PartnerUserRow[]>([])
  const [commissions, setCommissions] = useState<Awaited<ReturnType<typeof fetchCommissionsForAdmin>>>([])
  const [indicationRewards, setIndicationRewards] = useState<ReferralIndicationRewardAdminRow[]>([])
  const [contests, setContests] = useState<Contest[]>([])
  const [allContestsById, setAllContestsById] = useState<Map<string, Contest>>(new Map())
  const [updatingUid, setUpdatingUid] = useState<string | null>(null)

  const [referralDraftById, setReferralDraftById] = useState<Record<string, ReferralIndicationDraft>>({})
  const [savingReferralContestId, setSavingReferralContestId] = useState<string | null>(null)

  const [promoteToSellerUserId, setPromoteToSellerUserId] = useState('') /** MODIFIQUEI AQUI — picker para novo vendedor */

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  /** MODIFIQUEI AQUI — apenas quem já é cambista aparece na grelha */
  const sellerRows = useMemo(
    () => users.filter((u) => normalizeIsSellerFlag(u.is_seller)),
    [users]
  )

  const indicatorRows = useMemo(
    () => users.filter((u) => !normalizeIsSellerFlag(u.is_seller) && !u.is_admin),
    [users]
  )

  const nonSellerChoices = useMemo(
    () => users.filter((u) => !normalizeIsSellerFlag(u.is_seller)),
    [users]
  )

  const operationClients = useMemo(
    () =>
      users
        .filter((u) => !u.is_admin && !normalizeIsSellerFlag(u.is_seller) && u.is_active !== false)
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone ?? null,
          cpf: u.cpf ?? null,
        })),
    [users]
  )

  const bonusUsers = useMemo(
    () =>
      users
        .filter((u) => !u.is_admin && !normalizeIsSellerFlag(u.is_seller))
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          referral_bonus_credits: u.referral_bonus_credits,
          referral_bonus_credits_used: u.referral_bonus_credits_used,
        })),
    [users]
  )

  const contestsReferralOverview = useMemo(() => {
    const arr = Array.from(allContestsById.values()).filter(
      (c) => c.status !== 'cancelled' && c.status !== 'finished'
    )
    const order: Record<string, number> = { active: 0, draft: 1 }
    return arr.sort((a, b) => {
      const da = order[a.status] ?? 99
      const db = order[b.status] ?? 99
      if (da !== db) return da - db
      return a.name.localeCompare(b.name, 'pt')
    })
  }, [allContestsById])

  const partnerStats = useMemo(() => {
    const commissionsPending = commissions.filter((c) => c.status === 'pending').length
    const pixBonusesPending = indicationRewards.filter(
      (r) => r.reward_type === 'manual_pix_bonus' && r.status === 'pending'
    ).length
    const commissionsPaidRows = commissions.filter((c) => c.status === 'paid').length
    return {
      sellers: sellerRows.length,
      indicators: indicatorRows.length,
      commissionsPending,
      commissionsPaidRows,
      pixBonusesPending,
    }
  }, [commissions, indicationRewards, sellerRows.length, indicatorRows.length])

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const [uRows, commRows, indRows, cts] = await Promise.all([
        listUsersWithTotalsForPartners(),
        fetchCommissionsForAdmin(),
        fetchReferralIndicationRewardsForAdmin(),
        listAllContests(),
      ])
      const activeOnly = cts.filter((x) => x.status === 'active')
      const cmap = new Map(cts.map((c) => [c.id, c]))

      setUsers(uRows)
      setCommissions(commRows)
      setIndicationRewards(indRows)
      setAllContestsById(cmap)
      setContests(activeOnly)
      setReferralDraftById(buildReferralDraftsFromContests(cts))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar dados'
      setError(msg)
      throw e instanceof Error ? e : new Error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload().catch(() => {})
  }, [])

  const toggleSeller = async (userId: string, next: boolean) => {
    setUpdatingUid(userId)
    try {
      await updateUserSellerFieldsAdmin({ userId, is_seller: next })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar')
    } finally {
      setUpdatingUid(null)
    }
  }

  const saveCommissionPct = async (userId: string, pctRaw: string) => {
    const n = Number(pctRaw.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setError('Percentual deve ser entre 0 e 100')
      return
    }
    setUpdatingUid(userId)
    try {
      await updateUserSellerFieldsAdmin({ userId, commission_percent: n })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar percentual')
    } finally {
      setUpdatingUid(null)
    }
  }

  /** MODIFIQUEI AQUI — modo de comissão do cambista */
  const saveCommissionMode = async (
    userId: string,
    mode: 'first_purchase_only' | 'recurring_purchases'
  ) => {
    setUpdatingUid(userId)
    try {
      await updateUserSellerFieldsAdmin({ userId, commission_mode: mode })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar modo de comissão')
    } finally {
      setUpdatingUid(null)
    }
  }

  /** MODIFIQUEI AQUI — conta activa (compras na plataforma) */
  const setSellerAccountActive = async (userId: string, next: boolean) => {
    setUpdatingUid(userId)
    try {
      await updateUserSellerFieldsAdmin({ userId, is_active: next })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao alterar estado da conta')
    } finally {
      setUpdatingUid(null)
    }
  }

  const [commissionPayNotes, setCommissionPayNotes] = useState<Record<string, string>>({})
  const [indicationPayNotes, setIndicationPayNotes] = useState<Record<string, string>>({})

  const setCommissionPaidState = async (
    id: string,
    status: 'pending' | 'paid' | 'canceled',
    note?: string
  ) => {
    try {
      await updateCommissionStatusAdmin(id, status, {
        admin_payment_note: note?.trim() ? note.trim() : null,
      })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar comissão')
    }
  }

  const setIndicationRewardState = async (
    id: string,
    status: 'pending' | 'paid' | 'canceled',
    note?: string
  ) => {
    try {
      await updateReferralIndicationRewardAdmin({
        id,
        status,
        admin_payment_note: note?.trim() ? note.trim() : null,
      })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar bônus')
    }
  }

  const patchReferralDraft = (contestId: string, patch: Partial<ReferralIndicationDraft>) => {
    setReferralDraftById((prev) => ({
      ...prev,
      [contestId]: {
        target: '',
        rewardType: '',
        value: '',
        sellerPctOverride: '',
        ...prev[contestId],
        ...patch,
      },
    }))
  }

  const saveIndicationRulesForContest = async (contestId: string) => {
    const d = referralDraftById[contestId]
    if (!d) return

    const targetRaw = d.target.trim()
    const refTarget = targetRaw === '' ? null : Math.floor(Number(targetRaw.replace(',', '.')))

    if (refTarget !== null && (!Number.isFinite(refTarget) || refTarget <= 0)) {
      setError('Meta: informe um número inteiro positivo ou deixe vazio para desactivar o programa neste bolão.')
      return
    }

    let refType: 'free_ticket' | 'manual_pix_bonus' | null = null
    if (refTarget != null && refTarget > 0) {
      if (d.rewardType !== 'free_ticket' && d.rewardType !== 'manual_pix_bonus') {
        setError('Com meta definida, escolha o tipo de prémio para o indicador (jogo grátis ou bónus Pix).')
        return
      }
      refType = d.rewardType
    }

    let refVal: number | null = null
    if (refType === 'manual_pix_bonus') {
      const v = Number(String(d.value).replace(',', '.'))
      if (!Number.isFinite(v) || v <= 0) {
        setError('Informe o valor em R$ do bónus Pix (maior que zero).')
        return
      }
      refVal = v
    }

    const sellerRaw = String(d.sellerPctOverride ?? '').trim().replace(',', '.')
    let sellerOv: number | null = null
    if (sellerRaw !== '') {
      const s = Number(sellerRaw)
      if (!Number.isFinite(s) || s < 0 || s > 100) {
        setError('«% cambista neste bolão»: use um valor entre 0 e 100 ou deixe vazio para usar o % do perfil.')
        return
      }
      sellerOv = s
    }

    setSavingReferralContestId(contestId)
    setError(null)
    try {
      await updateContest(contestId, {
        referral_target_sales: refTarget,
        referral_reward_type: refTarget != null ? refType : null,
        referral_reward_value:
          refTarget != null && refType === 'manual_pix_bonus' ? refVal : null,
        seller_commission_percent_override: sellerOv,
      })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar prémios de indicação')
    } finally {
      setSavingReferralContestId(null)
    }
  }

  const theadCols = 11 // MODIFIQUEI AQUI — grelha cambista (modo, estado, totais)

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-[100rem] space-y-8">
        <div className="relative overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_4px_24px_rgba(31,31,31,0.07)] ring-1 ring-[#1F1F1F]/[0.05]">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#1E7F43] via-[#259d54] to-[#F4C430]"
            aria-hidden
          />
          <div className="relative px-5 sm:px-8 pt-8 pb-6 sm:pt-10 sm:pb-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-3xl space-y-4">
              <button
                type="button"
                onClick={() => navigateToTop(navigate, '/admin')}
                className="text-[#1E7F43] hover:text-[#3CCB7F] font-semibold flex items-center gap-2 text-left"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Voltar ao Dashboard
              </button>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1E7F43]/85 mb-2">
                  Administração financeira
                </p>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F1F1F] tracking-tight leading-[1.15]">
                  Parceiros e comissões
                </h1>
              </div>
              <p className="text-[15px] text-[#4B5563] leading-relaxed">
                {/* MODIFIQUEI AQUI */}
                Separação explícita entre <strong className="text-[#374151]">clientes indicadores</strong> (programa «Indique e
                Ganhe», sem comissão) e <strong className="text-[#374151]">cambistas</strong> (comissão percentual só sobre vendas{' '}
                <strong>pagas</strong>, sem carteira interna). Repasses de comissão e bónus Pix são sempre{' '}
                <strong>manuais via Pix</strong>, registados como pendentes ou pagos neste painel.
              </p>
            </div>
            <aside className="shrink-0 w-full lg:max-w-[22rem] rounded-xl border border-[#1E7F43]/18 bg-gradient-to-br from-[#F0FDF4] via-[#F7FEF9] to-[#ECFDF5] px-5 py-4 text-sm text-[#14532D] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <p className="font-bold text-[#166534] flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E7F43]/12 text-[#1E7F43]"
                  aria-hidden
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                </span>
                Link de venda
              </p>
              <p className="mt-2 text-[13px] leading-snug text-[#15803d]/98">
                Cada cambista usa <strong className="text-[#166534]">Meu link</strong> na navegação após iniciar sessão — só vê o
                próprio código, com segurança e auditoria centralizada aqui.
              </p>
            </aside>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 border-t border-[#EEF1F6] bg-gradient-to-b from-[#FAFBFC] to-[#F6F8FA] px-5 sm:px-8 py-4 sm:py-5">
            <div className="rounded-xl border border-[#E5E7EB]/90 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Cambistas</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#1F1F1F]">{partnerStats.sellers}</p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB]/90 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Indicadores</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#1F1F1F]">{partnerStats.indicators}</p>
            </div>
            <div className="rounded-xl border border-amber-200/70 bg-white px-4 py-3 shadow-sm ring-1 ring-amber-500/10">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/80">Comissões pendentes</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-amber-950">{partnerStats.commissionsPending}</p>
              <p className="mt-0.5 text-[10px] text-[#92400e]/85">{partnerStats.commissionsPaidRows} linhas já pagas</p>
            </div>
            <div className="rounded-xl border border-[#BFDBFE]/80 bg-white px-4 py-3 shadow-sm ring-1 ring-sky-500/10">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-900/75">Bónus Pix pendentes</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#0C4A6E]">{partnerStats.pixBonusesPending}</p>
            </div>
          </div>
        </div>

        <AdminSection
          variant="emerald"
          title="Indique e Ganhe e % cambista (por bolão)"
          description={
            <>
              Defina a <strong className="text-[#374151]">meta</strong> de indicação (vendas pagas ao código do indicador) e o{' '}
              <strong className="text-[#374151]">prémio</strong>: jogo grátis ou valor em R$ (Pix manual até marcar pago). Deixe a meta
              vazia para desactivar no bolão. O <strong className="text-[#374151]">% cambista neste bolão</strong> substitui o % do perfil
              só naquele concurso — vazio usa o perfil.
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F1F5F9] text-[11px] font-bold uppercase tracking-wide text-[#64748B] border-b border-[#E2E8F0]">
                <tr>
                  <th className="p-3 pl-5 text-left">Bolão</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-left whitespace-nowrap">Meta (vendas pagas)</th>
                  <th className="p-3 text-left min-w-[10rem]">Tipo de prémio</th>
                  <th className="p-3 text-left whitespace-nowrap">Valor R$ (Pix)</th>
                  <th className="p-3 text-left whitespace-nowrap">% cambista (bolão)</th>
                  <th className="p-3 pr-5 text-right">Guardar</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-[#6B7280]">
                      A carregar concursos…
                    </td>
                  </tr>
                ) : contestsReferralOverview.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#9CA3AF]">
                      Nenhum bolão em rascunho ou activo — cancelados e finalizados não são listados aqui.
                    </td>
                  </tr>
                ) : (
                  contestsReferralOverview.map((c) => {
                    const d = referralDraftById[c.id] ?? {
                      target: '',
                      rewardType: '' as const,
                      value: '',
                      sellerPctOverride: '',
                    }
                    const saving = savingReferralContestId === c.id
                    return (
                      <tr key={c.id} className="border-b border-[#EEF2F7] hover:bg-[#F8FAFC]/90 transition-colors align-top">
                        <td className="p-3 pl-5">
                          <div className="font-semibold text-[#111827]">{c.name}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <StatusBadge tone={contestStatusTone(c.status)}>{contestStatusLabelPt(c.status)}</StatusBadge>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            className="w-24 min-w-[5.5rem] border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm tabular-nums focus:border-[#1E7F43] focus:ring-2 focus:ring-[#1E7F43]/15 outline-none transition-shadow"
                            placeholder="—"
                            value={d.target}
                            onChange={(e) => patchReferralDraft(c.id, { target: e.target.value.replace(/\D/g, '') })}
                          />
                          <p className="text-[10px] text-[#9CA3AF] mt-1 max-w-[10rem]">Vazio = sem meta</p>
                        </td>
                        <td className="p-3">
                          <select
                            className="w-full max-w-[14rem] border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm bg-white focus:border-[#1E7F43] focus:ring-2 focus:ring-[#1E7F43]/15 outline-none"
                            value={d.rewardType}
                            onChange={(e) => {
                              const v = e.target.value as ReferralIndicationDraft['rewardType']
                              patchReferralDraft(c.id, {
                                rewardType: v,
                                ...(v !== 'manual_pix_bonus' ? { value: '' } : {}),
                              })
                            }}
                          >
                            <option value="">— Escolher —</option>
                            <option value="free_ticket">Jogo grátis (crédito)</option>
                            <option value="manual_pix_bonus">Bónus em dinheiro (Pix manual)</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={d.rewardType !== 'manual_pix_bonus'}
                            className="w-28 min-w-[7rem] border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm tabular-nums disabled:bg-[#F3F4F6] focus:border-[#1E7F43] focus:ring-2 focus:ring-[#1E7F43]/15 outline-none"
                            placeholder="0,00"
                            value={d.value}
                            onChange={(e) => patchReferralDraft(c.id, { value: e.target.value })}
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            className="w-20 min-w-[4.5rem] border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm tabular-nums focus:border-[#1E7F43] focus:ring-2 focus:ring-[#1E7F43]/15 outline-none"
                            placeholder="—"
                            title="Vazio = percentual do perfil do cambista"
                            value={d.sellerPctOverride}
                            onChange={(e) =>
                              patchReferralDraft(c.id, { sellerPctOverride: e.target.value.replace(',', '.') })
                            }
                          />
                          <p className="text-[10px] text-[#9CA3AF] mt-1 max-w-[8rem]">0–100 · vazio = perfil</p>
                        </td>
                        <td className="p-3 pr-5 text-right">
                          <button
                            type="button"
                            disabled={saving || loading}
                            onClick={() => void saveIndicationRulesForContest(c.id)}
                            className="inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-xl bg-[#1E7F43] text-white text-xs font-bold hover:bg-[#196c3a] shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
                          >
                            {saving ? 'A guardar…' : 'Guardar'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </AdminSection>

        {error && (
          <div className="flex flex-wrap items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 text-sm shadow-sm">
            <span className="flex-1 min-w-[12rem]">{error}</span>
            <button
              type="button"
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-900 text-xs font-semibold hover:bg-red-100/80"
              onClick={() => setError(null)}
            >
              Fechar
            </button>
          </div>
        )}

        <SellerOperationsPanel
          variant="admin"
          clients={operationClients}
          clientsLoading={loading}
          contests={contests}
          contestsLoading={loading}
          bonusUsers={bonusUsers}
          onError={(msg) => setError(msg)}
          onClientCreated={() => void reload().catch(() => {})}
          onSaleCompleted={async () => {
            await reload()
          }}
          onBonusSubmit={async (params) => {
            await adminCreateBonusParticipationRpc({
              userId: params.userId,
              contestId: params.contestId,
              numbers: params.numbers,
              reason: params.reason,
              consumeReferralCredit: params.consumeCredit,
            })
          }}
          onBonusCompleted={async () => {
            try {
              await reload()
            } catch (e) {
              throw new Error(
                e instanceof Error
                  ? `${e.message} (o bilhete pode já ter sido criado — actualize esta página ou confira em Participações)`
                  : 'Falhou ao atualizar a lista — o bilhete pode já ter sido criado; actualize a página.'
              )
            }
          }}
        />

        <AdminSection
          variant="amber"
          title="Clientes indicadores"
          description="Programa «Indique e Ganhe» — não confundir com cambistas. Créditos de jogos grátis e bónus Pix por bolão aparecem nesta vista."
        >
          <div className="overflow-x-auto">
            <table className="min-w-max w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
                  <th className="p-3 pl-5">Cliente</th>
                  <th className="p-3">Código ref.</th>
                  <th className="p-3 text-center">Bônus gerados</th>
                  <th className="p-3 text-right">Bônus Pix pendente</th>
                  <th className="p-3 text-right">Bônus Pix pago</th>
                  <th className="p-3 text-center">Jogos grátis disp.</th>
                  <th className="p-3 pr-5 text-center">Jogos grátis usados</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center">
                      Carregando…
                    </td>
                  </tr>
                ) : indicatorRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-[#9CA3AF] text-sm">
                      Nenhum cliente indicador listado.
                    </td>
                  </tr>
                ) : (
                  indicatorRows.map((u) => (
                    <tr key={u.id} className="border-b border-[#EEF2F7] hover:bg-[#FFFBEB]/40 transition-colors">
                      <td className="p-3 pl-5">
                        <div className="font-semibold text-[#111827]">{u.name}</div>
                        <div className="text-[11px] text-[#6B7280] break-all">{u.email}</div>
                      </td>
                      <td className="p-3 font-mono text-xs">{u.referral_code ?? '—'}</td>
                      <td className="p-3 text-center tabular-nums">{u.indication_rewards_count}</td>
                      <td className="p-3 text-right tabular-nums text-amber-800">
                        {formatCurrency(u.indication_pix_pending_brl)}
                      </td>
                      <td className="p-3 text-right tabular-nums text-[#166534]">
                        {formatCurrency(u.indication_pix_paid_brl)}
                      </td>
                      <td className="p-3 text-center font-semibold tabular-nums">{u.referral_bonus_credits ?? 0}</td>
                      <td className="p-3 pr-5 text-center tabular-nums text-[#374151]">
                        {u.referral_bonus_credits_used ?? 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AdminSection>

        <AdminSection
          variant="emerald"
          title="Vendedores (cambistas)"
          description="Percentuais, modo de comissão (primeira compra ou recorrente), conta activa e totais consolidados. Promova novos cambistas sem alterar o papel dos clientes indicadores."
          actions={
            <button
              type="button"
              onClick={() => void reload().catch(() => {})}
              className="inline-flex items-center justify-center rounded-xl border border-[#D1D5DB] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] shadow-sm hover:border-[#1E7F43]/45 hover:text-[#1E7F43] disabled:opacity-45 transition-colors"
              disabled={loading}
            >
              Atualizar dados
            </button>
          }
        >
          <div className="px-5 sm:px-6 py-5 border-b border-[#EEF1F6] bg-gradient-to-r from-[#F8FAFC] to-white">
            <p className="text-xs font-semibold text-[#111827] mb-2">Marcar novo vendedor</p>
            <p className="text-[11px] text-[#6B7280] mb-3 leading-relaxed max-w-3xl">
              Escolha um cliente registado na plataforma que ainda <strong>não</strong> seja cambista para adicioná-lo à tabela ao lado.
              Para retirar o papel de vendedor, desmarque a última coluna na linha desse usuário na tabela abaixo.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end max-w-3xl">
              <div className="flex-1 min-w-[14rem]">
                <CustomSelect
                  value={promoteToSellerUserId}
                  options={[
                    { value: '', label: nonSellerChoices.length ? 'Cliente ainda não vendedor…' : 'Todos já são ou não há usuários' },
                    ...nonSellerChoices.map((u) => ({
                      value: u.id,
                      label: `${u.name} (${u.email})`,
                    })),
                  ]}
                  onChange={(v: string) => setPromoteToSellerUserId(v)}
                  disabled={loading || nonSellerChoices.length === 0}
                />
              </div>
              <button
                type="button"
                disabled={loading || !promoteToSellerUserId || updatingUid !== null}
                className="shrink-0 px-5 py-2.5 rounded-xl bg-[#1E7F43] text-white text-sm font-bold hover:bg-[#196c3a] disabled:opacity-45 disabled:pointer-events-none"
                onClick={() => {
                  const uid = promoteToSellerUserId
                  if (!uid) return
                  setPromoteToSellerUserId('')
                  void toggleSeller(uid, true)
                }}
              >
                Tornar vendedor
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-max w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F1F5F9] text-left text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
                <th className="p-3 min-w-[10rem] pl-5">Vendedor</th>
                <th className="p-3 whitespace-nowrap">Código ref.</th>
                <th className="p-3 text-center whitespace-nowrap">Conta activa</th>
                <th className="p-3 min-w-[9rem]">Modo comissão</th>
                <th className="p-3 text-center whitespace-nowrap">%</th>
                <th className="p-3 text-center whitespace-nowrap">Clientes indicados</th>
                <th className="p-3 text-right whitespace-nowrap">Total vendido</th>
                <th className="p-3 text-right whitespace-nowrap">Comissão gerada</th>
                <th className="p-3 text-right whitespace-nowrap">Comissão pendente</th>
                <th className="p-3 text-right whitespace-nowrap">Comissão paga</th>
                <th className="p-3 pr-5 text-center whitespace-nowrap">Papel vendedor</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={theadCols} className="p-4 text-center">
                    Carregando…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={theadCols} className="p-12 text-center text-[#9CA3AF] text-sm">
                    Nenhum usuário encontrado para esta vista.
                  </td>
                </tr>
              ) : sellerRows.length === 0 ? (
                <tr>
                  <td colSpan={theadCols} className="p-12 text-center text-[#9CA3AF] text-sm">
                    Nenhum vendedor marcado neste momento — use{' '}
                    <strong>Marcar novo vendedor</strong> acima para acrescentar alguém.
                  </td>
                </tr>
              ) : (
                sellerRows.map((u) => {
                  return (
                    <tr key={u.id} className="border-b border-[#EEF2F7] hover:bg-[#ECFDF5]/35 transition-colors bg-[#FAFFFE]/80">
                      <td className="p-3 align-top pl-5">
                        <div className="font-semibold text-[#111827]">{u.name}</div>
                        <div className="text-[11px] text-[#6B7280] break-all mt-0.5">{u.email}</div>
                      </td>
                      <td className="p-3 font-mono text-xs text-[#374151] whitespace-nowrap">{u.referral_code ?? '—'}</td>
                      <td className="p-3 text-center align-middle">
                        <input
                          type="checkbox"
                          className="rounded border-[#D1D5DB] text-[#1E7F43] focus:ring-[#1E7F43]"
                          checked={u.is_active !== false}
                          onChange={(ev) => void setSellerAccountActive(u.id, ev.target.checked)}
                          disabled={updatingUid === u.id}
                          title="Utilizador pode iniciar sessão e comprar"
                          aria-label="Conta activa"
                        />
                      </td>
                      <td className="p-3 align-top">
                        <div className="flex flex-col gap-1.5 text-[11px] text-[#374151] leading-snug">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`seller_comm_mode_${u.id}`}
                              className="mt-0.5 shrink-0 accent-[#1E7F43]"
                              checked={u.commission_mode === 'first_purchase_only'}
                              onChange={() => void saveCommissionMode(u.id, 'first_purchase_only')}
                              disabled={updatingUid === u.id}
                            />
                            <span>Apenas primeira compra</span>
                          </label>
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`seller_comm_mode_${u.id}`}
                              className="mt-0.5 shrink-0 accent-[#1E7F43]"
                              checked={u.commission_mode !== 'first_purchase_only'}
                              onChange={() => void saveCommissionMode(u.id, 'recurring_purchases')}
                              disabled={updatingUid === u.id}
                            />
                            <span>Compras recorrentes</span>
                          </label>
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault()
                            const fd = new FormData(e.currentTarget)
                            void saveCommissionPct(u.id, String(fd.get(`pct_${u.id}`)))
                          }}
                          className="flex gap-1 justify-center items-center"
                        >
                          <input
                            name={`pct_${u.id}`}
                            defaultValue={Number(u.commission_percent ?? 5)}
                            className="w-14 border border-[#E5E7EB] rounded-lg px-1 py-1.5 text-xs text-center tabular-nums"
                            disabled={updatingUid === u.id}
                          />
                          <button
                            type="submit"
                            className="text-[10px] font-bold px-2 py-1 rounded-md bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB] disabled:opacity-40"
                            disabled={updatingUid === u.id}
                          >
                            OK
                          </button>
                        </form>
                      </td>
                      <td className="p-3 text-center tabular-nums font-semibold text-[#111827]">
                        {u.seller_indicated_clients_count ?? 0}
                      </td>
                      <td className="p-3 text-right tabular-nums font-medium text-[#111827]">
                        {formatCurrency(Number(u.total_sold_via_referral_brl || 0))}
                      </td>
                      <td className="p-3 text-right tabular-nums font-semibold text-[#111827]">
                        {formatCurrency(Number(u.commissions_generated_total_brl ?? 0))}
                      </td>
                      <td className="p-3 text-right tabular-nums text-[#B45309]">{formatCurrency(u.commissions_total_pending_brl)}</td>
                      <td className="p-3 text-right tabular-nums text-[#166534]">{formatCurrency(u.commissions_total_paid_brl)}</td>
                      <td className="p-3 pr-5 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-[#D1D5DB] text-[#1E7F43] focus:ring-[#1E7F43]"
                          checked={Boolean(u.is_seller)}
                          onChange={(ev) => void toggleSeller(u.id, ev.target.checked)}
                          disabled={updatingUid === u.id}
                          aria-label="É cambista"
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          </div>

          {/* MODIFIQUEI AQUI — contagem de linhas de comissão fora da tabela principal */}
          {!loading && sellerRows.length > 0 && (
            <div className="mx-5 mb-5 mt-2 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 sm:p-5">
              <h3 className="text-sm font-extrabold text-[#111827] mb-1">Registros na tabela de comissões (por vendedor)</h3>
              <p className="text-[11px] text-[#6B7280] mb-4 leading-relaxed">
                <strong>P</strong> = pendente (repasse) · <strong>Q</strong> = quitada/paga ao vendedor ·{' '}
                <strong>Cx</strong> = cancelada (não soma nos R$ vendidos aqui nesta lista).
              </p>
              <ul className="space-y-2 max-h-[min(22rem,50vh)] overflow-y-auto">
                {sellerRows.map((row) => {
                  const pend = row.commissions_sale_count_pending ?? 0
                  const quit = row.commissions_sale_count_paid ?? 0
                  const canc = row.commissions_sale_count_canceled ?? 0
                  const hasAny = pend + quit + canc > 0
                  return (
                    <li
                      key={`comm-lines-${row.id}`}
                      className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${
                        hasAny ? 'border-[#E5E7EB] bg-white' : 'border-dashed border-[#E5E7EB]/80 bg-white/70'
                      }`}
                    >
                      <div className="min-w-0 font-semibold text-[#111827] truncate sm:max-w-[14rem]" title={row.email}>
                        {row.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 tabular-nums text-xs font-semibold">
                        <span className="rounded-lg bg-[#FEF3C7] px-2 py-1 text-[#B45309]">P {pend}</span>
                        <span className="rounded-lg bg-[#DCFCE7] px-2 py-1 text-[#166534]">Q {quit}</span>
                        <span className="rounded-lg bg-[#F3F4F6] px-2 py-1 text-[#6B7280]">Cx {canc}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* MODIFIQUEI AQUI — legenda técnica curta */}
          <div className="p-5 text-[11px] text-[#64748B] border-t border-[#EEF1F6] bg-[#FAFBFC] space-y-1.5 leading-relaxed">
            <p>
              Comissões só entram quando o comprador usou link de <strong>cambista</strong> e o pagamento foi confirmado. O percentual
              vem do <strong>perfil do vendedor</strong>, salvo <strong>substituição por bolão</strong> na tabela{' '}
              <strong>Indique e Ganhe e % cambista</strong> no topo desta página.{' '}
              {/* MODIFIQUEI AQUI */}
              <strong>Modo comissão</strong>: «Apenas primeira compra» limita comissões à primeira venda{' '}
              <strong>paga e confirmada</strong> por cliente; «Compras recorrentes» mantém comissão em todas as vendas pagas (como antes).
            </p>
            <p className="text-[#6B7280]">
              Para <strong>bloquear ou liberar compras</strong> de um usuário (campo <strong>is_active</strong> no perfil), utilize a página{' '}
              <strong>Participantes</strong> no painel.
            </p>
          </div>
        </AdminSection>

        <AdminSection
          variant="neutral"
          title="Comissões por venda confirmada"
          description="Uma linha por participação ligada ao cambista após o pagamento estar confirmado no sistema. Use as acções para registar repasses Pix manuais."
        >
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F1F5F9] text-[11px] font-bold uppercase tracking-wide text-[#64748B] border-b border-[#E2E8F0]">
              <tr>
                <th className="p-3 pl-5 text-left">Participação</th>
                <th className="p-2 text-left">Vendedor</th>
                <th className="p-2 text-right">Valor venda</th>
                <th className="p-2 text-center">%</th>
                <th className="p-2 text-right">Valor comissão</th>
                <th className="p-2 text-center">Estado</th>
                <th className="p-2 text-left min-w-[7rem]">Obs. Pix / data</th>
                <th className="p-3 pr-5"></th>
              </tr>
            </thead>
            <tbody>
              {!loading && commissions.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-[#9CA3AF] text-sm">
                    Nenhum registro de comissão ainda.
                  </td>
                </tr>
              )}
              {commissions.map((cRow) => {
                const cs = payoutRowCommissionPt(cRow.status)
                return (
                  <tr key={cRow.id} className="border-b border-[#EEF2F7] hover:bg-[#F8FAFC] transition-colors">
                  <td className="p-3 pl-5 font-mono text-xs text-[#374151]">{cRow.participation_id.slice(0, 8)}…</td>
                  <td className="p-2 text-xs font-medium text-[#374151]">
                    {(userMap.get(cRow.seller_user_id)?.name || '—') + ''}
                  </td>
                  <td className="p-2 text-right tabular-nums">{formatCurrency(Number(cRow.sale_value))}</td>
                  <td className="p-2 text-center tabular-nums">{Number(cRow.commission_percent).toLocaleString('pt-BR')}%</td>
                  <td className="p-2 text-right tabular-nums font-semibold text-[#166534]">{formatCurrency(Number(cRow.commission_value))}</td>
                  <td className="p-2 text-center">
                    <StatusBadge tone={cs.tone}>{cs.label}</StatusBadge>
                  </td>
                  <td className="p-2 text-[11px] text-[#374151] max-w-[14rem]">
                    {cRow.paid_at && (
                      <div className="text-[#166534] font-semibold">{new Date(cRow.paid_at).toLocaleString('pt-BR')}</div>
                    )}
                    {cRow.admin_payment_note && <div>{cRow.admin_payment_note}</div>}
                    {cRow.status === 'pending' && (
                      <input
                        type="text"
                        className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs focus:border-[#1E7F43] focus:ring-2 focus:ring-[#1E7F43]/15 outline-none"
                        placeholder="Observação após Pix"
                        value={commissionPayNotes[cRow.id] ?? ''}
                        onChange={(e) =>
                          setCommissionPayNotes((s) => ({ ...s, [cRow.id]: e.target.value }))
                        }
                      />
                    )}
                  </td>
                  <td className="p-3 pr-5">
                    <div className="flex flex-wrap gap-2 justify-end">
                    {cRow.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 transition-colors"
                          onClick={() =>
                            void setCommissionPaidState(cRow.id, 'paid', commissionPayNotes[cRow.id])
                          }
                        >
                          Marcar pago
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100 transition-colors"
                          onClick={() => void setCommissionPaidState(cRow.id, 'canceled')}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </AdminSection>

        <AdminSection
          variant="amber"
          title="Bónus «Indique e Ganhe»"
          description="Jogos grátis (crédito automático na conta) ou valores Pix manuais — marque o pagamento aqui após transferência."
        >
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F1F5F9] text-[11px] font-bold uppercase tracking-wide text-[#64748B] border-b border-[#E2E8F0]">
              <tr>
                <th className="p-3 pl-5 text-left">Beneficiário</th>
                <th className="p-2 text-left">Bolão</th>
                <th className="p-2 text-center">Tipo</th>
                <th className="p-2 text-right">Valor</th>
                <th className="p-2 text-center">Meta (# vendas)</th>
                <th className="p-2 text-center">Estado</th>
                <th className="p-2 text-left">Obs. / pago em</th>
                <th className="p-3 pr-5"></th>
              </tr>
            </thead>
            <tbody>
              {!loading && indicationRewards.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-[#9CA3AF] text-sm">
                    Nenhum bônus por indicação registado (aplique a migração 043 e configure metas no concurso).
                  </td>
                </tr>
              )}
              {indicationRewards.map((ev) => {
                const st = payoutRowCommissionPt(ev.status)
                return (
                  <tr key={ev.id} className="border-b border-[#EEF2F7] hover:bg-[#FFFBEB]/35 transition-colors">
                  <td className="p-2 text-xs pl-5">
                    <span className="font-semibold text-[#374151]">{userMap.get(ev.beneficiary_profile_id)?.name || '—'}</span>
                  </td>
                  <td className="p-2 text-xs max-w-[10rem] break-words text-[#4B5563]">
                    {allContestsById.get(ev.contest_id)?.name ?? ev.contest_id.slice(0, 8)}
                  </td>
                  <td className="p-2 text-center text-xs">
                    <span className="inline-flex rounded-md bg-[#F3F4F6] px-2 py-0.5 font-medium text-[#374151]">
                      {ev.reward_type === 'free_ticket' ? 'Jogo grátis' : 'Pix manual'}
                    </span>
                  </td>
                  <td className="p-2 text-right tabular-nums font-medium">
                    {ev.reward_type === 'manual_pix_bonus' ? formatCurrency(Number(ev.amount_brl ?? 0)) : '—'}
                  </td>
                  <td className="p-2 text-center tabular-nums">{ev.sales_milestone_total}</td>
                  <td className="p-2 text-center">
                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                  </td>
                  <td className="p-2 text-[11px] text-[#374151] max-w-[14rem]">
                    {ev.paid_at && (
                      <div className="text-[#166534] font-semibold">{new Date(ev.paid_at).toLocaleString('pt-BR')}</div>
                    )}
                    {ev.admin_payment_note && <div>{ev.admin_payment_note}</div>}
                    {ev.reward_type === 'manual_pix_bonus' && ev.status === 'pending' && (
                      <input
                        type="text"
                        className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs focus:border-[#1E7F43] focus:ring-2 focus:ring-[#1E7F43]/15 outline-none"
                        placeholder="Observação após Pix"
                        value={indicationPayNotes[ev.id] ?? ''}
                        onChange={(e) =>
                          setIndicationPayNotes((s) => ({ ...s, [ev.id]: e.target.value }))
                        }
                      />
                    )}
                  </td>
                  <td className="p-3 pr-5">
                    {ev.reward_type === 'manual_pix_bonus' && ev.status === 'pending' && (
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 transition-colors"
                          onClick={() =>
                            void setIndicationRewardState(ev.id, 'paid', indicationPayNotes[ev.id])
                          }
                        >
                          Marcar pago
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100 transition-colors"
                          onClick={() => void setIndicationRewardState(ev.id, 'canceled')}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </AdminSection>

      </main>

      <Footer />
    </div>
  )
}
