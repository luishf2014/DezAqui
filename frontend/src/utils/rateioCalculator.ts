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
  const valorPremiacao = totalRevenue - taxaAdministrativa

  // Agrupar por pontuação
  const pontuacoes = participations
    .map(p => p.current_score)
    .filter(score => score > 0)
    .sort((a, b) => b - a) // Ordenar decrescente

  if (pontuacoes.length === 0) {
    return {
      totalArrecadado: totalRevenue,
      taxaAdministrativa,
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
    const valorTotal = (valorPremiacao * config.maiorPontuacao) / 100
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
      const valorTotal = (valorPremiacao * config.segundaMaiorPontuacao) / 100
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
      const valorTotal = (valorPremiacao * config.menorPontuacao) / 100
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
