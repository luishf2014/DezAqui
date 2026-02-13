/**
 * MODIFIQUEI AQUI - Utilitários para exibição de referências de concurso oficial
 */

export function formatOfficialRefDate(s: string | null | undefined): string {
  if (!s?.trim()) return ''
  // ISO (yyyy-mm-dd) ou qualquer formato que Date entenda → pt-BR
  if (s.includes('-') || s.includes('/') || s.includes('T')) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
  }
  // ddmmaaaa (8 dígitos consecutivos, ex: 13022026)
  const digits = s.replace(/\D/g, '')
  if (digits.length === 8) {
    const dd = digits.slice(0, 2)
    const mm = digits.slice(2, 4)
    const aaaa = digits.slice(4, 8)
    return `${dd}/${mm}/${aaaa}`
  }
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return s
}

export function formatOfficialRefNumbers(s: string | null | undefined): string {
  if (!s?.trim()) return ''
  const digits = s.replace(/\D/g, '')
  if (digits.length === 0) return ''
  return digits.match(/.{1,2}/g)?.map(n => n.padStart(2, '0')).join(' ') ?? s
}
