/**
 * Calculadora de Rateio
 * FASE 4: Sorteios e Rateio
 * 
 * Calcula distribuição de prêmios baseado nas regras configuráveis
 */

export interface RateioConfig {
  maiorPontuacao: number // Ex: 65%
  segundaMaiorPontuacao: number // Ex: 10%
  menorPontuacao: number // Ex: 7%
  taxaAdministrativa: number // Ex: 18%
}

export interface RateioResult {
  totalArrecadado: number
  taxaAdministrativa: number
  valorPremiacao: number
  distribuicao: Array<{
    categoria: string
    pontuacao: number
    quantidadeGanhadores: number
    valorPorGanhador: number
    valorTotal: number
    percentual: number
  }>
  ganhadores: Array<{
    userId: string
    userName: string
    participationId: string
    ticketCode?: string
    pontuacao: number
    categoria: string
    valorPremio: number
  }>
}

// MODIFIQUEI AQUI - Interface para resultado de prêmios por draw
export interface DrawPayoutResult {
  maxScore: number // Maior pontuação do sorteio (0 = nenhum ganhador)
  categories: {
    TOP: {
      score: number
      winnersCount: number
      amountPerWinner: number
      totalAmount: number
    } | null
    SECOND: {
      score: number
      winnersCount: number
      amountPerWinner: number
      totalAmount: number
    } | null
    LOWEST: {
      score: number
      winnersCount: number
      amountPerWinner: number
      totalAmount: number
    } | null
  }
  payouts: Array<{
    participationId: string
    userId: string
    category: 'TOP' | 'SECOND' | 'LOWEST' | 'NONE'
    score: number
    amountWon: number
  }>
}

/**
 * Calcula o rateio baseado nas participações e sorteios
 * MODIFIQUEI AQUI - Função para calcular rateio
 * 
 * @param participations Participações com pontuação
 * @param totalRevenue Total arrecadado
 * @param config Configuração de percentuais (padrão do README)
 */
export function calculateRateio(
  participations: Array<{ current_score: number; user_id: string; id: string; ticket_code?: string; user?: { name: string } | null }>,
  totalRevenue: number,
  config: RateioConfig = {
    maiorPontuacao: 65,
    segundaMaiorPontuacao: 10,
    menorPontuacao: 7,
    taxaAdministrativa: 18,
  }
): RateioResult {
  // Validar que soma dos percentuais seja 100%
  const totalPercent = config.maiorPontuacao + config.segundaMaiorPontuacao + config.menorPontuacao + config.taxaAdministrativa
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new Error(`A soma dos percentuais deve ser 100%. Atual: ${totalPercent}%`)
  }

  // Calcular valores
  const taxaAdministrativa = (totalRevenue * config.taxaAdministrativa) / 100

  // MODIFIQUEI AQUI - valorPremiacao agora é a SOMA DAS CATEGORIAS (TOP/SECOND/LOWEST) calculadas sobre o TOTAL,
  // e não "total - taxa". Isso garante que 65/10/7/18 sempre bata 100% do total.
  const valorPremiacao = (totalRevenue * (config.maiorPontuacao + config.segundaMaiorPontuacao + config.menorPontuacao)) / 100

  // Agrupar por pontuação
  const pontuacoes = participations
    .map(p => p.current_score)
    .filter(score => score > 0)
    .sort((a, b) => b - a) // Ordenar decrescente

  if (pontuacoes.length === 0) {
    return {
      totalArrecadado: totalRevenue,
      taxaAdministrativa,
      // MODIFIQUEI AQUI - se não há ganhadores, não há premiação distribuída
      valorPremiacao: 0,
      distribuicao: [],
      ganhadores: [],
    }
  }

  const maiorPontuacao = pontuacoes[0]
  const segundaMaiorPontuacao = pontuacoes.find(p => p < maiorPontuacao) || null
  const menorPontuacao = pontuacoes[pontuacoes.length - 1]

  // Calcular distribuição
  const distribuicao: RateioResult['distribuicao'] = []
  const ganhadores: RateioResult['ganhadores'] = []

  // Maior pontuação
  const ganhadoresMaior = participations.filter(p => p.current_score === maiorPontuacao)
  if (ganhadoresMaior.length > 0) {
    // MODIFIQUEI AQUI - percentuais aplicados sobre o TOTAL (não desconta admin antes)
    const valorTotal = (totalRevenue * config.maiorPontuacao) / 100
    const valorPorGanhador = valorTotal / ganhadoresMaior.length

    distribuicao.push({
      categoria: 'Maior Pontuação',
      pontuacao: maiorPontuacao,
      quantidadeGanhadores: ganhadoresMaior.length,
      valorPorGanhador,
      valorTotal,
      percentual: config.maiorPontuacao,
    })

    ganhadoresMaior.forEach(p => {
      ganhadores.push({
        userId: p.user_id,
        userName: p.user?.name || 'N/A',
        participationId: p.id,
        ticketCode: p.ticket_code,
        pontuacao: p.current_score,
        categoria: 'Maior Pontuação',
        valorPremio: valorPorGanhador,
      })
    })
  }

  // Segunda maior pontuação (se diferente da maior)
  if (segundaMaiorPontuacao && segundaMaiorPontuacao < maiorPontuacao) {
    const ganhadoresSegunda = participations.filter(p => p.current_score === segundaMaiorPontuacao)
    if (ganhadoresSegunda.length > 0) {
      // MODIFIQUEI AQUI - percentuais aplicados sobre o TOTAL (não desconta admin antes)
      const valorTotal = (totalRevenue * config.segundaMaiorPontuacao) / 100
      const valorPorGanhador = valorTotal / ganhadoresSegunda.length

      distribuicao.push({
        categoria: 'Segunda Maior Pontuação',
        pontuacao: segundaMaiorPontuacao,
        quantidadeGanhadores: ganhadoresSegunda.length,
        valorPorGanhador,
        valorTotal,
        percentual: config.segundaMaiorPontuacao,
      })

      ganhadoresSegunda.forEach(p => {
        ganhadores.push({
          userId: p.user_id,
          userName: p.user?.name || 'N/A',
          participationId: p.id,
          ticketCode: p.ticket_code,
          pontuacao: p.current_score,
          categoria: 'Segunda Maior Pontuação',
          valorPremio: valorPorGanhador,
        })
      })
    }
  }

  // Menor pontuação (se diferente das outras)
  if (menorPontuacao < (segundaMaiorPontuacao || maiorPontuacao)) {
    const ganhadoresMenor = participations.filter(p => p.current_score === menorPontuacao)
    if (ganhadoresMenor.length > 0) {
      // MODIFIQUEI AQUI - percentuais aplicados sobre o TOTAL (não desconta admin antes)
      const valorTotal = (totalRevenue * config.menorPontuacao) / 100
      const valorPorGanhador = valorTotal / ganhadoresMenor.length

      distribuicao.push({
        categoria: 'Menor Pontuação',
        pontuacao: menorPontuacao,
        quantidadeGanhadores: ganhadoresMenor.length,
        valorPorGanhador,
        valorTotal,
        percentual: config.menorPontuacao,
      })

      ganhadoresMenor.forEach(p => {
        ganhadores.push({
          userId: p.user_id,
          userName: p.user?.name || 'N/A',
          participationId: p.id,
          ticketCode: p.ticket_code,
          pontuacao: p.current_score,
          categoria: 'Menor Pontuação',
          valorPremio: valorPorGanhador,
        })
      })
    }
  }

  return {
    totalArrecadado: totalRevenue,
    taxaAdministrativa,
    valorPremiacao,
    distribuicao,
    ganhadores: ganhadores.sort((a, b) => b.pontuacao - a.pontuacao), // Ordenar por pontuação
  }
}

/**
 * Calcula prêmios por draw seguindo regras específicas: TOP, SECOND, LOWEST
 * MODIFIQUEI AQUI - Função para calcular prêmios por sorteio com categorias específicas
 *
 * Regras CORRETAS:
 * - TOP: acertou TODOS os números em UM ÚNICO SORTEIO (não cumulativo)
 * - SECOND: acertou N-1 números em UM ÚNICO SORTEIO (não cumulativo)
 * - LOWEST: menor pontuação CUMULATIVA positiva (>0) entre todas as participações
 * - NONE: não premiado
 * - Se categoria não tiver ganhadores, NÃO redistribui o valor
 * - ANTI-FRAUDE: só conta sorteios que aconteceram DEPOIS da participação ser criada
 *
 * @param participations Participações com números, data de criação e pontuação
 * @param totalRevenue Total arrecadado (pool)
 * @param config Configuração de percentuais
 * @param numbersPerParticipation Quantidade de números por participação (ex: 10)
 * @param draws Array de sorteios com números e data
 */
export function calculateDrawPayouts(
  participations: Array<{
    id: string
    user_id: string
    numbers: number[]
    created_at: string
    current_score: number
  }>,
  totalRevenue: number,
  config: RateioConfig,
  numbersPerParticipation: number,
  draws: Array<{ numbers: number[]; draw_date: string }>
): DrawPayoutResult {
  // Validar que soma dos percentuais seja 100%
  const totalPercent = config.maiorPontuacao + config.segundaMaiorPontuacao + config.menorPontuacao + config.taxaAdministrativa
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new Error(`A soma dos percentuais deve ser 100%. Atual: ${totalPercent}%`)
  }

  // Helper para calcular acertos
  const calculateHits = (drawNumbers: number[], participationNumbers: number[]): number => {
    const drawSet = new Set(drawNumbers)
    return participationNumbers.filter(num => drawSet.has(num)).length
  }

  // Helper para filtrar sorteios válidos (anti-fraude)
  const getValidDraws = (participationCreatedAt: string) => {
    const participationDate = new Date(participationCreatedAt)
    return draws.filter(d => new Date(d.draw_date) > participationDate)
  }

  // Helper para verificar se atingiu TOP (acertou TODOS em algum sorteio)
  const isTop = (p: { numbers: number[]; created_at: string }): boolean => {
    const validDraws = getValidDraws(p.created_at)
    return validDraws.some(draw => calculateHits(draw.numbers, p.numbers) === p.numbers.length)
  }

  // Helper para verificar se atingiu SECOND (acertou N-1 em algum sorteio)
  const isSecond = (p: { numbers: number[]; created_at: string }): boolean => {
    const validDraws = getValidDraws(p.created_at)
    const targetHits = p.numbers.length - 1
    return validDraws.some(draw => calculateHits(draw.numbers, p.numbers) === targetHits)
  }

  // MODIFIQUEI AQUI - Obter todas as pontuações cumulativas positivas ordenadas
  const scores = participations
    .map(p => p.current_score)
    .filter(score => score > 0)
    .sort((a, b) => b - a) // Ordenar decrescente

  const maxScore = scores.length > 0 ? scores[0] : 0

  // Se maxScore == 0, não há ganhadores
  if (maxScore === 0) {
    return {
      maxScore: 0,
      categories: {
        TOP: null,
        SECOND: null,
        LOWEST: null,
      },
      payouts: participations.map(p => ({
        participationId: p.id,
        userId: p.user_id,
        category: 'NONE' as const,
        score: p.current_score,
        amountWon: 0,
      })),
    }
  }

  // MODIFIQUEI AQUI - TOP: quem acertou TODOS os números em algum sorteio válido
  const topWinners = participations.filter(p => isTop(p))

  // MODIFIQUEI AQUI - SECOND: quem acertou N-1 em algum sorteio válido (e NÃO é TOP)
  const topWinnerIds = new Set(topWinners.map(t => t.id))
  const secondWinners = participations.filter(p => !topWinnerIds.has(p.id) && isSecond(p))

  // MODIFIQUEI AQUI - LOWEST: menor pontuação CUMULATIVA positiva (excluindo TOP e SECOND)
  const secondWinnerIds = new Set(secondWinners.map(s => s.id))
  const othersWithScore = participations.filter(
    p => !topWinnerIds.has(p.id) && !secondWinnerIds.has(p.id) && p.current_score > 0
  )
  const lowestScore = othersWithScore.length > 0
    ? Math.min(...othersWithScore.map(p => p.current_score))
    : 0
  const lowestWinners = othersWithScore.filter(p => p.current_score === lowestScore)

  // MODIFIQUEI AQUI - Calcular prêmios (NÃO redistribui se não houver ganhadores)
  const prizeTop = topWinners.length > 0
    ? (totalRevenue * config.maiorPontuacao) / 100
    : 0
  const prizeSecond = secondWinners.length > 0
    ? (totalRevenue * config.segundaMaiorPontuacao) / 100
    : 0
  const prizeLowest = lowestWinners.length > 0
    ? (totalRevenue * config.menorPontuacao) / 100
    : 0

  // MODIFIQUEI AQUI - Montar resultado das categorias
  const categories = {
    TOP: topWinners.length > 0 ? {
      score: numbersPerParticipation, // TOP = N acertos em um sorteio
      winnersCount: topWinners.length,
      amountPerWinner: prizeTop / topWinners.length,
      totalAmount: prizeTop,
    } : null,
    SECOND: secondWinners.length > 0 ? {
      score: numbersPerParticipation - 1, // SECOND = N-1 acertos em um sorteio
      winnersCount: secondWinners.length,
      amountPerWinner: prizeSecond / secondWinners.length,
      totalAmount: prizeSecond,
    } : null,
    LOWEST: lowestWinners.length > 0 ? {
      score: lowestScore, // LOWEST = menor pontuação cumulativa
      winnersCount: lowestWinners.length,
      amountPerWinner: prizeLowest / lowestWinners.length,
      totalAmount: prizeLowest,
    } : null,
  }

  // MODIFIQUEI AQUI - Montar payouts por participação
  const payouts = participations.map(p => {
    let category: 'TOP' | 'SECOND' | 'LOWEST' | 'NONE' = 'NONE'
    let amountWon = 0

    if (topWinnerIds.has(p.id)) {
      category = 'TOP'
      amountWon = prizeTop / topWinners.length
    } else if (secondWinnerIds.has(p.id)) {
      category = 'SECOND'
      amountWon = prizeSecond / secondWinners.length
    } else if (lowestWinners.some(l => l.id === p.id)) {
      category = 'LOWEST'
      amountWon = prizeLowest / lowestWinners.length
    }

    return {
      participationId: p.id,
      userId: p.user_id,
      category,
      score: p.current_score,
      amountWon,
    }
  })

  return {
    maxScore,
    categories,
    payouts,
  }
}
