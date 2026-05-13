/**
 * MODIFIQUEI AQUI — URL pública do bolão com (?ref=) para WhatsApp/Telegram.
 */
export function buildConcursosShareUrl(contestId: string, referralCode?: string | null): string {
  if (typeof window === 'undefined') {
    const q =
      referralCode && String(referralCode).trim().length > 0
        ? `?ref=${encodeURIComponent(String(referralCode).trim())}`
        : ''
    return `/concursos/${encodeURIComponent(contestId)}${q}`
  }
  const origin = window.location.origin
  const base = `${origin}/concursos/${encodeURIComponent(contestId)}`
  const ref = referralCode?.trim()
  return ref ? `${base}?ref=${encodeURIComponent(ref)}` : base
}

export function shareWhatsAppUrl(text: string, url: string): string {
  const enc = encodeURIComponent(`${text.trim()}\n\n${url}`)
  return `https://wa.me/?text=${enc}`
}

export function shareTelegramUrl(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text.trim())}`
}
