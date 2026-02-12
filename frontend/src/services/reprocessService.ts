/**
 * Serviço de Reprocessamento de Concursos
 * FASE 4: Sorteios e Rateio
 * 
 * Centraliza a lógica de reprocessamento após criação/edição/exclusão de sorteios
 * MODIFIQUEI AQUI - Serviço para reprocessar acertos, pontuações e rateio
 */
import { supabase } from '../lib/supabase'
import { listDrawsByContestId, getDrawById } from './drawsService'
import { getAllHitNumbers } from '../utils/rankingHelpers'
import { calculateRateio, calculateDrawPayouts, RateioConfig } from '../utils/rateioCalculator'

/**
 * Reprocessa um concurso após mudanças em sorteios
 * MODIFIQUEI AQUI - Função central para reprocessar acertos, pontuações e rateio
 * 
 * @param contestId ID do concurso a ser reprocessado
 */
export async function reprocessContestAfterDraw(contestId: string): Promise<void> {
  console.log(`[reprocessService] Iniciando reprocessamento do concurso ${contestId}...`)

  try {
    // 1. Buscar todas as participações ativas do concurso
    // MODIFIQUEI AQUI - Incluir created_at para anti-fraude
    const { data: participations, error: participationsError } = await supabase
      .from('participations')
      .select('id, numbers, current_score, user_id, ticket_code, created_at, profiles:user_id(name)')
      .eq('contest_id', contestId)
      .eq('status', 'active') // Apenas participações ativas

    if (participationsError) {
      throw new Error(`Erro ao buscar participações: ${participationsError.message}`)
    }

    if (!participations || participations.length === 0) {
      console.log(`[reprocessService] Nenhuma participação ativa encontrada para o concurso ${contestId}`)
      return
    }

    // 2. Buscar todos os sorteios do concurso
    const draws = await listDrawsByContestId(contestId)

    if (draws.length === 0) {
      console.log(`[reprocessService] Nenhum sorteio encontrado. Zerando pontuações...`)
      // Se não há sorteios, zerar todas as pontuações
      await Promise.all(
        participations.map(async (participation: any) => {
          await supabase
            .from('participations')
            .update({ current_score: 0, updated_at: new Date().toISOString() })
            .eq('id', participation.id)
        })
      )
      return
    }

    // 3. Buscar informações do concurso (para percentuais de premiação)
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, first_place_pct, second_place_pct, lowest_place_pct, admin_fee_pct, participation_value, numbers_per_participation')
      .eq('id', contestId)
      .single()

    if (contestError || !contest) {
      console.warn(`[reprocessService] Erro ao buscar concurso, usando valores padrão:`, contestError)
    }

    // 4. Ordenar sorteios por data ascendente (para cálculo cumulativo correto)
    const drawsSortedAsc = [...draws].sort((a, b) =>
      new Date(a.draw_date).getTime() - new Date(b.draw_date).getTime()
    )

    // 5. Calcular nova pontuação para cada participação (numeros UNICOS acertados em QUALQUER sorteio)
    // Score = contagem de numeros unicos do bilhete que apareceram em qualquer sorteio valido
    const updates: Array<{ id: string; score: number }> = []

    participations.forEach((participation: any) => {
      const participationDate = new Date(participation.created_at)
      // Filtrar sorteios válidos (após a participação - anti-fraude)
      const validDraws = draws.filter(d => new Date(d.draw_date) >= participationDate)
      // Score = numeros unicos acertados (acumulativo)
      const hitNumbers = getAllHitNumbers(participation.numbers, validDraws, participation.created_at)
      const newScore = hitNumbers.length
      updates.push({
        id: participation.id,
        score: newScore,
      })
    })

    // 6. Atualizar current_score de todas as participações em batch
    console.log(`[reprocessService] Atualizando ${updates.length} participações...`)

    await Promise.all(
      updates.map(async (update) => {
        const { error } = await supabase
          .from('participations')
          .update({
            current_score: update.score,
            updated_at: new Date().toISOString(),
          })
          .eq('id', update.id)

        if (error) {
          console.error(`[reprocessService] Erro ao atualizar participação ${update.id}:`, error)
        }
      })
    )

    console.log(`[reprocessService] Pontuações atualizadas com sucesso`)

    // 7. Verificar se algum participante atingiu TOP (acumulou TODOS os numeros unicos) e encerrar concurso
    // TOP = numeros unicos acertados em qualquer sorteio valido == total de numeros do bilhete
    const numbersPerParticipation = contest?.numbers_per_participation
    if (numbersPerParticipation) {
      const hasTopWinner = participations.some((p: any) => {
        const participationDate = new Date(p.created_at)
        const validDraws = draws.filter(d => new Date(d.draw_date) >= participationDate)
        const hitNumbers = getAllHitNumbers(p.numbers, validDraws, p.created_at)
        return hitNumbers.length === p.numbers.length
      })

      if (hasTopWinner) {
        console.log(`[reprocessService] *** GANHADOR TOP ENCONTRADO! *** Alguém acertou todos os números em um sorteio! Encerrando concurso...`)

        // Atualizar status do concurso para 'finished'
        const { error: updateError } = await supabase
          .from('contests')
          .update({ status: 'finished', updated_at: new Date().toISOString() })
          .eq('id', contestId)
          .eq('status', 'active') // Só atualiza se ainda estiver ativo

        if (updateError) {
          console.error(`[reprocessService] Erro ao encerrar concurso:`, updateError)
        } else {
          console.log(`[reprocessService] Concurso ${contestId} encerrado com sucesso!`)
        }
      }
    }

    // 8. Processar prêmios para cada sorteio (verificando o maior número de acertos em um único sorteio até aquele ponto)
    for (let i = 0; i < drawsSortedAsc.length; i++) {
      const drawsUpToNow = drawsSortedAsc.slice(0, i + 1)
      try {
        await reprocessDrawResults(drawsSortedAsc[i].id, drawsUpToNow)
      } catch (drawError) {
        console.error(`[reprocessService] Erro ao processar prêmios do sorteio ${drawsSortedAsc[i].id}:`, drawError)
        // Continuar processando outros sorteios mesmo se um falhar
      }
    }

    // 7. Calcular e salvar snapshot de rateio (apenas se houver sorteios e participações com pontuação > 0)
    const participationsWithScore = participations.filter((p: any) => {
      const update = updates.find(u => u.id === p.id)
      return update && update.score > 0
    })

    if (participationsWithScore.length > 0 && draws.length > 0) {
      // Buscar total arrecadado (soma de pagamentos pagos)
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'paid')
        .in('participation_id', participations.map((p: any) => p.id))

      if (paymentsError) {
        console.warn(`[reprocessService] Erro ao buscar pagamentos para rateio:`, paymentsError)
      }

      const totalArrecadado = payments && !paymentsError
        ? payments.reduce((sum, p) => sum + Number(p.amount), 0)
        : 0

      if (totalArrecadado > 0) {
        console.log(`[reprocessService] Calculando rateio para ${participationsWithScore.length} participações com pontuação. Total arrecadado: R$ ${totalArrecadado.toFixed(2)}`)
        // Preparar configuração de rateio (usar valores do concurso ou padrão)
        const rateioConfig: RateioConfig = {
          maiorPontuacao: contest?.first_place_pct || 65,
          segundaMaiorPontuacao: contest?.second_place_pct || 10,
          menorPontuacao: contest?.lowest_place_pct || 7,
          taxaAdministrativa: contest?.admin_fee_pct || 18,
        }

        // Preparar participações com pontuação atualizada
        // MODIFIQUEI AQUI - Corrigir acesso ao relacionamento profiles
        const participationsForRateio = participationsWithScore.map((p: any) => {
          const update = updates.find(u => u.id === p.id)
          const profileData = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
          return {
            current_score: update?.score || 0,
            user_id: p.user_id,
            id: p.id,
            ticket_code: p.ticket_code,
            user: profileData ? { name: profileData.name } : null,
          }
        })

        // Calcular rateio
        const rateioResult = calculateRateio(participationsForRateio, totalArrecadado, rateioConfig)

        // Salvar snapshot do rateio (usar o último sorteio como referência)
        const lastDraw = draws[draws.length - 1]
        
        const { error: snapshotError } = await supabase
          .from('rateio_snapshots')
          .insert({
            contest_id: contestId,
            draw_id: lastDraw.id,
            total_arrecadado: rateioResult.totalArrecadado,
            taxa_administrativa: rateioResult.taxaAdministrativa,
            valor_premiacao: rateioResult.valorPremiacao,
            first_place_pct: rateioConfig.maiorPontuacao,
            second_place_pct: rateioConfig.segundaMaiorPontuacao,
            lowest_place_pct: rateioConfig.menorPontuacao,
            admin_fee_pct: rateioConfig.taxaAdministrativa,
            distribuicao: rateioResult.distribuicao,
            ganhadores: rateioResult.ganhadores,
          })

        if (snapshotError) {
          console.error(`[reprocessService] Erro ao salvar snapshot de rateio:`, snapshotError)
          // Não falhar o reprocessamento se o snapshot falhar
        } else {
          console.log(`[reprocessService] Snapshot de rateio salvo com sucesso para sorteio ${lastDraw.id}`)
        }
      } else {
        console.log(`[reprocessService] Rateio não calculado: total arrecadado é zero (R$ 0,00)`)
      }
    } else {
      if (participationsWithScore.length === 0) {
        console.log(`[reprocessService] Rateio não calculado: nenhuma participação com pontuação > 0`)
      }
      if (draws.length === 0) {
        console.log(`[reprocessService] Rateio não calculado: nenhum sorteio encontrado`)
      }
    }

    console.log(`[reprocessService] Reprocessamento do concurso ${contestId} concluído com sucesso`)
  } catch (error) {
    console.error(`[reprocessService] Erro ao reprocessar concurso ${contestId}:`, error)
    throw error
  }
}

/**
 * Reprocessa um sorteio específico e calcula/salva prêmios por participação
 * Usa pontuação CUMULATIVA (soma de acertos de todos os sorteios até o atual)
 *
 * @param drawId ID do sorteio a ser processado
 * @param cumulativeDraws Array de sorteios para cálculo cumulativo (todos os draws até este).
 *                        Se não fornecido, busca todos os draws do concurso até este.
 */
export async function reprocessDrawResults(drawId: string, cumulativeDraws?: Array<{ numbers: number[] }>): Promise<void> {
  console.log(`[reprocessService] Iniciando processamento de prêmios para sorteio ${drawId}...`)

  try {
    // 1. Buscar dados do sorteio
    const draw = await getDrawById(drawId)
    if (!draw) {
      throw new Error(`Sorteio ${drawId} não encontrado`)
    }

    // 2. Buscar informações do concurso
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, first_place_pct, second_place_pct, lowest_place_pct, admin_fee_pct, participation_value, numbers_per_participation')
      .eq('id', draw.contest_id)
      .single()

    if (contestError || !contest) {
      throw new Error(`Erro ao buscar concurso: ${contestError?.message || 'Concurso não encontrado'}`)
    }

    if (!contest.numbers_per_participation) {
      throw new Error(`Concurso não possui numbers_per_participation configurado`)
    }

    // 3. Buscar todas as participações ativas do concurso
    // MODIFIQUEI AQUI - Incluir created_at para anti-fraude
    const { data: participations, error: participationsError } = await supabase
      .from('participations')
      .select('id, numbers, current_score, user_id, ticket_code, created_at')
      .eq('contest_id', draw.contest_id)
      .eq('status', 'active')

    if (participationsError) {
      throw new Error(`Erro ao buscar participações: ${participationsError.message}`)
    }

    if (!participations || participations.length === 0) {
      console.log(`[reprocessService] Nenhuma participação ativa encontrada`)
      // Limpar payouts existentes deste draw
      await supabase.from('draw_payouts').delete().eq('draw_id', drawId)
      return
    }

    // 4. Determinar draws para calculo de pontuacao acumulativa (todos os sorteios ate este)
    // Score = numeros unicos acertados em qualquer sorteio valido ate este ponto
    let drawsForScore: Array<{ numbers: number[]; draw_date: string }>
    if (cumulativeDraws && cumulativeDraws.length > 0 && 'draw_date' in cumulativeDraws[0]) {
      drawsForScore = cumulativeDraws as Array<{ numbers: number[]; draw_date: string }>
    } else {
      // Se não fornecido ou sem draw_date, buscar todos os draws do concurso até este (inclusive)
      const allDraws = await listDrawsByContestId(draw.contest_id)
      const allDrawsSorted = [...allDraws].sort((a, b) =>
        new Date(a.draw_date).getTime() - new Date(b.draw_date).getTime()
      )
      const drawIndex = allDrawsSorted.findIndex(d => d.id === drawId)
      drawsForScore = allDrawsSorted.slice(0, drawIndex + 1)
    }

    // 5. Calcular pontuação de cada participação (numeros UNICOS acertados em qualquer sorteio ate este)
    // Score = contagem de numeros unicos do bilhete acertados (acumulativo)
    const participationsWithScore = participations.map(p => ({
      id: p.id,
      user_id: p.user_id,
      numbers: p.numbers,
      created_at: p.created_at,
      current_score: getAllHitNumbers(p.numbers, drawsForScore, p.created_at).length,
    }))

    // 5. Buscar total arrecadado
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'paid')
      .in('participation_id', participations.map(p => p.id))

    if (paymentsError) {
      console.warn(`[reprocessService] Erro ao buscar pagamentos:`, paymentsError)
    }

    const totalArrecadado = payments && !paymentsError
      ? payments.reduce((sum, p) => sum + Number(p.amount), 0)
      : 0

    // 6. Calcular prêmios usando a nova função
    const rateioConfig: RateioConfig = {
      maiorPontuacao: contest.first_place_pct || 65,
      segundaMaiorPontuacao: contest.second_place_pct || 10,
      menorPontuacao: contest.lowest_place_pct || 7,
      taxaAdministrativa: contest.admin_fee_pct || 18,
    }

    // MODIFIQUEI AQUI - Passar numbers_per_participation e draws para cálculo correto de TOP/SECOND
    const payoutResult = calculateDrawPayouts(
      participationsWithScore,
      totalArrecadado,
      rateioConfig,
      contest.numbers_per_participation,
      drawsForScore
    )

    // 7. MODIFIQUEI AQUI - Deletar payouts existentes deste draw (idempotência)
    await supabase.from('draw_payouts').delete().eq('draw_id', drawId)

    // 8. Inserir novos payouts
    if (payoutResult.payouts.length > 0) {
      const payoutsToInsert = payoutResult.payouts.map(payout => ({
        draw_id: drawId,
        contest_id: draw.contest_id,
        participation_id: payout.participationId,
        user_id: payout.userId,
        category: payout.category,
        score: payout.score,
        amount_won: payout.amountWon,
      }))

      const { error: insertError } = await supabase
        .from('draw_payouts')
        .insert(payoutsToInsert)

      if (insertError) {
        console.error(`[reprocessService] Erro ao salvar payouts:`, insertError)
        throw insertError
      }

      console.log(`[reprocessService] ${payoutsToInsert.length} payouts salvos para sorteio ${drawId}`)
    } else {
      console.log(`[reprocessService] Nenhum payout para salvar (sem ganhadores)`)
    }

    console.log(`[reprocessService] Processamento de prêmios para sorteio ${drawId} concluído`)
  } catch (error) {
    console.error(`[reprocessService] Erro ao processar prêmios do sorteio ${drawId}:`, error)
    throw error
  }
}
