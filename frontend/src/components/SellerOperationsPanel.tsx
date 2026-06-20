import { useMemo, useRef, useState, useEffect, type ReactNode } from 'react'
import CustomSelect from './CustomSelect'
import NumberPicker from './NumberPicker'
import MobilePhoneCountryInput from './MobilePhoneCountryInput'
import { formatCurrency } from '../utils/formatters'
import {
  BIRTH_DATE_MIN,
  brDigitsToIso,
  formatBirthDateMask,
  getMaxBirthDateForAdultsIso,
  isoDateToBrDigits,
  isValidAdultBirthDate,
} from '../utils/birthDate'
import type { Contest } from '../types'
import type { SellerBonusClientRow, SellerCreateClientResult } from '../services/sellerAreaService'
import {
  sellerCreateClient,
  sellerCreateCashSale,
  sellerCreatePixSale,
  sellerCancelPendingPixPayment,
} from '../services/sellerAreaService'
import SellerPixCheckoutModal from './SellerPixCheckoutModal'

type TabId = 'sale' | 'account'

type SellerOperationsPanelProps = {
  clients: SellerBonusClientRow[]
  clientsLoading?: boolean
  contests: Contest[]
  contestsLoading?: boolean
  commissionPercent?: number
  commissionMode?: 'first_purchase_only' | 'recurring_purchases'
  onError?: (message: string) => void
  onClientCreated?: () => void | Promise<void>
  onSaleCompleted?: () => void | Promise<void>
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
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#1E7F43]" aria-hidden />
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

function formatBrazilPhoneDisplay(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)
  if (rest.length === 0) return `${ddd} `
  const mobileFirst = rest[0] === '9'
  if (d.length === 11) return `${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`
  if (d.length === 10) return `${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`
  if (mobileFirst) {
    if (rest.length <= 5) return `${ddd} ${rest}`
    return `${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`
  }
  if (rest.length <= 4) return `${ddd} ${rest}`
  return `${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`
}

function normalizeCpf(cpfValue: string): string {
  return cpfValue.replace(/\D/g, '')
}

function validateCpf(cpfValue: string): boolean {
  const cleanCpf = normalizeCpf(cpfValue)
  if (cleanCpf.length !== 11) return false
  if (/^(\d)\1+$/.test(cleanCpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cleanCpf[i]) * (10 - i)
  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cleanCpf[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cleanCpf[i]) * (11 - i)
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  return remainder === parseInt(cleanCpf[10])
}

function formatCpf(cpfValue: string): string {
  const cleanCpf = normalizeCpf(cpfValue)
  if (cleanCpf.length <= 3) return cleanCpf
  if (cleanCpf.length <= 6) return `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3)}`
  if (cleanCpf.length <= 9) return `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6)}`
  return `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9, 11)}`
}

function getAuthPhoneDigits(national: string, dial: string): string {
  const n = national.replace(/\D/g, '')
  if (dial === '55') return n
  return `${dial}${n}`
}

function formatLoginPhoneDisplay(phoneDigits: string): string {
  if (phoneDigits.startsWith('55') && phoneDigits.length >= 12) {
    return formatBrazilPhoneDisplay(phoneDigits.slice(2))
  }
  return phoneDigits
}

function validatePhone(national: string, dial: string): boolean {
  const clean = national.replace(/\D/g, '')
  if (dial === '55') return clean.length >= 10 && clean.length <= 11
  return clean.length >= 6 && clean.length <= 15
}

const TAB_LABELS: Record<TabId, string> = {
  sale: 'Nova venda',
  account: 'Novo cliente',
}

export default function SellerOperationsPanel({
  clients,
  clientsLoading = false,
  contests,
  contestsLoading = false,
  commissionPercent,
  commissionMode,
  onError,
  onClientCreated,
  onSaleCompleted,
}: SellerOperationsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('sale')
  const feedbackRef = useRef<HTMLDivElement>(null)

  const [saleForm, setSaleForm] = useState({
    userId: '',
    contestId: '',
    selectedNumbers: [] as number[],
    paymentMethod: '' as '' | 'cash' | 'pix',
    clientCpf: '',
    notes: '',
  })
  const [saleSubmitting, setSaleSubmitting] = useState(false)
  const [saleInlineError, setSaleInlineError] = useState<string | null>(null)
  const [saleOkMsg, setSaleOkMsg] = useState<string | null>(null)

  const [accountForm, setAccountForm] = useState({
    name: '',
    phone: '',
    countryDial: '55',
    email: '',
    cpf: '',
    birthDateDigits: '',
    acceptedTerms: false,
  })
  const [accountSubmitting, setAccountSubmitting] = useState(false)
  const [accountInlineError, setAccountInlineError] = useState<string | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState<SellerCreateClientResult | null>(null)
  const [copiedCredentials, setCopiedCredentials] = useState(false)

  const [cashSuccess, setCashSuccess] = useState<{
    ticketCode: string
    amount: number
    clientName: string
  } | null>(null)

  const [pixCheckout, setPixCheckout] = useState<{
    paymentId: string
    qrImage: string
    payload: string
    expirationDate?: string
    amount: number
    clientName: string
    contestName: string
  } | null>(null)

  const [pixPaidTickets, setPixPaidTickets] = useState<string[] | null>(null)

  const contestForSale = contests.find((c) => c.id === saleForm.contestId)
  const clientForSale = clients.find((u) => u.id === saleForm.userId)

  useEffect(() => {
    if (!saleForm.userId) {
      setSaleForm((s) => ({ ...s, clientCpf: '' }))
      return
    }
    const cpf = clients.find((u) => u.id === saleForm.userId)?.cpf
    if (cpf) {
      setSaleForm((s) => ({ ...s, clientCpf: formatCpf(cpf) }))
    }
  }, [saleForm.userId, clients])
  const contestValue = Number(contestForSale?.participation_value ?? 0)
  const estimatedCommission =
    commissionPercent != null && contestForSale
      ? (contestValue * commissionPercent) / 100
      : null

  const birthDatePickerValue = useMemo(
    () => brDigitsToIso(accountForm.birthDateDigits) ?? '',
    [accountForm.birthDateDigits]
  )

  const scrollFeedbackIntoView = () => {
    const el = feedbackRef.current
    if (!el || typeof window === 'undefined') return
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' })
    })
  }

  const showProblem = (msg: string, tab: TabId) => {
    if (tab === 'sale') {
      setSaleInlineError(msg)
      setSaleOkMsg(null)
    } else {
      setAccountInlineError(msg)
    }
    onError?.(msg)
    scrollFeedbackIntoView()
  }

  const clientOptions = [
    {
      value: '',
      label: clientsLoading
        ? 'Carregando clientes…'
        : clients.length
          ? 'Escolha o cliente…'
          : 'Nenhum cliente vinculado',
    },
    ...clients.map((u) => ({
      value: u.id,
      label: `${u.name} (${u.email})`,
    })),
  ]

  const contestOptions = [
    {
      value: '',
      label: contestsLoading
        ? 'Carregando bolões…'
        : contests.length
          ? 'Escolha o bolão…'
          : 'Nenhum bolão ativo',
    },
    ...contests.map((c) => ({
      value: c.id,
      label: `${c.name} • ${c.numbers_per_participation} número(s) • ${formatCurrency(Number(c.participation_value ?? 0))}`,
    })),
  ]

  const submitSale = async () => {
    const nums = [...saleForm.selectedNumbers].sort((a, b) => a - b)
    setSaleOkMsg(null)
    setSaleInlineError(null)

    if (!saleForm.userId || !saleForm.contestId || nums.length === 0 || !saleForm.paymentMethod) {
      showProblem(
        nums.length === 0 && contestForSale
          ? `Selecione exatamente ${contestForSale.numbers_per_participation} número(s) no grid abaixo.`
          : 'Preencha cliente, bolão, números e forma de pagamento.',
        'sale'
      )
      return
    }

    const c = contests.find((x) => x.id === saleForm.contestId)
    if (!c || nums.length !== c.numbers_per_participation) {
      showProblem(
        `Quantidade inválida: este bolão exige exatamente ${c?.numbers_per_participation ?? '?'} número(s).`,
        'sale'
      )
      return
    }

    const outOfRange = nums.some((n) => n < c.min_number || n > c.max_number)
    if (outOfRange) {
      showProblem(`Números precisam estar entre ${c.min_number} e ${c.max_number}.`, 'sale')
      return
    }

    setSaleSubmitting(true)
    try {
      if (saleForm.paymentMethod === 'cash') {
        const result = await sellerCreateCashSale({
          userId: saleForm.userId,
          contestId: saleForm.contestId,
          numbers: nums,
        })
        setSaleForm({ userId: '', contestId: '', selectedNumbers: [], paymentMethod: '', clientCpf: '', notes: '' })
        setCashSuccess({
          ticketCode: result.ticketCode,
          amount: result.amount,
          clientName: clientForSale?.name || 'Cliente',
        })
        await onSaleCompleted?.()
      } else {
        const cpfDigits = normalizeCpf(saleForm.clientCpf)
        if (cpfDigits.length !== 11 || !validateCpf(saleForm.clientCpf)) {
          showProblem('Informe o CPF válido do cliente para gerar o Pix.', 'sale')
          return
        }

        const pix = await sellerCreatePixSale({
          buyerUserId: saleForm.userId,
          contestId: saleForm.contestId,
          numbers: nums,
          amount: contestValue,
          customerName: clientForSale?.name || 'Cliente',
          customerEmail: clientForSale?.email || undefined,
          customerPhone: clientForSale?.phone || undefined,
          customerCpfCnpj: cpfDigits,
        })

        setPixCheckout({
          paymentId: pix.id,
          qrImage: pix.qrCode.encodedImage,
          payload: pix.qrCode.payload,
          expirationDate: pix.qrCode.expirationDate || pix.expirationDate,
          amount: contestValue,
          clientName: clientForSale?.name || 'Cliente',
          contestName: contestForSale?.name || 'Bolão',
        })
      }
    } catch (e) {
      showProblem(e instanceof Error ? e.message : 'Erro ao registar venda', 'sale')
    } finally {
      setSaleSubmitting(false)
    }
  }

  const submitAccount = async () => {
    setAccountInlineError(null)

    if (!accountForm.name.trim()) {
      showProblem('Informe o nome completo do cliente.', 'account')
      return
    }
    if (!validatePhone(accountForm.phone, accountForm.countryDial)) {
      showProblem('Informe um telefone válido (com DDD).', 'account')
      return
    }
    if (!accountForm.email.trim()) {
      showProblem('Informe o e-mail do cliente.', 'account')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(accountForm.email.trim())) {
      showProblem('Informe um e-mail válido.', 'account')
      return
    }
    if (!accountForm.cpf.trim() || !validateCpf(accountForm.cpf)) {
      showProblem('Informe um CPF válido.', 'account')
      return
    }
    const birthIso = brDigitsToIso(accountForm.birthDateDigits) ?? ''
    if (!birthIso || !isValidAdultBirthDate(birthIso)) {
      showProblem('Data de nascimento inválida — o cliente precisa ter pelo menos 18 anos.', 'account')
      return
    }
    if (!accountForm.acceptedTerms) {
      showProblem('Confirme que o cliente tem mais de 18 anos e aceita os termos.', 'account')
      return
    }

    setAccountSubmitting(true)
    try {
      const result = await sellerCreateClient({
        name: accountForm.name.trim(),
        phone: accountForm.phone,
        countryDial: accountForm.countryDial,
        email: accountForm.email.trim(),
        cpf: accountForm.cpf,
        birthDate: birthIso,
      })

      setAccountForm({
        name: '',
        phone: '',
        countryDial: '55',
        email: '',
        cpf: '',
        birthDateDigits: '',
        acceptedTerms: false,
      })
      setCreatedCredentials(result)
      setCopiedCredentials(false)
      await onClientCreated?.()
    } catch (e) {
      showProblem(e instanceof Error ? e.message : 'Erro ao cadastrar cliente', 'account')
    } finally {
      setAccountSubmitting(false)
    }
  }

  const copyCredentials = async () => {
    if (!createdCredentials) return
    const phoneDisplay = formatLoginPhoneDisplay(createdCredentials.loginPhone)
    const text = [
      `Login DezAqui`,
      `Telefone: ${phoneDisplay}`,
      `Senha provisória: ${createdCredentials.temporaryPassword}`,
      '',
      'No primeiro acesso será obrigatório definir uma nova senha.',
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCredentials(true)
      window.setTimeout(() => setCopiedCredentials(false), 2800)
    } catch {
      showProblem('Não foi possível copiar — anote manualmente.', 'account')
    }
  }

  const saleDescription = (
    <>
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#64748B] mb-2">
        Uso restrito à área do cambista
      </span>
      <span className="text-sm text-[#4B5563] leading-relaxed">
        Bilhete com valor integral do bolão — entra na <strong className="text-[#374151]">arrecadação</strong>, no{' '}
        <strong className="text-[#374151]">ranking</strong> e nas contas financeiras.{' '}
        <strong className="text-[#374151]">Dinheiro:</strong> bilhete fica pendente até o administrador validar (como
        compra normal). <strong className="text-[#374151]">Pix:</strong> QR code na hora — activação automática. Após
        pagamento confirmado, gera <strong className="text-[#374151]">comissão</strong> conforme o percentual do seu
        perfil
        {commissionMode === 'first_purchase_only'
          ? ' (modo: só na primeira compra paga do cliente)'
          : ' (modo: em todas as compras pagas)'}
        . Só aparecem clientes <strong className="text-[#374151]">vinculados ao seu código</strong> ou com compra
        anterior pelo seu link.
      </span>
    </>
  )

  const accountDescription = (
    <>
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#64748B] mb-2">
        Cadastro vinculado ao seu código
      </span>
      <span className="text-sm text-[#4B5563] leading-relaxed">
        Crie a conta do cliente aqui para que ele já fique associado ao seu código de referência. A senha é{' '}
        <strong className="text-[#374151]">gerada automaticamente</strong> — passe ao cliente e avise que no primeiro
        login será obrigatório definir uma senha nova.
      </span>
    </>
  )

  return (
    <div className="space-y-4">
      {saleOkMsg && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 text-sm shadow-sm">
          <span className="flex-1 min-w-[12rem]">{saleOkMsg}</span>
          <button
            type="button"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-950 text-xs font-semibold hover:bg-emerald-50"
            onClick={() => setSaleOkMsg(null)}
          >
            Fechar
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 p-1 rounded-xl bg-[#F3F4F6] border border-[#E5E7EB] w-full sm:w-auto">
        {(['sale', 'account'] as TabId[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab)
              setSaleInlineError(null)
              setAccountInlineError(null)
            }}
            className={`flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-bold transition-colors touch-manipulation ${
              activeTab === tab
                ? 'bg-white text-[#1E7F43] shadow-sm ring-1 ring-[#1E7F43]/20'
                : 'text-[#6B7280] hover:text-[#374151]'
            }`}
            aria-selected={activeTab === tab}
            role="tab"
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'sale' ? (
        <SectionShell title="Nova venda para cliente" description={saleDescription}>
          <div className="px-4 sm:px-6 md:px-8 pb-6 md:pb-8 pt-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                  Cliente
                </label>
                <CustomSelect
                  value={saleForm.userId}
                  options={clientOptions}
                  onChange={(v: string) => setSaleForm((s) => ({ ...s, userId: v }))}
                  disabled={clientsLoading}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                  Bolão ativo
                </label>
                <CustomSelect
                  value={saleForm.contestId}
                  options={contestOptions}
                  onChange={(v: string) =>
                    setSaleForm((s) => ({ ...s, contestId: v, selectedNumbers: [] }))
                  }
                  disabled={contestsLoading}
                />
                {!!contestForSale && (
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Valor do bilhete: <strong>{formatCurrency(contestValue)}</strong>
                    {estimatedCommission != null && (
                      <>
                        {' '}
                        · Comissão estimada ({Number(commissionPercent).toLocaleString('pt-BR')}%):{' '}
                        <strong>{formatCurrency(estimatedCommission)}</strong>
                      </>
                    )}
                    {' · '}
                    Regra: <strong>{contestForSale.numbers_per_participation}</strong> números, intervalo{' '}
                    {contestForSale.min_number}–{contestForSale.max_number}.
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-2">
                  Números{' '}
                  {contestForSale
                    ? `(${contestForSale.numbers_per_participation} valores · toque nos botões)`
                    : '(escolha o bolão primeiro)'}
                </label>
                {contestForSale ? (
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFB] p-4">
                    <NumberPicker
                      min={contestForSale.min_number}
                      max={contestForSale.max_number}
                      maxSelected={contestForSale.numbers_per_participation}
                      selectedNumbers={saleForm.selectedNumbers}
                      onChange={(numbers) => setSaleForm((s) => ({ ...s, selectedNumbers: numbers }))}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-[#6B7280]">Selecione um bolão ativo para abrir o painel numérico.</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                  Forma de pagamento
                </label>
                <CustomSelect
                  value={saleForm.paymentMethod}
                  options={[
                    { value: '', label: 'Escolha como o cliente pagará…' },
                    { value: 'cash', label: 'Dinheiro (registo manual)' },
                    { value: 'pix', label: 'Pix (QR code para o cliente)' },
                  ]}
                  onChange={(v: string) =>
                    setSaleForm((s) => ({ ...s, paymentMethod: v as '' | 'cash' | 'pix' }))
                  }
                />
              </div>

              {saleForm.paymentMethod === 'pix' && (
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                    CPF do cliente (obrigatório para Pix)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full min-h-[48px] border border-[#E5E7EB] rounded-xl px-3 py-3 sm:py-2.5 text-[16px] md:text-[15px] text-[#111827] focus:ring-2 focus:ring-[#1E7F43]/25 focus:border-[#1E7F43]"
                    value={saleForm.clientCpf}
                    onChange={(e) =>
                      setSaleForm((s) => ({ ...s, clientCpf: formatCpf(e.target.value) }))
                    }
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Preenchido automaticamente se o cliente já tiver CPF no cadastro.
                  </p>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                  Observações (opcional)
                </label>
                <input
                  type="text"
                  className="w-full min-h-[48px] border border-[#E5E7EB] rounded-xl px-3 py-3 sm:py-2.5 text-[16px] md:text-[15px] text-[#111827] focus:ring-2 focus:ring-[#1E7F43]/25 focus:border-[#1E7F43]"
                  value={saleForm.notes}
                  onChange={(e) => setSaleForm((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Ex.: Pagamento recebido em espécie, cliente presencial, etc."
                />
              </div>
            </div>

            <div ref={feedbackRef} className="mt-6 space-y-3 scroll-mt-28 sm:scroll-mt-24" aria-live="polite">
              <button
                type="button"
                onClick={() => void submitSale()}
                disabled={saleSubmitting || clientsLoading || contestsLoading}
                className="w-full sm:w-auto min-h-[48px] px-6 py-3 sm:py-2.5 rounded-xl bg-[#1E7F43] text-white text-[15px] sm:text-sm font-bold shadow-sm hover:bg-[#196c3a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation active:brightness-95"
              >
                {saleSubmitting
                ? 'A processar…'
                : saleForm.paymentMethod === 'pix'
                  ? 'Gerar Pix para o cliente'
                  : saleForm.paymentMethod === 'cash'
                    ? 'Registrar venda em dinheiro'
                    : 'Criar bilhete e registrar venda'}
              </button>
              {saleInlineError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-3 sm:py-2 break-words leading-relaxed">
                  {saleInlineError}
                </p>
              )}
            </div>
          </div>
        </SectionShell>
      ) : (
        <SectionShell title="Cadastrar novo cliente" description={accountDescription}>
          <div className="px-4 sm:px-6 md:px-8 pb-6 md:pb-8 pt-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                  Nome completo
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  className="w-full min-h-[48px] border border-[#E5E7EB] rounded-xl px-3 py-3 sm:py-2.5 text-[16px] md:text-[15px] text-[#111827] focus:ring-2 focus:ring-[#1E7F43]/25 focus:border-[#1E7F43]"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Nome do cliente"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                  Telefone (login)
                </label>
                <MobilePhoneCountryInput
                  phone={accountForm.phone}
                  countryDial={accountForm.countryDial}
                  onPhoneChange={(v) => setAccountForm((s) => ({ ...s, phone: v }))}
                  onCountryDialChange={(d) => setAccountForm((s) => ({ ...s, countryDial: d, phone: '' }))}
                  formatBrazil={formatBrazilPhoneDisplay}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className="w-full min-h-[48px] border border-[#E5E7EB] rounded-xl px-3 py-3 sm:py-2.5 text-[16px] md:text-[15px] text-[#111827] focus:ring-2 focus:ring-[#1E7F43]/25 focus:border-[#1E7F43]"
                  value={accountForm.email}
                  onChange={(e) => setAccountForm((s) => ({ ...s, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                  CPF
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full min-h-[48px] border border-[#E5E7EB] rounded-xl px-3 py-3 sm:py-2.5 text-[16px] md:text-[15px] text-[#111827] focus:ring-2 focus:ring-[#1E7F43]/25 focus:border-[#1E7F43]"
                  value={accountForm.cpf}
                  onChange={(e) => setAccountForm((s) => ({ ...s, cpf: formatCpf(e.target.value) }))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                  Data de nascimento
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="dd/mm/aaaa"
                    className="w-full min-h-[48px] border border-[#E5E7EB] rounded-xl px-3 py-3 sm:py-2.5 text-[16px] md:text-[15px] text-[#111827] focus:ring-2 focus:ring-[#1E7F43]/25 focus:border-[#1E7F43]"
                    value={formatBirthDateMask(accountForm.birthDateDigits)}
                    onChange={(e) =>
                      setAccountForm((s) => ({
                        ...s,
                        birthDateDigits: e.target.value.replace(/\D/g, '').slice(0, 8),
                      }))
                    }
                  />
                  <input
                    type="date"
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer md:hidden"
                    min={BIRTH_DATE_MIN}
                    max={getMaxBirthDateForAdultsIso()}
                    value={birthDatePickerValue}
                    onChange={(e) =>
                      setAccountForm((s) => ({
                        ...s,
                        birthDateDigits: isoDateToBrDigits(e.target.value),
                      }))
                    }
                    aria-hidden
                    tabIndex={-1}
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFB] px-3 py-3 sm:px-4">
                <input
                  id="seller-account-terms"
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[#1E7F43]"
                  checked={accountForm.acceptedTerms}
                  onChange={(e) => setAccountForm((s) => ({ ...s, acceptedTerms: e.target.checked }))}
                />
                <label htmlFor="seller-account-terms" className="text-sm text-[#374151] leading-snug">
                  Confirmo que o cliente tem mais de 18 anos e aceita os termos de uso e a política de privacidade da
                  plataforma.
                </label>
              </div>
            </div>

            <div ref={feedbackRef} className="mt-6 space-y-3 scroll-mt-28 sm:scroll-mt-24" aria-live="polite">
              <button
                type="button"
                onClick={() => void submitAccount()}
                disabled={accountSubmitting}
                className="w-full sm:w-auto min-h-[48px] px-6 py-3 sm:py-2.5 rounded-xl bg-[#1E7F43] text-white text-[15px] sm:text-sm font-bold shadow-sm hover:bg-[#196c3a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation active:brightness-95"
              >
                {accountSubmitting ? 'A cadastrar…' : 'Cadastrar cliente'}
              </button>
              {accountInlineError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-3 sm:py-2 break-words leading-relaxed">
                  {accountInlineError}
                </p>
              )}
            </div>
          </div>
        </SectionShell>
      )}

      {cashSuccess && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-[#1F1F1F]/60 backdrop-blur-sm px-4 py-8">
          <div className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-[#EEF1F6] bg-gradient-to-br from-[#F0FDF4] to-white">
              <h3 className="text-xl font-bold text-[#1F1F1F]">Venda registada</h3>
              <p className="mt-2 text-sm text-[#4B5563]">
                Bilhete <strong>{cashSuccess.ticketCode}</strong> criado para{' '}
                <strong>{cashSuccess.clientName}</strong> ({formatCurrency(cashSuccess.amount)}). Aguarda validação do
                administrador — após confirmar o pagamento em dinheiro, a sua comissão será gerada.
              </p>
            </div>
            <div className="px-6 py-5">
              <button
                type="button"
                onClick={() => setCashSuccess(null)}
                className="w-full min-h-[44px] rounded-xl bg-[#1E7F43] text-white font-bold hover:bg-[#196c3a]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {pixCheckout && !pixPaidTickets && (
        <SellerPixCheckoutModal
          paymentId={pixCheckout.paymentId}
          qrImage={pixCheckout.qrImage}
          payload={pixCheckout.payload}
          expirationDate={pixCheckout.expirationDate}
          amount={pixCheckout.amount}
          clientName={pixCheckout.clientName}
          contestName={pixCheckout.contestName}
          onPaid={(ticketCodes) => {
            setPixPaidTickets(ticketCodes)
            setPixCheckout(null)
            setSaleForm({ userId: '', contestId: '', selectedNumbers: [], paymentMethod: '', clientCpf: '', notes: '' })
            void onSaleCompleted?.()
          }}
          onCancel={async () => {
            if (pixCheckout?.paymentId) {
              await sellerCancelPendingPixPayment(pixCheckout.paymentId)
            }
            setPixCheckout(null)
          }}
        />
      )}

      {pixPaidTickets && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-[#1F1F1F]/60 backdrop-blur-sm px-4 py-8">
          <div className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-[#EEF1F6] bg-gradient-to-br from-[#F0FDF4] to-white">
              <h3 className="text-xl font-bold text-[#1F1F1F]">Pix confirmado</h3>
              <p className="mt-2 text-sm text-[#4B5563]">
                Bilhete activo: <strong>{pixPaidTickets.join(', ')}</strong>. Comissão registada conforme o seu
                percentual.
              </p>
            </div>
            <div className="px-6 py-5">
              <button
                type="button"
                onClick={() => setPixPaidTickets(null)}
                className="w-full min-h-[44px] rounded-xl bg-[#1E7F43] text-white font-bold hover:bg-[#196c3a]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {createdCredentials && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-[#1F1F1F]/60 backdrop-blur-sm px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="seller-client-credentials-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-[#EEF1F6] bg-gradient-to-br from-[#F0FDF4] to-white">
              <h3 id="seller-client-credentials-title" className="text-xl font-bold text-[#1F1F1F]">
                Cliente cadastrado
              </h3>
              <p className="mt-2 text-sm text-[#4B5563]">
                Passe estas credenciais ao cliente. No primeiro login, ele será obrigado a{' '}
                <strong>redefinir a senha</strong> antes de usar a plataforma.
              </p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">Cliente</span>
                <p className="mt-1 font-semibold text-[#1F1F1F]">{createdCredentials.name}</p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">Telefone (login)</span>
                <p className="mt-1 font-mono text-lg font-bold text-[#1E7F43]">
                  {formatLoginPhoneDisplay(createdCredentials.loginPhone)}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">Senha provisória</span>
                <p className="mt-1 font-mono text-lg font-bold text-[#1F1F1F] tracking-wide">
                  {createdCredentials.temporaryPassword}
                </p>
              </div>
              {!createdCredentials.sellerBound && (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Conta criada, mas o vínculo ao seu código pode demorar — recarregue a lista de clientes em instantes.
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void copyCredentials()}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1E7F43] text-white text-sm font-bold hover:bg-[#196c3a]"
                >
                  Copiar credenciais
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedCredentials(null)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                >
                  Fechar
                </button>
                {copiedCredentials && (
                  <span className="text-sm font-semibold text-[#1E7F43] self-center">Copiado!</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
