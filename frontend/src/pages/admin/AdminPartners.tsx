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
  fetchReferralBonusEventsForAdmin,
  listUsersWithTotalsForPartners,
  updateCommissionStatusAdmin,
  updateUserSellerFieldsAdmin,
  adminCreateBonusParticipationRpc,
  type PartnerUserRow,
} from '../../services/partnersAdminService'
import { listAllContests } from '../../services/contestsService'
import type { Contest } from '../../types'
import { formatCurrency } from '../../utils/formatters'
import { normalizeIsSellerFlag } from '../../services/profilesService'

export default function AdminPartners() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [users, setUsers] = useState<PartnerUserRow[]>([])
  const [commissions, setCommissions] = useState<Awaited<ReturnType<typeof fetchCommissionsForAdmin>>>([])
  const [bonusEvents, setBonusEvents] = useState<Awaited<ReturnType<typeof fetchReferralBonusEventsForAdmin>>>([])
  const [contests, setContests] = useState<Contest[]>([])
  const [updatingUid, setUpdatingUid] = useState<string | null>(null)
  const [bonusCreateOkMsg, setBonusCreateOkMsg] = useState<string | null>(null)
  const [bonusSubmitting, setBonusSubmitting] = useState(false)
  /** Erro próximo ao botão (banner global pode ficar fora da vista quando o cartão está em baixo na página). */
  const [bonusInlineError, setBonusInlineError] = useState<string | null>(null)
  const bonusFeedbackRef = useRef<HTMLDivElement>(null)

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

  const nonSellerChoices = useMemo(
    () => users.filter((u) => !normalizeIsSellerFlag(u.is_seller)),
    [users]
  )

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const [uRows, commRows, beRows, cts] = await Promise.all([
        listUsersWithTotalsForPartners(),
        fetchCommissionsForAdmin(),
        fetchReferralBonusEventsForAdmin(),
        listAllContests(),
      ])
      const activeOnly = cts.filter((x) => x.status === 'active')

      setUsers(uRows)
      setCommissions(commRows)
      setBonusEvents(beRows)
      setContests(activeOnly)
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

  const setCommissionPaidState = async (id: string, status: 'pending' | 'paid' | 'canceled') => {
    try {
      await updateCommissionStatusAdmin(id, status)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar comissão')
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

  const theadCols = 11 // MODIFIQUEI AQUI — Linhas (#) foram para o bloco abaixo da tabela

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
                Gestão fiscal de cambistas e clientes indicados: comissões apenas sobre vendas <strong>pagas</strong>.
                Percentual padrão <strong>5%</strong>. A cada <strong>10</strong> vendas qualificadas o sistema concede{' '}
                <strong>1</strong> crédito para bilhete bonificado (sem arrecadação e sem nova comissão).
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
                <th className="p-3 text-center">Qualif. vendas</th>
                <th className="p-3 text-center">Bonif. disp.</th>
                <th className="p-3 text-center">Bonif. usadas</th>
                <th className="p-3 text-center">Bonif. geradas</th>
                <th className="p-3 text-right">Total vendido via indicação</th>
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
                      <td className="p-3 text-center tabular-nums text-[#374151]">{u.referral_qualifying_sales_count ?? 0}</td>
                      <td className="p-3 text-center font-semibold tabular-nums text-[#111827]">{u.referral_bonus_credits ?? 0}</td>
                      <td className="p-3 text-center tabular-nums text-[#374151]">{u.referral_bonus_credits_used ?? 0}</td>
                      <td className="p-3 text-center tabular-nums text-[#374151]">{u.referral_credits_generated_milestones}</td>
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
              “Qualif. vendas” = vendas <strong>pagas</strong> válidas já contabilizadas na fila das “de 10”. A listagem{' '}
              <strong>P / Q / Cx</strong> aparece na caixa <strong>&quot;Registros na tabela de comissões&quot;</strong> acima desta legenda.
            </p>
            <p>Comissão considera apenas vendas onde o cliente era <strong>vendedor</strong> (% &gt; 0) quando o PIX foi quitado.</p>
            {/* MODIFIQUEI AQUI — ativar/inativar conta do cliente: ADM → Participantes */}
            <p className="text-[#6B7280]">
              Para <strong>bloquear ou liberar compras</strong> de um usuário (campo <strong>is_active</strong> no perfil), utilize a página <strong>Participantes</strong> no painel.
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
                <th className="p-3 pr-5"></th>
              </tr>
            </thead>
            <tbody>
              {!loading && commissions.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-[#9CA3AF] text-sm">
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
                  <td className="p-3 pr-5 flex gap-2 justify-end flex-wrap">
                    {cRow.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="text-xs text-green-700 underline"
                          onClick={() => void setCommissionPaidState(cRow.id, 'paid')}
                        >
                          Marcar pago
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

        {/* Eventos bonificação 10 */}
        <section className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden mb-16">
          <div className="p-5 sm:p-6 border-b border-[#F3F4F6]">
            <h2 className="text-lg font-bold text-[#111827]">Bonificações geradas</h2>
            <p className="text-xs text-[#6B7280] mt-1">Créditos atribuídos a cada marco de 10 vendas pagas válidas</p>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F9FAFB] text-[11px] font-bold uppercase tracking-wide text-[#6B7280] border-b border-[#E5E7EB]">
              <tr>
                <th className="p-3 pl-5 text-left">Beneficiário</th>
                <th className="p-2 text-center">Marco (# vendas pagas válidas)</th>
                <th className="p-2 text-center">Créditos</th>
                <th className="p-3 pr-5 text-left">Em</th>
              </tr>
            </thead>
            <tbody>
              {!loading && bonusEvents.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-[#9CA3AF] text-sm">
                    Nenhum evento de bonificação registado.
                  </td>
                </tr>
              )}
              {bonusEvents.map((ev) => (
                <tr key={ev.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                  <td className="p-2 text-xs">
                    <span className="font-medium">{userMap.get(ev.beneficiary_profile_id)?.name || '—'}</span>
                    <div className="font-mono text-[10px] text-[#1F1F1F]/40">{ev.beneficiary_profile_id}</div>
                  </td>
                  <td className="p-2 text-center tabular-nums">{ev.milestone_total}</td>
                  <td className="p-2 text-center tabular-nums">{ev.credits_granted}</td>
                  <td className="p-2">{new Date(ev.created_at).toLocaleString('pt-BR')}</td>
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
