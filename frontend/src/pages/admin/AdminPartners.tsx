/**
 * ADMIN — MODIFIQUEI AQUI: Cambistas/indicações, comissões e bonificações
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import CustomSelect from '../../components/CustomSelect'
import NumberPicker from '../../components/NumberPicker'
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
import { formatCurrency } from '../../utils/formatters'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [users, setUsers] = useState<PartnerUserRow[]>([])
  const [commissions, setCommissions] = useState<Awaited<ReturnType<typeof fetchCommissionsForAdmin>>>([])
  const [indicationRewards, setIndicationRewards] = useState<ReferralIndicationRewardAdminRow[]>([])
  const [contests, setContests] = useState<Contest[]>([])
  const [allContestsById, setAllContestsById] = useState<Map<string, Contest>>(new Map())
  const [updatingUid, setUpdatingUid] = useState<string | null>(null)
  const [bonusCreateOkMsg, setBonusCreateOkMsg] = useState<string | null>(null)
  const [bonusSubmitting, setBonusSubmitting] = useState(false)
  /** Erro próximo ao botão (banner global pode ficar fora da vista quando o cartão está em baixo na página). */
  const [bonusInlineError, setBonusInlineError] = useState<string | null>(null)
  const bonusFeedbackRef = useRef<HTMLDivElement>(null)

  const [referralDraftById, setReferralDraftById] = useState<Record<string, ReferralIndicationDraft>>({})
  const [savingReferralContestId, setSavingReferralContestId] = useState<string | null>(null)

  const [bonusForm, setBonusForm] = useState({
    userId: '',
    contestId: '',
    /** MODIFIQUEI AQUI: seleção no volante (substitui digitar texto) */
    selectedNumbers: [] as number[],
    reason: '',
    /** MODIFIQUEI AQUI: debitar 1 crédito da fila referral_bonus_credits do cliente */
    consumeCredit: false,
  })

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

  const contestsReferralOverview = useMemo(() => {
    const arr = Array.from(allContestsById.values())
    const order: Record<string, number> = { active: 0, draft: 1, finished: 2, cancelled: 3 }
    return arr.sort((a, b) => {
      const da = order[a.status] ?? 99
      const db = order[b.status] ?? 99
      if (da !== db) return da - db
      return a.name.localeCompare(b.name, 'pt')
    })
  }, [allContestsById])

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

  const contestForBonusPick = contests.find((c) => c.id === bonusForm.contestId)
  const userForBonusPick = users.find((u) => u.id === bonusForm.userId)

  /** Mobile: Safari costuma responder melhor a block center + scroll sem animação quando pointer coarse */
  const scrollBonusFeedbackIntoView = () => {
    const el = bonusFeedbackRef.current
    if (!el || typeof window === 'undefined') return
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches

    requestAnimationFrame(() => {
      el.scrollIntoView({
        behavior: reduceMotion ? 'auto' : coarse ? 'auto' : 'smooth',
        block: coarse ? 'center' : 'nearest',
        inline: 'nearest',
      })
    })
  }

  const showBonusProblem = (msg: string) => {
    setError(msg)
    setBonusInlineError(msg)
    scrollBonusFeedbackIntoView()
  }

  const submitAdminBonus = async () => {
    const nums = [...bonusForm.selectedNumbers].sort((a, b) => a - b)
    setBonusCreateOkMsg(null)
    setBonusInlineError(null)

    if (!bonusForm.userId || !bonusForm.contestId || nums.length === 0) {
      showBonusProblem(
        nums.length === 0 && contestForBonusPick
          ? `Selecione exatamente ${contestForBonusPick.numbers_per_participation} número(s) no grid abaixo.`
          : 'Preencha cliente, bolão ativo e a quantidade certa de números.'
      )
      return
    }

    const c = contests.find((x) => x.id === bonusForm.contestId)
    if (!c || nums.length !== c.numbers_per_participation) {
      showBonusProblem(
        `Quantidade inválida: este bolão exige exatamente ${c?.numbers_per_participation ?? '?'} número(s).`
      )
      return
    }

    const outOfRange = nums.some((n) => n < c.min_number || n > c.max_number)
    if (outOfRange) {
      showBonusProblem(`Números precisam estar entre ${c.min_number} e ${c.max_number}.`)
      return
    }

    if (bonusForm.consumeCredit) {
      if (!userForBonusPick || (userForBonusPick.referral_bonus_credits ?? 0) < 1) {
        showBonusProblem('Cliente sem crédito de bonificação disponível (ou usuário não selecionado).')
        return
      }
    }

    if (!bonusForm.reason.trim()) {
      showBonusProblem('Informe o motivo (auditoria) para esta bonificação.')
      return
    }

    setError(null)
    setBonusInlineError(null)
    setBonusSubmitting(true)

    try {
      await adminCreateBonusParticipationRpc({
        userId: bonusForm.userId,
        contestId: bonusForm.contestId,
        numbers: nums,
        reason: bonusForm.reason.trim(),
        consumeReferralCredit: bonusForm.consumeCredit,
      })
    } catch (e) {
      showBonusProblem(e instanceof Error ? e.message : 'Erro ao criar bilhete bonificado')
      return
    } finally {
      setBonusSubmitting(false)
    }

    setBonusForm({ userId: '', contestId: '', selectedNumbers: [], reason: '', consumeCredit: false })
    setBonusCreateOkMsg('Bilhete bonificado criado com sucesso.')
    scrollBonusFeedbackIntoView()

    try {
      await reload()
    } catch (e) {
      showBonusProblem(
        e instanceof Error
          ? `${e.message} (o bilhete pode já ter sido criado — actualize esta página ou confira em Participações)`
          : 'Falhou ao atualizar a lista — o bilhete pode já ter sido criado; actualize a página.'
      )
    }
  }

  const theadCols = 7 // MODIFIQUEI AQUI — grelha cambista simplificada

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-10 max-w-[100rem] space-y-10">
        <header className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1E7F43]/80 mb-1">Administração</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight mb-3">
                Parceiros e comissões
              </h1>
              <p className="text-[15px] text-[#374151] leading-relaxed">
                {/* MODIFIQUEI AQUI */}
                Separação explícita: <strong>clientes indicadores</strong> (programa «Indique e Ganhe», sem comissão) e{' '}
                <strong>cambistas</strong> (comissão % só sobre vendas <strong>pagas</strong>, sem carteira interna). Pagamentos de
                comissão e de bônus Pix são sempre <strong>manuais via Pix</strong>, registados aqui como pendentes ou pagos.
              </p>
            </div>
            {/* MODIFIQUEI AQUI: link de venda ficou apenas na área do vendedor (logado) */}
            <div className="shrink-0 rounded-xl bg-[#F0FDF4] border border-[#1E7F43]/20 px-4 py-3 text-sm text-[#14532D] max-w-md">
              <p className="font-semibold text-[#166534]">Link de indicação</p>
              <p className="mt-1 text-[13px] leading-snug text-[#15803d]/95">
                Cada vendedor copia e partilha o próprio URL em <strong>Meu link</strong> na navegação, após iniciar sessão.
                Mantém segurança (só vê o código próprio).
              </p>
            </div>
          </div>
        </header>

        <section className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-[#F3F4F6] bg-gradient-to-r from-[#ECFDF5] to-[#F0FDF4]">
            <h2 className="text-lg font-bold text-[#111827]">Indique e Ganhe e % cambista (por bolão)</h2>
            <p className="text-sm text-[#374151] mt-2 leading-relaxed max-w-4xl">
              Defina aqui a <strong>meta</strong> de indicação (a cada quantas <strong>vendas pagas</strong> ao código do indicador) e o{' '}
              <strong>prémio</strong>: <strong>jogo grátis</strong> (crédito automático, sem Pix) ou <strong>valor em R$</strong> (bónus
              Pix pendente até marcar pago mais abaixo). Deixe a meta vazia para desactivar o programa automático neste bolão.{' '}
              <strong>% cambista neste bolão</strong> substitui temporariamente o percentual do perfil do vendedor só para este concurso —
              deixe vazio para usar o do perfil.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F9FAFB] text-[11px] font-bold uppercase tracking-wide text-[#6B7280] border-b border-[#E5E7EB]">
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
                      Nenhum concurso encontrado.
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
                    const disabledRow = c.status === 'cancelled'
                    const saving = savingReferralContestId === c.id
                    return (
                      <tr key={c.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] align-top">
                        <td className="p-3 pl-5">
                          <div className="font-semibold text-[#111827]">{c.name}</div>
                          {disabledRow && (
                            <p className="text-[11px] text-amber-800 mt-1">Bolão cancelado — não editável.</p>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="inline-flex rounded-lg bg-[#F3F4F6] px-2 py-1 text-xs font-semibold text-[#374151]">
                            {contestStatusLabelPt(c.status)}
                          </span>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            disabled={disabledRow}
                            className="w-24 min-w-[5.5rem] border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm tabular-nums disabled:opacity-50"
                            placeholder="—"
                            value={d.target}
                            onChange={(e) => patchReferralDraft(c.id, { target: e.target.value.replace(/\D/g, '') })}
                          />
                          <p className="text-[10px] text-[#9CA3AF] mt-1 max-w-[10rem]">Vazio = sem meta</p>
                        </td>
                        <td className="p-3">
                          <select
                            className="w-full max-w-[14rem] border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm bg-white disabled:opacity-50"
                            disabled={disabledRow}
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
                            disabled={disabledRow || d.rewardType !== 'manual_pix_bonus'}
                            className="w-28 min-w-[7rem] border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm tabular-nums disabled:bg-[#F3F4F6]"
                            placeholder="0,00"
                            value={d.value}
                            onChange={(e) => patchReferralDraft(c.id, { value: e.target.value })}
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={disabledRow}
                            className="w-20 min-w-[4.5rem] border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm tabular-nums disabled:opacity-50"
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
                            disabled={disabledRow || saving || loading}
                            onClick={() => void saveIndicationRulesForContest(c.id)}
                            className="inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-xl bg-[#1E7F43] text-white text-xs font-bold hover:bg-[#196c3a] disabled:opacity-50 disabled:cursor-not-allowed"
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
        </section>

        {error && (
          <div className="flex flex-wrap items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
            <span className="flex-1 min-w-[12rem]">{error}</span>
            <button
              type="button"
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-900 text-xs font-semibold hover:bg-red-100/80"
              onClick={() => {
                setError(null)
                setBonusInlineError(null)
              }}
            >
              Fechar
            </button>
          </div>
        )}

        {bonusCreateOkMsg && (
          <div className="flex flex-wrap items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-900 text-sm">
            <span className="flex-1 min-w-[12rem]">{bonusCreateOkMsg}</span>
            <button
              type="button"
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-green-200 text-green-900 text-xs font-semibold hover:bg-green-100/80"
              onClick={() => setBonusCreateOkMsg(null)}
            >
              Fechar
            </button>
          </div>
        )}

        {/* MODIFIQUEI AQUI — bilhete bonificado manual */}
        <section className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <h2 className="text-lg font-bold text-[#111827] mb-1">Nova participação bonificada</h2>
          <p className="text-xs text-[#6B7280] mb-5 font-medium">Uso restrito ao painel administrativo</p>
          <p className="text-xs text-[#374151]/80 mb-6 leading-relaxed max-w-4xl">
            Gera bilhete com valor <strong>R$ 0,00</strong>, não gera comissão e <strong>não altera</strong> a arrecadação
            públicamente contabilizada. <strong>O cliente não precisa ter créditos de indicação</strong>: deixando a opção abaixo
            desmarcada é uma bonificação puramente institucional. Só marque <strong>Debitar 1 crédito…</strong> quando quiser debitar{' '}
            <strong>1 crédito</strong> da fila de bonificação (o motivo será complementado para auditoria).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                Cliente
              </label>
              <CustomSelect
                value={bonusForm.userId}
                options={[{ value: '', label: 'Escolha o usuário…' }, ...users.map((u) => ({
                  value: u.id,
                  label: `${u.name} (${u.email})`,
                }))]}
                onChange={(v: string) => setBonusForm((s) => ({ ...s, userId: v }))}
              />
            </div>

            <div className="md:col-span-2 md:grid md:grid-cols-1">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                Bolão ativo
              </label>
              <CustomSelect
                value={bonusForm.contestId}
                options={[{ value: '', label: 'Escolha o bolão…' }, ...contests.map((c) => ({
                  value: c.id,
                  label: `${c.name} • ${c.numbers_per_participation} número(s) • ${formatCurrency(Number(c.participation_value ?? 0))}`,
                }))]}
                onChange={(v: string) => setBonusForm((s) => ({ ...s, contestId: v, selectedNumbers: [] }))}
              />
              {!!contestForBonusPick && (
                <p className="mt-1 text-xs text-[#6B7280]">
                  Regra atual:{' '}
                  <strong>{contestForBonusPick.numbers_per_participation}</strong> números, intervalo{' '}
                  {contestForBonusPick.min_number}–{contestForBonusPick.max_number}.
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              {/* MODIFIQUEI AQUI — mesmo volante das participações públicas */}
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-2">
                Números{' '}
                {contestForBonusPick
                  ? `(${contestForBonusPick.numbers_per_participation} valores · toque nos botões)`
                  : '(escolha o bolão primeiro)'}
              </label>
              {contestForBonusPick ? (
                <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFB] p-4">
                  <NumberPicker
                    min={contestForBonusPick.min_number}
                    max={contestForBonusPick.max_number}
                    maxSelected={contestForBonusPick.numbers_per_participation}
                    selectedNumbers={bonusForm.selectedNumbers}
                    onChange={(numbers) => setBonusForm((s) => ({ ...s, selectedNumbers: numbers }))}
                  />
                </div>
              ) : (
                <p className="text-sm text-[#6B7280]">Selecione um bolão ativo para abrir o painel numérico.</p>
              )}
            </div>
            <div className="md:col-span-2 flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFB] px-3 py-3 sm:px-4">
              {/* Área tocável ≥44×44 px (WCAG/mobile) centrando o checkbox nativo pequeno */}
              <span className="mt-1 flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center self-start">
                <input
                  id="bonus-consume-credit"
                  type="checkbox"
                  className="h-7 w-7 cursor-pointer accent-[#1E7F43] touch-manipulation"
                  aria-label="Debitar um crédito de bonificação do cliente"
                  checked={bonusForm.consumeCredit}
                  onChange={(ev) => {
                    const credits = userForBonusPick?.referral_bonus_credits ?? 0
                    if (ev.target.checked && credits < 1) return
                    setBonusForm((s) => ({ ...s, consumeCredit: ev.target.checked }))
                  }}
                />
              </span>
              <label
                htmlFor="bonus-consume-credit"
                className="min-w-0 flex-1 text-sm leading-snug text-[#374151] touch-manipulation"
              >
                <strong>Debitar 1 crédito de bonificação do cliente (opcional)</strong>
                {!userForBonusPick && (
                  <span className="block text-xs text-[#6B7280] mt-0.5">Escolha um cliente para ver o saldo de créditos.</span>
                )}
                {!!userForBonusPick && (
                  <span className="block text-xs text-[#6B7280] mt-0.5">
                    Sem marcar esta opção, criar mesmo com <strong>0</strong> créditos disponíveis é permitido — bilhete
                    institucional, sem tocar na arrecadação. Disponível agora:{' '}
                    <strong>{userForBonusPick.referral_bonus_credits ?? 0}</strong>; já utilizados (consumo nesta fila):{' '}
                    <strong>{userForBonusPick.referral_bonus_credits_used ?? 0}</strong>.
                  </span>
                )}
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                Motivo (auditoria)
              </label>
              <input
                type="text"
                enterKeyHint="done"
                className="w-full min-h-[48px] border border-[#E5E7EB] rounded-xl px-3 py-3 sm:py-2.5 text-[16px] md:text-[15px] text-[#111827] focus:ring-2 focus:ring-[#1E7F43]/25 focus:border-[#1E7F43]"
                value={bonusForm.reason}
                onChange={(e) => setBonusForm((s) => ({ ...s, reason: e.target.value }))}
                placeholder="Ex.: Promoção institucional, correção cadastral, etc."
              />
            </div>
          </div>
          <div
            ref={bonusFeedbackRef}
            className="mt-6 space-y-3 scroll-mt-28 sm:scroll-mt-24"
            aria-live="polite"
          >
            <button
              type="button"
              onClick={() => {
                void submitAdminBonus().catch((e) => {
                  console.error('[AdminPartners] submitAdminBonus', e)
                  showBonusProblem(e instanceof Error ? e.message : 'Erro inesperado ao criar bilhete.')
                })
              }}
              disabled={bonusSubmitting}
              className="w-full sm:w-auto min-h-[48px] px-6 py-3 sm:py-2.5 rounded-xl bg-[#1E7F43] text-white text-[15px] sm:text-sm font-bold shadow-sm hover:bg-[#196c3a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation active:brightness-95"
            >
              {bonusSubmitting ? 'A criar…' : 'Criar bilhete bonificado'}
            </button>
            {bonusInlineError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-3 sm:py-2 break-words overflow-x-hidden [overflow-wrap:anywhere] leading-relaxed">
                {bonusInlineError}
              </p>
            )}
          </div>
        </section>

        {/* MODIFIQUEI AQUI — clientes indicadores (não cambistas) */}
        <section className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-[#F3F4F6] bg-[#FFFBEB]">
            <h2 className="text-lg font-bold text-[#111827]">Clientes indicadores</h2>
            <p className="text-xs text-[#6B7280] mt-1">
              Utilizadores que participam do «Indique e Ganhe» (não marcar como cambista). Jogos grátis e bônus Pix são geridos separadamente das comissões.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-max w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-left text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">
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
                    <tr key={u.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
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
        </section>

        {/* Usuários / vendedores */}
        <section className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-[#F3F4F6] flex flex-wrap items-center justify-between gap-3 bg-[#FAFAFB]">
            <div>
              <h2 className="text-lg font-bold text-[#111827]">Vendedores</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Lista só usuários marcados como vendedores. Código ref. para auditoria; clientes não vendedores não entram aqui.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void reload().catch(() => {})}
              className="text-sm px-4 py-2 rounded-xl border border-[#E5E7EB] bg-white font-semibold text-[#374151] hover:border-[#1E7F43]/35 hover:text-[#1E7F43] disabled:opacity-50 transition-colors"
              disabled={loading}
            >
              Atualizar lista
            </button>
          </div>

          {/* MODIFIQUEI AQUI — novo vendedor sem listar toda base na tabela */}
          <div className="px-5 sm:px-6 pb-5 border-b border-[#F3F4F6] bg-[#FAFAFB]">
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
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-left text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">
                <th className="p-3 min-w-[10rem] pl-5">Vendedor</th>
                <th className="p-3">Código ref.</th>
                <th className="p-3 text-right">Total vendido via link</th>
                <th className="p-3 text-center">%</th>
                <th className="p-3 text-right">Comissão pendente</th>
                <th className="p-3 text-right">Comissão paga</th>
                <th className="p-3 pr-5 text-center">Papel vendedor</th>
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
                    <tr key={u.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors bg-[#F0FDF4]/40">
                      <td className="p-3 align-top pl-5">
                        <div className="font-semibold text-[#111827]">{u.name}</div>
                        <div className="text-[11px] text-[#6B7280] break-all mt-0.5">{u.email}</div>
                      </td>
                      <td className="p-3 font-mono text-xs text-[#374151] whitespace-nowrap">{u.referral_code ?? '—'}</td>
                      <td className="p-3 text-right tabular-nums font-medium text-[#111827]">
                        {formatCurrency(Number(u.total_sold_via_referral_brl || 0))}
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
                      <td className="p-3 text-right tabular-nums text-[#B45309]">{formatCurrency(u.commissions_total_pending_brl)}</td>
                      <td className="p-3 text-right tabular-nums text-[#166534]">{formatCurrency(u.commissions_total_paid_brl)}</td>
                      <td className="p-3 pr-5 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-[#D1D5DB] text-[#1E7F43] focus:ring-[#1E7F43]"
                          checked={Boolean(u.is_seller)}
                          onChange={(ev) => void toggleSeller(u.id, ev.target.checked)}
                          disabled={updatingUid === u.id}
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
          <div className="p-5 text-[11px] text-[#6B7280] border-t border-[#F3F4F6] bg-[#FAFAFB] space-y-1.5 leading-relaxed">
            <p>
              Comissões só entram quando o comprador usou link de <strong>cambista</strong> e o pagamento foi confirmado. O percentual
              vem do <strong>perfil do vendedor</strong>, salvo <strong>substituição por bolão</strong> na tabela{' '}
              <strong>Indique e Ganhe e % cambista</strong> no topo desta página.
            </p>
            <p className="text-[#6B7280]">
              Para <strong>bloquear ou liberar compras</strong> de um usuário (campo <strong>is_active</strong> no perfil), utilize a página{' '}
              <strong>Participantes</strong> no painel.
            </p>
          </div>
        </section>

        {/* Comissões */}
        <section className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-[#F3F4F6]">
            <h2 className="text-lg font-bold text-[#111827]">Comissões por venda confirmada</h2>
            <p className="text-xs text-[#6B7280] mt-1">Uma linha por participação ligada ao vendedor após pagamento</p>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F9FAFB] text-[11px] font-bold uppercase tracking-wide text-[#6B7280] border-b border-[#E5E7EB]">
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
              {commissions.map((cRow) => (
                <tr key={cRow.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                  <td className="p-3 pl-5 font-mono text-xs text-[#374151]">{cRow.participation_id.slice(0, 8)}…</td>
                  <td className="p-2 text-xs">
                    {(userMap.get(cRow.seller_user_id)?.name || '—') + ''}
                  </td>
                  <td className="p-2 text-right tabular-nums">{formatCurrency(Number(cRow.sale_value))}</td>
                  <td className="p-2 text-center">{Number(cRow.commission_percent).toLocaleString('pt-BR')}%</td>
                  <td className="p-2 text-right tabular-nums">{formatCurrency(Number(cRow.commission_value))}</td>
                  <td className="p-2 text-center uppercase text-xs">{cRow.status}</td>
                  <td className="p-2 text-[11px] text-[#374151] max-w-[14rem]">
                    {cRow.paid_at && (
                      <div className="text-[#166534] font-semibold">{new Date(cRow.paid_at).toLocaleString('pt-BR')}</div>
                    )}
                    {cRow.admin_payment_note && <div>{cRow.admin_payment_note}</div>}
                    {cRow.status === 'pending' && (
                      <input
                        type="text"
                        className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-2 py-1 text-xs"
                        placeholder="Observação após Pix"
                        value={commissionPayNotes[cRow.id] ?? ''}
                        onChange={(e) =>
                          setCommissionPayNotes((s) => ({ ...s, [cRow.id]: e.target.value }))
                        }
                      />
                    )}
                  </td>
                  <td className="p-3 pr-5 flex gap-2 justify-end flex-wrap">
                    {cRow.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="text-xs text-green-700 underline"
                          onClick={() =>
                            void setCommissionPaidState(cRow.id, 'paid', commissionPayNotes[cRow.id])
                          }
                        >
                          Marcar pago via Pix
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-600 underline"
                          onClick={() => void setCommissionPaidState(cRow.id, 'canceled')}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>

        {/* MODIFIQUEI AQUI — bônus por indicação (novo modelo por bolão) */}
        <section className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden mb-16">
          <div className="p-5 sm:p-6 border-b border-[#F3F4F6]">
            <h2 className="text-lg font-bold text-[#111827]">Bônus «Indique e Ganhe»</h2>
            <p className="text-xs text-[#6B7280] mt-1">
              Jogos grátis (entregue automaticamente como crédito) ou bônus Pix pendente até o ADM marcar pago após pagamento manual.
            </p>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F9FAFB] text-[11px] font-bold uppercase tracking-wide text-[#6B7280] border-b border-[#E5E7EB]">
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
              {indicationRewards.map((ev) => (
                <tr key={ev.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                  <td className="p-2 text-xs pl-5">
                    <span className="font-medium">{userMap.get(ev.beneficiary_profile_id)?.name || '—'}</span>
                  </td>
                  <td className="p-2 text-xs max-w-[10rem] break-words">
                    {allContestsById.get(ev.contest_id)?.name ?? ev.contest_id.slice(0, 8)}
                  </td>
                  <td className="p-2 text-center text-xs">
                    {ev.reward_type === 'free_ticket' ? 'Jogo grátis' : 'Pix manual'}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {ev.reward_type === 'manual_pix_bonus' ? formatCurrency(Number(ev.amount_brl ?? 0)) : '—'}
                  </td>
                  <td className="p-2 text-center tabular-nums">{ev.sales_milestone_total}</td>
                  <td className="p-2 text-center uppercase text-xs">{ev.status}</td>
                  <td className="p-2 text-[11px] text-[#374151] max-w-[14rem]">
                    {ev.paid_at && (
                      <div className="text-[#166534] font-semibold">{new Date(ev.paid_at).toLocaleString('pt-BR')}</div>
                    )}
                    {ev.admin_payment_note && <div>{ev.admin_payment_note}</div>}
                    {ev.reward_type === 'manual_pix_bonus' && ev.status === 'pending' && (
                      <input
                        type="text"
                        className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-2 py-1 text-xs"
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
                          className="text-xs text-green-700 underline"
                          onClick={() =>
                            void setIndicationRewardState(ev.id, 'paid', indicationPayNotes[ev.id])
                          }
                        >
                          Marcar pago via Pix
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-600 underline"
                          onClick={() => void setIndicationRewardState(ev.id, 'canceled')}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
