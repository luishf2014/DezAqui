/**
 * MODIFIQUEI AQUI: Armazena temporariamente o código ?ref= para vincular na compra/participação.
 * Grava sessionStorage + localStorage (preserva através de navegações e reabrir o separador até limpar).
 */
const PENDING_REF_SESSION = 'dezaqui_pending_referral_code_v1'
const PENDING_REF_LOCAL = 'dezaqui_pending_referral_code_v1_ls'

export function setPendingReferralCodeFromQuery(refParam: string | null | undefined): void {
  const v = (refParam || '').trim()
  if (!v || v.length > 64) return
  try {
    sessionStorage.setItem(PENDING_REF_SESSION, v)
    localStorage.setItem(PENDING_REF_LOCAL, v)
  } catch {
    // ignore
  }
}

export function peekPendingReferralCode(): string | null {
  try {
    const s = sessionStorage.getItem(PENDING_REF_SESSION)
    if (s && s.trim()) return s.trim()
    const ls = localStorage.getItem(PENDING_REF_LOCAL)
    return ls && ls.trim() ? ls.trim() : null
  } catch {
    return null
  }
}

export function clearPendingReferralCode(): void {
  try {
    sessionStorage.removeItem(PENDING_REF_SESSION)
    localStorage.removeItem(PENDING_REF_LOCAL)
  } catch {
    // ignore
  }
}
