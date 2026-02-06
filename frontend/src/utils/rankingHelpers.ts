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

/**
 * Filtra sorteios que aconteceram DEPOIS da participação (anti-fraude)
 * MODIFIQUEI AQUI - Função para filtrar sorteios válidos
 *
 * Impede que participações criadas APÓS um sorteio contem acertos desse sorteio.
 * Isso evita fraude onde alguém vê o resultado e cria participação com os números vencedores.
 *
 * @param draws Array de sorteios com data
 * @param participationCreatedAt Data de criação da participação
 * @returns Array de sorteios válidos (apenas os que aconteceram depois da participação)
 */
export function filterValidDraws<T extends { numbers: number[]; draw_date: string }>(
  draws: T[],
  participationCreatedAt: string
): T[] {
  const participationDate = new Date(participationCreatedAt)
  return draws.filter(draw => new Date(draw.draw_date) > participationDate)
}

/**
 * Calcula a pontuação total de uma participação baseada em todos os sorteios
 * MODIFIQUEI AQUI - Função para calcular pontuação total somando acertos de todos os sorteios
 *
 * ANTI-FRAUDE: Se participationCreatedAt for fornecido, só conta sorteios
 * que aconteceram DEPOIS da participação ser criada.
 *
 * @param participationNumbers Números escolhidos na participação
 * @param draws Array com todos os sorteios realizados
 * @param participationCreatedAt Data de criação da participação (opcional, para anti-fraude)
 * @returns Pontuação total (soma de todos os acertos em todos os sorteios válidos)
 */
export function calculateTotalScore(
  participationNumbers: number[],
  draws: Array<{ numbers: number[]; draw_date?: string }>,
  participationCreatedAt?: string
): number {
  if (draws.length === 0) return 0

  // ANTI-FRAUDE: Se tiver data da participação, só conta sorteios após ela
  const validDraws = participationCreatedAt
    ? draws.filter(d => d.draw_date && new Date(d.draw_date) > new Date(participationCreatedAt))
    : draws

  let totalScore = 0
  validDraws.forEach(draw => {
    const hits = calculateHits(draw.numbers, participationNumbers)
    totalScore += hits
  })

  return totalScore
}

/**
 * Retorna todos os números acertados considerando todos os sorteios
 * MODIFIQUEI AQUI - Função para obter todos os números acertados de todos os sorteios
 *
 * ANTI-FRAUDE: Se participationCreatedAt for fornecido, só conta sorteios
 * que aconteceram DEPOIS da participação ser criada.
 *
 * @param participationNumbers Números escolhidos na participação
 * @param draws Array com todos os sorteios realizados
 * @param participationCreatedAt Data de criação da participação (opcional, para anti-fraude)
 * @returns Array com todos os números únicos que foram acertados em qualquer sorteio válido
 */
export function getAllHitNumbers(
  participationNumbers: number[],
  draws: Array<{ numbers: number[]; draw_date?: string }>,
  participationCreatedAt?: string
): number[] {
  if (draws.length === 0) return []

  // ANTI-FRAUDE: Se tiver data da participação, só conta sorteios após ela
  const validDraws = participationCreatedAt
    ? draws.filter(d => d.draw_date && new Date(d.draw_date) > new Date(participationCreatedAt))
    : draws

  const allHitNumbers = new Set<number>()
  validDraws.forEach(draw => {
    const hits = getHitNumbers(draw.numbers, participationNumbers)
    hits.forEach(num => allHitNumbers.add(num))
  })

  return Array.from(allHitNumbers).sort((a, b) => a - b)
}

/**
 * Verifica se a participação acertou todos os números em um sorteio específico
 * MODIFIQUEI AQUI - Nova função para verificar TOP em um sorteio
 *
 * @param participationNumbers Números escolhidos na participação
 * @param drawNumbers Números sorteados no draw
 * @returns true se acertou TODOS os números neste sorteio
 */
export function hasHitAllInDraw(
  participationNumbers: number[],
  drawNumbers: number[]
): boolean {
  const hits = calculateHits(drawNumbers, participationNumbers)
  return hits === participationNumbers.length
}

/**
 * Verifica se a participação atingiu TOP em algum sorteio
 * MODIFIQUEI AQUI - TOP = acertou TODOS os números em pelo menos um sorteio
 *
 * ANTI-FRAUDE: Se participationCreatedAt for fornecido, só considera sorteios
 * que aconteceram DEPOIS da participação ser criada.
 *
 * @param participationNumbers Números escolhidos na participação
 * @param draws Array de sorteios
 * @param participationCreatedAt Data de criação da participação (opcional, para anti-fraude)
 * @returns true se acertou todos em pelo menos um sorteio válido
 */
export function hasAchievedTop(
  participationNumbers: number[],
  draws: Array<{ numbers: number[]; draw_date?: string }>,
  participationCreatedAt?: string
): boolean {
  if (draws.length === 0) return false

  // ANTI-FRAUDE: Se tiver data da participação, só considera sorteios após ela
  const validDraws = participationCreatedAt
    ? draws.filter(d => d.draw_date && new Date(d.draw_date) > new Date(participationCreatedAt))
    : draws

  return validDraws.some(draw => hasHitAllInDraw(participationNumbers, draw.numbers))
}

/**
 * Verifica se a participação atingiu SECOND em algum sorteio
 * MODIFIQUEI AQUI - SECOND = acertou N-1 números em pelo menos um sorteio
 *
 * ANTI-FRAUDE: Se participationCreatedAt for fornecido, só considera sorteios
 * que aconteceram DEPOIS da participação ser criada.
 *
 * @param participationNumbers Números escolhidos na participação
 * @param draws Array de sorteios
 * @param participationCreatedAt Data de criação da participação (opcional, para anti-fraude)
 * @returns true se acertou N-1 em pelo menos um sorteio válido
 */
export function hasAchievedSecond(
  participationNumbers: number[],
  draws: Array<{ numbers: number[]; draw_date?: string }>,
  participationCreatedAt?: string
): boolean {
  if (draws.length === 0) return false

  // ANTI-FRAUDE: Se tiver data da participação, só considera sorteios após ela
  const validDraws = participationCreatedAt
    ? draws.filter(d => d.draw_date && new Date(d.draw_date) > new Date(participationCreatedAt))
    : draws

  const targetHits = participationNumbers.length - 1
  return validDraws.some(draw => calculateHits(draw.numbers, participationNumbers) === targetHits)
}

/**
 * Retorna o maior número de acertos em um único sorteio
 * MODIFIQUEI AQUI - Útil para determinar categoria de premiação
 *
 * ANTI-FRAUDE: Se participationCreatedAt for fornecido, só considera sorteios
 * que aconteceram DEPOIS da participação ser criada.
 *
 * @param participationNumbers Números escolhidos na participação
 * @param draws Array de sorteios
 * @param participationCreatedAt Data de criação da participação (opcional, para anti-fraude)
 * @returns Maior número de acertos em um único sorteio válido
 */
export function getMaxHitsInSingleDraw(
  participationNumbers: number[],
  draws: Array<{ numbers: number[]; draw_date?: string }>,
  participationCreatedAt?: string
): number {
  if (draws.length === 0) return 0

  // ANTI-FRAUDE: Se tiver data da participação, só considera sorteios após ela
  const validDraws = participationCreatedAt
    ? draws.filter(d => d.draw_date && new Date(d.draw_date) > new Date(participationCreatedAt))
    : draws

  if (validDraws.length === 0) return 0
  return Math.max(...validDraws.map(draw => calculateHits(draw.numbers, participationNumbers)))
}
