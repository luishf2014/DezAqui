export async function captureReceiptAsBlob(element: HTMLElement): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default
  const target = element.querySelector<HTMLElement>('.sale-receipt-ticket') ?? element

  const canvas = await html2canvas(target, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    windowWidth: target.scrollWidth,
    windowHeight: target.scrollHeight,
  })

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', 0.92)
  })

  if (!blob) {
    throw new Error('Não foi possível gerar a imagem do comprovante.')
  }

  return blob
}

export function downloadReceiptBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function receiptFilename(ticketCode: string): string {
  const safe = ticketCode.replace(/[^a-zA-Z0-9-]/g, '') || 'bilhete'
  return `comprovante-${safe}.png`
}

export type ShareReceiptResult = 'shared' | 'downloaded'

/** Partilha a imagem (WhatsApp, etc.) ou faz download se o browser não suportar ficheiros. */
export async function shareReceiptImage(blob: Blob, ticketCode: string): Promise<ShareReceiptResult> {
  const filename = receiptFilename(ticketCode)
  const file = new File([blob], filename, { type: 'image/png' })

  if (typeof navigator.share === 'function') {
    try {
      const canShareFiles =
        typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })

      if (canShareFiles) {
        await navigator.share({
          title: `Comprovante DezAqui — ${ticketCode}`,
          text: `Comprovante da aposta ${ticketCode}`,
          files: [file],
        })
        return 'shared'
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err
      }
    }
  }

  downloadReceiptBlob(blob, filename)
  return 'downloaded'
}
