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
    options.hour = '2-digit'
    options.minute = '2-digit'
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