/**
 * MODIFIQUEI AQUI: valores para input datetime-local vs timestamptz (Supabase ISO UTC)
 */
/** Converte ISO/timestamp recebido do backend para valor de `<input type="datetime-local">` no fuso do browser */
export function toDateTimeLocalInputValue(isoOrTimestamp: string | Date): string {
  const d = typeof isoOrTimestamp === 'string' ? new Date(isoOrTimestamp) : isoOrTimestamp
  if (!d || Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Interpreta valor de datetime-local como instante **local do browser** e devolve ISO em UTC para timestamptz */
export function dateTimeLocalInputToIsoUtc(datetimeLocalValue: string): string {
  const trimmed = datetimeLocalValue?.trim()
  if (!trimmed) throw new Error('Data/hora inválida.')
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) throw new Error('Data/hora inválida.')
  return d.toISOString()
}

/** Exibir início/fim de bolão (data + hora) sempre no mesmo fuso visual do formulário público */
export function formatContestDateTimeDisplay(isoOrTimestamp: string | Date): string {
  const d = typeof isoOrTimestamp === 'string' ? new Date(isoOrTimestamp) : isoOrTimestamp
  if (!d || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Utilitários de Formatação
 * 
 * Funções para formatação de dados para exibição
 */

/**
 * Formatar telefone brasileiro no padrão (99)99999-9999
 * Remove todos os caracteres não numéricos e aplica máscara
 */
export function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone) return ''
  
  // Remove tudo que não for número
  const cleaned = phone.replace(/\D/g, '')
  
  // Se não tiver números suficientes, retorna o valor original
  if (cleaned.length < 10) return phone
  
  // Aplica máscara baseada no tamanho
  if (cleaned.length === 10) {
    // Telefone fixo: (99) 9999-9999
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
  } else if (cleaned.length === 11) {
    // Celular: (99) 99999-9999
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
  }
  
  // Para outros tamanhos, retorna original
  return phone
}

/**
 * Formatar CPF no padrão 999.999.999-99
 */
export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return ''
  
  const cleaned = cpf.replace(/\D/g, '')
  
  if (cleaned.length !== 11) return cpf
  
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`
}

/**
 * Formatar valor monetário brasileiro
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

/**
 * Formatar data no padrão brasileiro
 */
export function formatDate(dateString: string, includeTime: boolean = false): string {
  const date = new Date(dateString)
  
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }
  
  if (includeTime) {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return date.toLocaleDateString('pt-BR', options)
}

/**
 * Navegar para uma rota e rolar para o topo
 * Função utilitária para garantir que sempre role para o topo após navegação
 */
export function navigateToTop(navigate: (path: string) => void, path: string): void {
  navigate(path)
  // Rolar para o topo após a navegação
  // setTimeout garante que a navegação termine antes do scroll
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, 100)
}