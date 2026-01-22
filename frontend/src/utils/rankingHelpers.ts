/**
 * Helpers para cálculos de ranking
 * FASE 2: Participações e Ranking
 * 
 * Funções auxiliares para calcular acertos e preparar dados para ranking
 */

/**
 * Calcula a quantidade de acertos entre números sorteados e números da participação
 * CHATGPT: Base para ranking - calcula interseção entre arrays
 * 
 * @param drawNumbers Números sorteados no draw
 * @param participationNumbers Números escolhidos na participação
 * @returns Quantidade de acertos (interseção)
 */
export function calculateHits(
  drawNumbers: number[],
  participationNumbers: number[]
): number {
  const drawSet = new Set(drawNumbers)
  const hits = participationNumbers.filter((num) => drawSet.has(num))
  return hits.length
}

/**
 * Retorna os números que foram acertados
 * CHATGPT: Útil para destacar números acertados na UI
 * 
 * @param drawNumbers Números sorteados no draw
 * @param participationNumbers Números escolhidos na participação
 * @returns Array com os números acertados (ordenados)
 */
export function getHitNumbers(
  drawNumbers: number[],
  participationNumbers: number[]
): number[] {
  const drawSet = new Set(drawNumbers)
  return participationNumbers
    .filter((num) => drawSet.has(num))
    .sort((a, b) => a - b)
}
