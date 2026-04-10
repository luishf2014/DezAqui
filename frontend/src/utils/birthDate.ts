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
