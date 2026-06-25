import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import SaleReceiptCard, { buildReceiptShareText, type SaleReceiptData } from './SaleReceiptCard'
import { captureReceiptAsBlob, shareReceiptImage } from '../utils/receiptImage'

type SaleReceiptModalProps = {
  data: SaleReceiptData
  onClose: () => void
}

type ShareFeedback = { kind: 'shared' | 'downloaded' | 'text' } | null

const PRINT_STYLE_ID = 'sale-receipt-print-styles'

function ensurePrintStyles() {
  if (typeof document === 'undefined') return
  let style = document.getElementById(PRINT_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = PRINT_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = `
    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm;
      }

      html, body {
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #fff !important;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body > *:not(.sale-receipt-print-layer) {
        display: none !important;
      }

      .sale-receipt-print-layer {
        position: static !important;
        inset: auto !important;
        display: flex !important;
        align-items: flex-start !important;
        justify-content: center !important;
        width: 100% !important;
        max-width: none !important;
        max-height: none !important;
        overflow: visible !important;
        background: #fff !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
      }

      .sale-receipt-print-layer > div {
        width: 100% !important;
        max-width: none !important;
        max-height: none !important;
        overflow: visible !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      .sale-receipt-no-print {
        display: none !important;
      }

      #sale-receipt-print-root {
        width: 100mm;
        max-width: calc(100% - 4mm);
        margin: 0 auto;
        page-break-inside: avoid;
        break-inside: avoid;
        box-shadow: none !important;
      }

      .sale-receipt-ticket img {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `
}

export default function SaleReceiptModal({ data, onClose }: SaleReceiptModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback>(null)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    ensurePrintStyles()
    document.body.classList.add('sale-receipt-print-open')
    return () => {
      document.body.classList.remove('sale-receipt-print-open')
    }
  }, [])

  useEffect(() => {
    if (!shareFeedback) return
    const t = window.setTimeout(() => setShareFeedback(null), 2800)
    return () => window.clearTimeout(t)
  }, [shareFeedback])

  const handleShare = async () => {
    const root = cardRef.current
    if (!root || sharing) return

    setSharing(true)
    setShareFeedback(null)

    try {
      const blob = await captureReceiptAsBlob(root)
      try {
        const result = await shareReceiptImage(blob, data.ticketCode)
        setShareFeedback({ kind: result })
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        throw err
      }
    } catch {
      try {
        await navigator.clipboard.writeText(buildReceiptShareText(data))
        setShareFeedback({ kind: 'text' })
      } catch {
        /* ignore */
      }
    } finally {
      setSharing(false)
    }
  }

  const handleSave = () => {
    window.print()
  }

  const modal = (
    <div
      className="sale-receipt-print-layer fixed inset-0 z-[9999] flex items-center justify-center bg-[#1F1F1F]/65 backdrop-blur-sm px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sale-receipt-title"
    >
      <div className="w-full max-w-lg max-h-[95vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="sale-receipt-no-print flex flex-wrap gap-2 mb-4 justify-center">
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={sharing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-bold shadow-sm hover:bg-[#1d4ed8] disabled:opacity-60 disabled:cursor-wait"
          >
            {sharing ? 'A gerar imagem…' : 'Compartilhar imagem'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EA580C] text-white text-sm font-bold shadow-sm hover:bg-[#c2410c]"
          >
            Salvar / Imprimir
          </button>
          {shareFeedback?.kind === 'shared' && (
            <span className="self-center text-sm font-semibold text-[#1E7F43]">Imagem partilhada!</span>
          )}
          {shareFeedback?.kind === 'downloaded' && (
            <span className="self-center text-sm font-semibold text-[#1E7F43]">Imagem transferida!</span>
          )}
          {shareFeedback?.kind === 'text' && (
            <span className="self-center text-sm font-semibold text-[#B45309]">Texto copiado (fallback)</span>
          )}
        </div>

        <div id="sale-receipt-print-root" ref={cardRef}>
          <SaleReceiptCard data={data} />
        </div>

        <div className="sale-receipt-no-print mt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white text-[#374151] font-bold hover:bg-[#F9FAFB]"
          >
            Fechar comprovante
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
