/** Data mínima aceita para data de nascimento (evita lixo). */
export const BIRTH_DATE_MIN = '1900-01-01'

/** Última data em que a pessoa completa 18 anos hoje (YYYY-MM-DD). */
export function getMaxBirthDateForAdultsIso(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().slice(0, 10)
}

/** Cadastro / perfil: data válida e idade mínima 18 anos. */
export function isValidAdultBirthDate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false
  if (isoDate < BIRTH_DATE_MIN || isoDate > getMaxBirthDateForAdultsIso()) return false
  return true
}

/** Formata até 8 dígitos (DDMMAAAA) como dd/mm/aaaa para exibição (desktop). */
export function formatBirthDateMask(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/** Converte 8 dígitos (DDMMAAAA) em YYYY-MM-DD ou null se inválido. */
export function brDigitsToIso(digits: string): string | null {
  const d = digits.replace(/\D/g, '')
  if (d.length !== 8) return null
  const dd = parseInt(d.slice(0, 2), 10)
  const mm = parseInt(d.slice(2, 4), 10)
  const yyyy = parseInt(d.slice(4, 8), 10)
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  const iso = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  const dt = new Date(`${iso}T12:00:00`)
  if (dt.getFullYear() !== yyyy || dt.getMonth() + 1 !== mm || dt.getDate() !== dd) return null
  return iso
}

/** Converte YYYY-MM-DD em 8 dígitos DDMMAAAA (para sincronizar com máscara). */
export function isoDateToBrDigits(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}${m}${y}`
}
