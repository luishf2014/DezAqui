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
  return draws.filter(draw => new Date(draw.draw_date) >= participationDate)
}


/**
 * Retorna todos os números acertados considerando todos os sorteios
 * MODIFIQUEI AQUI - Função para obter todos os números acertados de todos os sorteios
 *
 * ANTI-FRAUUDE: Se participationCreatedAt for fornecido, só conta sorteios
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
    ? draws.filter(d => d.draw_date && new Date(d.draw_date) >= new Date(participationCreatedAt))
    : draws

  const allHitNumbers = new Set<number>()
  validDraws.forEach(draw => {
    const hits = getHitNumbers(draw.numbers, participationNumbers)
    hits.forEach(num => allHitNumbers.add(num))
  })

  return Array.from(allHitNumbers).sort((a, b) => a - b)
}


/**
 * MODIFIQUEI AQUI - Parse seguro de data para debugging e anti-fraude.
 * Evita Date inválido quebrando comparações e facilita logar.
 */
export function parseDateSafe(dateString?: string | null): Date | null {
  if (!dateString) return null
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return null
  return d
}