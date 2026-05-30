import { useRef, useState, type ReactNode } from 'react'
import CustomSelect from './CustomSelect'
import NumberPicker from './NumberPicker'
import { formatCurrency } from '../utils/formatters'
import type { Contest } from '../types'

export type BonusParticipationUserOption = {
  id: string
  name: string
  email: string
  referral_bonus_credits?: number
  referral_bonus_credits_used?: number
}

function SectionShell({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_16px_rgba(31,31,31,0.06)] overflow-hidden ring-1 ring-[#1F1F1F]/[0.04]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-[#EEF1F6] bg-gradient-to-br from-[#F8FAFC] via-white to-[#FAFBFC]">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#64748B]" aria-hidden />
            <h2 className="text-lg sm:text-xl font-bold text-[#1F1F1F] tracking-tight">{title}</h2>
          </div>
          {description ? (
            <div className="text-sm text-[#4B5563] leading-relaxed max-w-4xl">{description}</div>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  )
}

type BonusParticipationSectionProps = {
  title?: string
  description?: ReactNode
  users: BonusParticipationUserOption[]
  contests: Contest[]
  usersLoading?: boolean
  contestsLoading?: boolean
  /** Oculta checkbox de consumo de crédito de indicação (ex.: área do cambista). */
  showConsumeCreditOption?: boolean
  onSubmit: (params: {
    userId: string
    contestId: string
    numbers: number[]
    reason: string
    consumeCredit: boolean
  }) => Promise<void>
  onError?: (message: string) => void
}

export default function BonusParticipationSection({
  title = 'Nova participação bonificada',
  description,
  users,
  contests,
  usersLoading = false,
  contestsLoading = false,
  showConsumeCreditOption = true,
  onSubmit,
  onError,
}: BonusParticipationSectionProps) {
  const bonusFeedbackRef = useRef<HTMLDivElement>(null)
  const [bonusForm, setBonusForm] = useState({
    userId: '',
    contestId: '',
    selectedNumbers: [] as number[],
    reason: '',
    consumeCredit: false,
  })
  const [bonusSubmitting, setBonusSubmitting] = useState(false)
  const [bonusInlineError, setBonusInlineError] = useState<string | null>(null)
  const [bonusCreateOkMsg, setBonusCreateOkMsg] = useState<string | null>(null)

  const contestForBonusPick = contests.find((c) => c.id === bonusForm.contestId)
  const userForBonusPick = users.find((u) => u.id === bonusForm.userId)

  const scrollBonusFeedbackIntoView = () => {
    const el = bonusFeedbackRef.current
    if (!el || typeof window === 'undefined') return
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

    requestAnimationFrame(() => {
      el.scrollIntoView({
        behavior: reduceMotion ? 'auto' : coarse ? 'auto' : 'smooth',
        block: coarse ? 'center' : 'nearest',
        inline: 'nearest',
      })
    })
  }

  const showBonusProblem = (msg: string) => {
    setBonusInlineError(msg)
    onError?.(msg)
    scrollBonusFeedbackIntoView()
  }

  const submitBonus = async () => {
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

    if (showConsumeCreditOption && bonusForm.consumeCredit) {
      if (!userForBonusPick || (userForBonusPick.referral_bonus_credits ?? 0) < 1) {
        showBonusProblem('Cliente sem crédito de bonificação disponível (ou usuário não selecionado).')
        return
      }
    }

    if (!bonusForm.reason.trim()) {
      showBonusProblem('Informe o motivo (auditoria) para esta bonificação.')
      return
    }

    setBonusSubmitting(true)
    try {
      await onSubmit({
        userId: bonusForm.userId,
        contestId: bonusForm.contestId,
        numbers: nums,
        reason: bonusForm.reason.trim(),
        consumeCredit: bonusForm.consumeCredit,
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
  }

  const userOptions = [
    {
      value: '',
      label: usersLoading ? 'Carregando clientes…' : users.length ? 'Escolha o usuário…' : 'Nenhum cliente vinculado',
    },
    ...users.map((u) => ({
      value: u.id,
      label: `${u.name} (${u.email})`,
    })),
  ]

  const contestOptions = [
    {
      value: '',
      label: contestsLoading ? 'Carregando bolões…' : contests.length ? 'Escolha o bolão…' : 'Nenhum bolão ativo',
    },
    ...contests.map((c) => ({
      value: c.id,
      label: `${c.name} • ${c.numbers_per_participation} número(s) • ${formatCurrency(Number(c.participation_value ?? 0))}`,
    })),
  ]

  return (
    <>
      {bonusCreateOkMsg && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 text-sm shadow-sm">
          <span className="flex-1 min-w-[12rem]">{bonusCreateOkMsg}</span>
          <button
            type="button"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-950 text-xs font-semibold hover:bg-emerald-50"
            onClick={() => setBonusCreateOkMsg(null)}
          >
            Fechar
          </button>
        </div>
      )}

      <SectionShell title={title} description={description}>
        <div className="px-4 sm:px-6 md:px-8 pb-6 md:pb-8 pt-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                Cliente
              </label>
              <CustomSelect
                value={bonusForm.userId}
                options={userOptions}
                onChange={(v: string) => setBonusForm((s) => ({ ...s, userId: v }))}
                disabled={usersLoading}
              />
            </div>

            <div className="md:col-span-2 md:grid md:grid-cols-1">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                Bolão ativo
              </label>
              <CustomSelect
                value={bonusForm.contestId}
                options={contestOptions}
                onChange={(v: string) => setBonusForm((s) => ({ ...s, contestId: v, selectedNumbers: [] }))}
                disabled={contestsLoading}
              />
              {!!contestForBonusPick && (
                <p className="mt-1 text-xs text-[#6B7280]">
                  Regra atual: <strong>{contestForBonusPick.numbers_per_participation}</strong> números, intervalo{' '}
                  {contestForBonusPick.min_number}–{contestForBonusPick.max_number}.
                </p>
              )}
            </div>

            <div className="md:col-span-2">
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

            {showConsumeCreditOption && (
            <div className="md:col-span-2 flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFB] px-3 py-3 sm:px-4">
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
            )}

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

          <div ref={bonusFeedbackRef} className="mt-6 space-y-3 scroll-mt-28 sm:scroll-mt-24" aria-live="polite">
            <button
              type="button"
              onClick={() => {
                void submitBonus().catch((e) => {
                  console.error('[BonusParticipationSection] submitBonus', e)
                  showBonusProblem(e instanceof Error ? e.message : 'Erro inesperado ao criar bilhete.')
                })
              }}
              disabled={bonusSubmitting || usersLoading || contestsLoading}
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
        </div>
      </SectionShell>
    </>
  )
}
