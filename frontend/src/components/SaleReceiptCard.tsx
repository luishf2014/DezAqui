import { forwardRef } from 'react'
import { formatCurrency } from '../utils/formatters'
import logodezaqui from '../assets/logodezaqui.png'

export type SaleReceiptData = {
  ticketCode: string
  clientName: string
  amount: number
  numbers: number[]
  contestName: string
  contestCode?: string | null
  contestStartDate?: string | null
  paymentMethod: 'cash' | 'pix'
  /** Ex.: «Pago» ou «Pendente (dinheiro)» */
  paymentStatusLabel: string
  sellerName: string
  soldAt: Date
  receiptCode: string
}

function formatDateTimePt(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatContestStart(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function buildReceiptCode(soldAt: Date, ticketCode: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const base = `${pad(soldAt.getDate())}${pad(soldAt.getMonth() + 1)}${String(soldAt.getFullYear()).slice(-2)}${pad(soldAt.getHours())}${pad(soldAt.getMinutes())}${pad(soldAt.getSeconds())}`
  const suffix = ticketCode.replace(/^TK-/i, '').slice(0, 4)
  return `${base}${suffix}`.toUpperCase()
}

export function buildSaleReceipt(params: {
  ticketCode: string
  numbers: number[]
  contestName: string
  contestCode?: string | null
  contestStartDate?: string | null
  clientName: string
  amount: number
  paymentMethod: 'cash' | 'pix'
  paymentStatusLabel: string
  sellerName: string
  soldAt?: Date
}): SaleReceiptData {
  const soldAt = params.soldAt ?? new Date()
  return {
    ticketCode: params.ticketCode,
    clientName: params.clientName,
    amount: params.amount,
    numbers: params.numbers,
    contestName: params.contestName,
    contestCode: params.contestCode,
    contestStartDate: params.contestStartDate,
    paymentMethod: params.paymentMethod,
    paymentStatusLabel: params.paymentStatusLabel,
    sellerName: params.sellerName,
    soldAt,
    receiptCode: buildReceiptCode(soldAt, params.ticketCode),
  }
}

export function buildReceiptShareText(data: SaleReceiptData): string {
  const nums = [...data.numbers].sort((a, b) => a - b).map((n) => String(n).padStart(2, '0')).join(' ')
  return [
    'Comprovante DezAqui',
    `Bolão: ${data.contestName}`,
    `Bilhete: ${data.ticketCode}`,
    `Apostador: ${data.clientName}`,
    `Vendedor: ${data.sellerName}`,
    `Data/Hora: ${formatDateTimePt(data.soldAt)}`,
    `Valor: ${formatCurrency(data.amount)}`,
    `Pagamento: ${data.paymentMethod === 'pix' ? 'Pix' : 'Dinheiro'} — ${data.paymentStatusLabel}`,
    `Números: ${nums}`,
    `Código: ${data.receiptCode}`,
    '',
    'Boa sorte!',
  ].join('\n')
}

type SaleReceiptCardProps = {
  data: SaleReceiptData
  className?: string
}

const SaleReceiptCard = forwardRef<HTMLDivElement, SaleReceiptCardProps>(function SaleReceiptCard(
  { data, className = '' },
  ref
) {
  const sortedNumbers = [...data.numbers].sort((a, b) => a - b)
  const bolaoLabel = data.contestCode?.trim() || data.contestName
  const isPaid =
    data.paymentMethod === 'pix' && data.paymentStatusLabel.toLowerCase().includes('pago')
  const paymentLabel = data.paymentMethod === 'pix' ? 'Pix' : 'Dinheiro'

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Bilhete Nº', value: data.ticketCode, mono: true },
    { label: 'Apostador', value: data.clientName },
    { label: 'Vendedor', value: data.sellerName },
    { label: 'Data/Hora venda', value: formatDateTimePt(data.soldAt) },
    { label: 'Valor por aposta', value: formatCurrency(data.amount) },
    { label: 'Código', value: data.receiptCode, mono: true },
    { label: 'Pagamento', value: `${paymentLabel} — ${data.paymentStatusLabel}` },
  ]

  return (
    <div
      ref={ref}
      className={`sale-receipt-ticket w-full max-w-[420px] mx-auto bg-white overflow-hidden rounded-2xl border-2 border-[#0d9488]/25 shadow-[0_8px_32px_rgba(15,118,110,0.12)] print:shadow-none print:rounded-xl print:border print:border-[#0d9488]/30 print:max-w-none ${className}`}
    >
      {/* Marcas de corte (só impressão) */}
      <div className="hidden print:flex justify-between px-2 pt-1 text-[8px] text-[#9CA3AF] select-none">
        <span>✂</span>
        <span>— — — comprovante — — —</span>
        <span>✂</span>
      </div>

      {/* Cabeçalho */}
      <div className="relative bg-gradient-to-br from-[#0f766e] via-[#0d9488] to-[#14b8a6] px-5 py-4 print:px-4 print:py-3 text-white">
        <div className="flex items-center gap-3 mb-3 print:mb-2">
          <img
            src={logodezaqui}
            alt=""
            className="h-11 w-11 print:h-9 print:w-9 rounded-xl bg-white/95 p-1 object-contain shrink-0"
          />
          <div className="min-w-0 text-left">
            <p className="text-[10px] print:text-[9px] font-bold uppercase tracking-[0.2em] opacity-90">
              Comprovante oficial
            </p>
            <p className="text-lg print:text-base font-extrabold tracking-tight leading-none">DezAqui</p>
          </div>
        </div>

        <div className="rounded-xl bg-white/15 backdrop-blur-sm px-3 py-2.5 print:py-2 text-center border border-white/20">
          <p className="text-[10px] print:text-[9px] font-bold uppercase tracking-wider opacity-90">Bolão</p>
          <h2 className="text-base print:text-sm font-extrabold leading-snug break-words">{bolaoLabel}</h2>
          <p className="text-[11px] print:text-[10px] mt-1 opacity-95">
            Início: {formatContestStart(data.contestStartDate)}
          </p>
        </div>
      </div>

      {/* Corpo — tabela de dados */}
      <div className="px-4 py-3 print:px-3 print:py-2">
        <div className="rounded-xl border border-[#E5E7EB] overflow-hidden divide-y divide-dashed divide-[#E5E7EB]">
          {rows.map((row) => (
            <ReceiptRow key={row.label} label={row.label} value={row.value} mono={row.mono} />
          ))}
        </div>

        {!isPaid && data.paymentMethod === 'cash' && (
          <p className="mt-2 print:mt-1.5 text-center text-[10px] print:text-[9px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 print:py-1">
            Pagamento em dinheiro pendente de validação
          </p>
        )}
      </div>

      {/* Números */}
      <div className="mx-4 mb-3 print:mx-3 print:mb-2 rounded-xl bg-gradient-to-b from-[#F8FAFC] to-[#F1F5F9] border border-[#E2E8F0] p-3 print:p-2">
        <p className="text-[10px] print:text-[9px] font-extrabold uppercase tracking-widest text-[#64748B] mb-2.5 print:mb-1.5 text-center">
          Números seleccionados
        </p>
        <div
          className="grid gap-1.5 print:gap-1 mx-auto"
          style={{ gridTemplateColumns: `repeat(${Math.min(5, Math.max(3, sortedNumbers.length))}, minmax(0, 1fr))` }}
        >
          {sortedNumbers.map((n) => (
            <span
              key={n}
              className="flex h-9 print:h-7 items-center justify-center rounded-lg bg-white border-2 border-[#0d9488]/20 text-sm print:text-xs font-extrabold text-[#0f766e] shadow-sm print:shadow-none tabular-nums"
            >
              {String(n).padStart(2, '0')}
            </span>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="mx-4 mb-3 print:mx-3 print:mb-2 rounded-xl bg-gradient-to-r from-[#0f766e] to-[#14b8a6] px-4 py-3 print:py-2.5 text-center shadow-inner">
        <p className="text-[10px] print:text-[9px] font-bold uppercase tracking-wider text-white/80">
          {isPaid ? 'Total pago' : 'Total da aposta'}
        </p>
        <p className="text-xl print:text-lg font-extrabold text-white tabular-nums tracking-tight">
          {formatCurrency(data.amount)}
        </p>
      </div>

      {/* Rodapé */}
      <div className="px-4 pb-4 print:px-3 print:pb-3 text-center space-y-1">
        <p className="text-sm print:text-xs font-bold text-[#0f766e]">🍀 Boa sorte! 🍀</p>
        <p className="text-[9px] print:text-[8px] text-[#9CA3AF] leading-snug">
          Guarde este comprovante. O bilhete oficial é o código acima.
        </p>
      </div>
    </div>
  )
})

function ReceiptRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[38%_1fr] print:grid-cols-[42%_1fr] gap-x-3 gap-y-0.5 items-baseline px-3 py-2 print:px-2.5 print:py-1.5 bg-white">
      <span className="text-[10px] print:text-[9px] font-bold uppercase tracking-wide text-[#64748B] leading-tight">
        {label}
      </span>
      <span
        className={`text-right text-[13px] print:text-[11px] font-semibold text-[#0F172A] break-all leading-snug ${mono ? 'font-mono text-[#0f766e]' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

export default SaleReceiptCard
