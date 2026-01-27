/**
 * Gerador de código/ticket único para participações
 * FASE 1: Fundação do Sistema
 * 
 * Gera códigos no formato: TKT-YYYYMMDD-XXXXXX
 * Exemplo: TKT-20250124-A1B2C3
 */

/**
 * Gera um código único para participação
 * Formato: TKT-YYYYMMDD-XXXXXX
 * 
 * @returns Código único no formato TKT-YYYYMMDD-XXXXXX
 */
export function generateTicketCode(): string {
  // Data atual no formato YYYYMMDD
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const datePart = `${year}${month}${day}`

  // 6 caracteres alfanuméricos aleatórios (maiúsculas e números)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let randomPart = ''
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return `TKT-${datePart}-${randomPart}`
}

/**
 * Valida se um código de ticket está no formato correto
 * 
 * @param code Código a ser validado
 * @returns true se o formato está correto
 */
export function isValidTicketCode(code: string): boolean {
  const pattern = /^TKT-\d{8}-[A-Z0-9]{6}$/
  return pattern.test(code)
}
