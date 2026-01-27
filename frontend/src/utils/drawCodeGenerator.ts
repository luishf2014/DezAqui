/**
 * Gerador de códigos únicos para sorteios
 * FASE 4: Sorteios e Rateio
 * 
 * Formato: DRW-YYYYMMDD-XXXXXX
 * Exemplo: DRW-20250124-A1B2C3
 */

/**
 * Gera um código único para um sorteio
 * MODIFIQUEI AQUI - Função para gerar código de sorteio
 * 
 * @returns Código no formato DRW-YYYYMMDD-XXXXXX
 */
export function generateDrawCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const datePart = `${year}${month}${day}`

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let randomPart = ''
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `DRW-${datePart}-${randomPart}`
}

/**
 * Valida se uma string é um código de sorteio válido
 * MODIFIQUEI AQUI - Função para validar código de sorteio
 * 
 * @param code Código a ser validado
 * @returns true se o código é válido, false caso contrário
 */
export function isValidDrawCode(code: string): boolean {
  const pattern = /^DRW-\d{8}-[A-Z0-9]{6}$/
  return pattern.test(code)
}
