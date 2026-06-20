import { useEffect, useRef, useState } from 'react'
import { checkPixPaymentStatus } from '../services/paymentsService'
import { formatCurrency } from '../utils/formatters'

type SellerPixCheckoutModalProps = {
  paymentId: string
  qrImage: string
  payload: string
  expirationDate?: string
  amount: number
  clientName: string
  contestName: string
  onPaid: (ticketCodes: string[]) => void
  onCancel: () => void | Promise<void>
}

export default function SellerPixCheckoutModal({
  paymentId,
  qrImage,
  payload,
  expirationDate,
  amount,
  clientName,
  contestName,
  onPaid,
  onCancel,
}: SellerPixCheckoutModalProps) {
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const paidRef = useRef(false)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!paymentId) return

    const poll = async () => {
      if (paidRef.current || cancelledRef.current) return
      setChecking(true)
      try {
        const result = await checkPixPaymentStatus(paymentId)
        if (result.paid && result.ticketCodes.length > 0) {
          paidRef.current = true
          onPaid(result.ticketCodes)
        }
      } catch {
        setError('Erro ao verificar pagamento')
      } finally {
        setChecking(false)
      }
    }

    const interval = setInterval(() => void poll(), 3000)
    void poll()

    return () => clearInterval(interval)
  }, [paymentId, onPaid])

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('Não foi possível copiar o código Pix')
    }
  }

  const handleCancel = async () => {
    if (paidRef.current || cancelling) return
    cancelledRef.current = true
    setCancelling(true)
    setError(null)
    try {
      await onCancel()
    } catch (e) {
      cancelledRef.current = false
      setError(e instanceof Error ? e.message : 'Erro ao cancelar')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9997] flex items-center justify-center bg-[#1F1F1F]/65 backdrop-blur-sm px-4 py-8"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-[#EEF1F6] bg-gradient-to-br from-[#F0FDF4] to-white">
          <h3 className="text-xl font-bold text-[#1F1F1F]">Pagamento Pix</h3>
          <p className="mt-2 text-sm text-[#4B5563]">
            Peça ao cliente <strong>{clientName}</strong> para pagar o bilhete de{' '}
            <strong>{contestName}</strong>. A activação é automática após confirmação.
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#6B7280]">Valor</span>
            <span className="text-lg font-bold text-[#1E7F43]">{formatCurrency(amount)}</span>
          </div>

          {expirationDate && (
            <p className="text-xs text-[#6B7280]">
              Expira em: {new Date(expirationDate).toLocaleString('pt-BR')}
            </p>
          )}

          <div className="flex justify-center">
            <img
              src={`data:image/png;base64,${qrImage}`}
              alt="QR Code Pix"
              className="w-52 h-52 rounded-xl border border-[#E5E7EB] bg-white p-2"
            />
          </div>

          <button
            type="button"
            onClick={() => void copyPayload()}
            className="w-full min-h-[44px] rounded-xl border border-[#1E7F43] text-[#1E7F43] font-bold hover:bg-[#F0FDF4]"
          >
            {copied ? 'Código copiado!' : 'Copiar código Pix'}
          </button>

          <p className="text-xs text-center text-[#6B7280]">
            {checking ? 'A verificar pagamento…' : 'Aguardando confirmação do Pix…'}
          </p>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={cancelling}
            className="w-full min-h-[44px] rounded-xl border border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {cancelling ? 'A cancelar…' : 'Cancelar pagamento'}
          </button>
          <p className="text-[11px] text-center text-[#6B7280]">
            Igual ao checkout normal: sem pagamento confirmado, nenhum bilhete é criado.
          </p>
        </div>
      </div>
    </div>
  )
}
