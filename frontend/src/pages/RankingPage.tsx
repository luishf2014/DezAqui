/**
 * Página de Ranking de um Concurso
 * FASE 2: Participações e Ranking
 * 
 * Exibe o ranking de participantes ordenado por pontuação
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getContestById } from '../services/contestsService'
import { getContestRanking } from '../services/participationsService'
import { listDrawsByContestId } from '../services/drawsService'
import { getDrawPayoutSummary, getPayoutsByDraw } from '../services/payoutsService'
import { Contest, Participation, Draw } from '../types'
import { calculateTotalScore, getAllHitNumbers } from '../utils/rankingHelpers'
import { getPayoutCategory } from '../utils/payoutCategoryHelpers'
// MODIFIQUEI AQUI - Removido import não utilizado: calculateRankedPositions já não é mais usado
import { getContestState } from '../utils/contestHelpers'
import Header from '../components/Header'
import Footer from '../components/Footer'

interface ParticipationWithUser extends Participation {
  user: { id: string; name: string; email: string } | null
}

export default function RankingPage() {
  const { id } = useParams<{ id: string }>()
  const [contest, setContest] = useState<Contest | null>(null)
  const [participations, setParticipations] = useState<ParticipationWithUser[]>([])
  const [draws, setDraws] = useState<Draw[]>([])
  const [selectedDrawId, setSelectedDrawId] = useState<string>('')
  const [payoutSummary, setPayoutSummary] = useState<any>(null)
  const [payouts, setPayouts] = useState<Record<string, any>>({}) // participationId -> DrawPayout
  const [filter, setFilter] = useState<'all' | 'premiados' | 'TOP' | 'SECOND' | 'LOWEST' | 'nao_premiados'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRankingData() {
      if (!id) {
        setError('ID do concurso não fornecido')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Carregar concurso, ranking e sorteios em paralelo
        const [contestData, rankingData, drawsData] = await Promise.all([
          getContestById(id),
          getContestRanking(id),
          listDrawsByContestId(id),
        ])

        if (!contestData) {
          setError('Concurso não encontrado')
          return
        }

        setContest(contestData)
        setParticipations(rankingData)
        setDraws(drawsData)

        // MODIFIQUEI AQUI - Selecionar o último sorteio por padrão
        if (drawsData.length > 0) {
          const lastDraw = drawsData[0] // Já ordenado por data desc
          setSelectedDrawId(lastDraw.id)
          await loadDrawPayouts(lastDraw.id)
        } else {
          // MODIFIQUEI AQUI - Se não há sorteios, garantir estado consistente
          setSelectedDrawId('')
          setPayoutSummary(null)
          setPayouts({})
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar ranking')
      } finally {
        setLoading(false)
      }
    }

    loadRankingData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // MODIFIQUEI AQUI - Carregar prêmios quando sorteio selecionado mudar
  const loadDrawPayouts = async (drawId: string) => {
    try {
      const [summary, drawPayouts] = await Promise.all([
        getDrawPayoutSummary(drawId),
        getPayoutsByDraw(drawId),
      ])

      setPayoutSummary(summary)

      // MODIFIQUEI AQUI - Criar mapa de participação -> payout completo
      const payoutsMap: Record<string, any> = {}
      drawPayouts.forEach((p) => {
        payoutsMap[p.participation_id] = p
      })
      setPayouts(payoutsMap)
    } catch (err) {
      console.error('Erro ao carregar prêmios:', err)
    }
  }

  useEffect(() => {
    if (selectedDrawId) {
      loadDrawPayouts(selectedDrawId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDrawId])

  // Helper: retorna draws ordenados por data ascendente
  const drawsSortedAsc = useMemo(() => {
    return [...draws].sort((a, b) =>
      new Date(a.draw_date).getTime() - new Date(b.draw_date).getTime()
    )
  }, [draws])

  // Helper: retorna draws cumulativos até o draw selecionado (inclusive)
  const getDrawsUpTo = (drawId: string): Draw[] => {
    const idx = drawsSortedAsc.findIndex(d => d.id === drawId)
    if (idx === -1) return drawsSortedAsc // fallback: todos
    return drawsSortedAsc.slice(0, idx + 1)
  }

  // Calcular pontuação CUMULATIVA baseada em todos os sorteios
  const getTotalScore = (participation: Participation): number => {
    return calculateTotalScore(participation.numbers, draws)
  }

  // Calcular pontuação CUMULATIVA até um sorteio específico (soma de todos até aquele)
  const getScoreUpToDraw = (participation: Participation, drawId: string): number => {
    const drawsUpTo = getDrawsUpTo(drawId)
    return calculateTotalScore(participation.numbers, drawsUpTo)
  }

  // Números sorteados para exibição (CUMULATIVO até o draw selecionado)
  const drawnNumbersSorted = useMemo((): number[] => {
    const drawsToUse = selectedDrawId ? getDrawsUpTo(selectedDrawId) : draws
    const allNumbers = new Set<number>()
    drawsToUse.forEach((draw) => {
      draw.numbers.forEach((num) => allNumbers.add(num))
    })
    return Array.from(allNumbers).sort((a, b) => a - b)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draws, selectedDrawId, drawsSortedAsc])

  const drawnNumbersSet = useMemo(() => new Set<number>(drawnNumbersSorted), [drawnNumbersSorted])

  // Verificar se um número foi sorteado usando Set (O(1))
  const isNumberDrawn = (number: number): boolean => {
    return drawnNumbersSet.has(number)
  }

  // Obter números acertados de uma participação (CUMULATIVO até draw selecionado)
  const getHitNumbersForParticipation = (participation: Participation): number[] => {
    const drawsToUse = selectedDrawId ? getDrawsUpTo(selectedDrawId) : draws
    return getAllHitNumbers(participation.numbers, drawsToUse)
  }

  // Maior pontuação CUMULATIVA (consistente com a tabela)
  const maxScoreToDisplay = useMemo(() => {
    if (participations.length === 0) return 0
    let max = 0
    for (const p of participations) {
      const s = selectedDrawId ? getScoreUpToDraw(p, selectedDrawId) : getTotalScore(p)
      if (s > max) max = s
    }
    return max
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participations, selectedDrawId, draws, drawsSortedAsc])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9]">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto"></div>
            <p className="mt-4 text-[#1F1F1F]/70">Carregando ranking...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !contest) {
    return (
      <div className="min-h-screen bg-[#F9F9F9]">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
          <div className="text-center">
            <div className="text-red-600 text-xl mb-2">⚠️ Erro</div>
            <p className="text-[#1F1F1F]/70 mb-4">{error || 'Concurso não encontrado'}</p>
            <Link to="/contests" className="text-[#1E7F43] hover:text-[#3CCB7F] underline font-semibold">
              Voltar para lista de concursos
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // MODIFIQUEI AQUI - Labels das categorias em PT-BR
  const categoryLabels = {
    TOP: {
      title: 'MAIOR PONTUAÇÃO',
      subtitle: `(${contest?.numbers_per_participation || 'N'} acertos)`,
    },
    SECOND: {
      title: 'SEGUNDA MAIOR',
      subtitle: `(${contest && contest.numbers_per_participation ? contest.numbers_per_participation - 1 : 'N-1'} acertos)`,
    },
    LOWEST: {
      title: 'MENOR PONTUAÇÃO',
      subtitle: '(menor pontuação positiva)',
    },
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {/* Cabeçalho */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link
              to={`/contests/${contest.id}`}
              className="text-[#1E7F43] hover:text-[#3CCB7F] font-semibold flex items-center gap-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Voltar para detalhes do concurso
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5]">
            <h1 className="text-3xl font-extrabold text-[#1F1F1F] mb-2">🏆 Ranking - {contest.name}</h1>

            {/* MODIFIQUEI AQUI - Exibir código do concurso */}
            {contest.contest_code && (
              <div className="mb-3">
                <span className="px-3 py-1 bg-[#1E7F43] text-white rounded-full text-xs sm:text-sm font-mono font-semibold">
                  Código do Concurso: {contest.contest_code}
                </span>
              </div>
            )}

            <p className="text-[#1F1F1F]/70 mb-4">{contest.description || 'Classificação dos participantes por pontuação'}</p>

            {/* Estatísticas do Ranking */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-gradient-to-br from-[#1E7F43] to-[#3CCB7F] rounded-xl p-4 text-white">
                <div className="text-sm font-semibold opacity-90 mb-1">Total de Participantes</div>
                <div className="text-3xl font-bold">{participations.length}</div>
              </div>
              <div className="bg-gradient-to-br from-[#F4C430] to-[#FFD700] rounded-xl p-4 text-[#1F1F1F]">
                <div className="text-sm font-semibold opacity-90 mb-1">Sorteios Realizados</div>
                <div className="text-3xl font-bold">{draws.length}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                <div className="text-sm font-semibold opacity-90 mb-1">Maior Pontuação</div>
                <div className="text-3xl font-bold">{maxScoreToDisplay}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Resultado do Sorteio */}
        {draws.length > 0 && selectedDrawId && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-[#E5E5E5]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1F1F1F]">🎯 Resultado do Sorteio</h2>
              {draws.length > 1 && (
                <select
                  value={selectedDrawId}
                  onChange={(e) => setSelectedDrawId(e.target.value)}
                  className="px-4 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E7F43]"
                >
                  {draws.map((draw) => (
                    <option key={draw.id} value={draw.id}>
                      {formatDateTime(draw.draw_date)} {draw.code ? `(${draw.code})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {payoutSummary && payoutSummary.maxScore === 0 ? (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 text-center">
                <div className="text-4xl mb-3">😔</div>
                <p className="text-lg font-semibold text-yellow-900">Não houve ganhadores neste sorteio.</p>
              </div>
            ) : payoutSummary ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#1F1F1F] mb-3">Categorias Premiadas</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* MAIOR PONTUAÇÃO (TOP) */}
                  <div
                    className={`rounded-xl p-4 border-2 ${
                      payoutSummary.categories.TOP
                        ? 'bg-gradient-to-br from-[#F4C430] to-[#FFD700] border-[#F4C430]'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="text-sm font-semibold mb-2">
                      {categoryLabels.TOP.title} {categoryLabels.TOP.subtitle}
                    </div>
                    {payoutSummary.categories.TOP ? (
                      <>
                        <div className="text-2xl font-bold mb-1">{payoutSummary.categories.TOP.score} acertos</div>
                        <div className="text-sm mb-2">{payoutSummary.categories.TOP.winnersCount} ganhador(es)</div>
                        <div className="text-lg font-bold">R$ {payoutSummary.categories.TOP.amountPerWinner.toFixed(2).replace('.', ',')}</div>
                        <div className="text-xs opacity-75 mt-1">por ganhador</div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-600">Sem ganhadores</div>
                    )}
                  </div>

                  {/* SEGUNDA MAIOR (SECOND) */}
                  <div
                    className={`rounded-xl p-4 border-2 ${
                      payoutSummary.categories.SECOND
                        ? 'bg-gradient-to-br from-gray-200 to-gray-300 border-gray-400'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="text-sm font-semibold mb-2">
                      {categoryLabels.SECOND.title} {categoryLabels.SECOND.subtitle}
                    </div>
                    {payoutSummary.categories.SECOND ? (
                      <>
                        <div className="text-2xl font-bold mb-1">{payoutSummary.categories.SECOND.score} acertos</div>
                        <div className="text-sm mb-2">{payoutSummary.categories.SECOND.winnersCount} ganhador(es)</div>
                        <div className="text-lg font-bold">R$ {payoutSummary.categories.SECOND.amountPerWinner.toFixed(2).replace('.', ',')}</div>
                        <div className="text-xs opacity-75 mt-1">por ganhador</div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-600">Sem ganhadores</div>
                    )}
                  </div>

                  {/* MENOR PONTUAÇÃO (LOWEST) */}
                  <div
                    className={`rounded-xl p-4 border-2 ${
                      payoutSummary.categories.LOWEST
                        ? 'bg-gradient-to-br from-orange-200 to-orange-300 border-orange-400'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="text-sm font-semibold mb-2">
                      {categoryLabels.LOWEST.title} {categoryLabels.LOWEST.subtitle}
                    </div>
                    {payoutSummary.categories.LOWEST ? (
                      <>
                        <div className="text-2xl font-bold mb-1">{payoutSummary.categories.LOWEST.score} acertos</div>
                        <div className="text-sm mb-2">{payoutSummary.categories.LOWEST.winnersCount} ganhador(es)</div>
                        <div className="text-lg font-bold">R$ {payoutSummary.categories.LOWEST.amountPerWinner.toFixed(2).replace('.', ',')}</div>
                        <div className="text-xs opacity-75 mt-1">por ganhador</div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-600">Sem ganhadores</div>
                    )}
                  </div>
                </div>

                {/* MODIFIQUEI AQUI - Mensagem explicativa da regra do dono (evita dúvida “acertei 2/4 e não ganhei”) */}
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Como funciona a premiação:</strong> este concurso premia apenas as categorias configuradas
                    (maior pontuação, segunda maior e menor pontuação positiva). Pontuações intermediárias podem não receber prêmio.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-[#1F1F1F]/60">Carregando resultado do sorteio...</div>
            )}
          </div>
        )}

        {/* Informações sobre sorteios */}
        {draws.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-[#E5E5E5]">
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">📊 Últimos Sorteios</h2>
            <div className="space-y-3">
              {draws.slice(0, 3).map((draw) => (
                <div key={draw.id} className="flex items-center justify-between p-3 bg-[#F9F9F9] rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#1E7F43] text-white rounded-full w-10 h-10 flex items-center justify-center font-bold">
                      {draw.code?.split('-')[2]?.substring(0, 2) || 'DRW'}
                    </div>
                    <div>
                      <div className="font-semibold text-[#1F1F1F]">{formatDateTime(draw.draw_date)}</div>
                      <div className="text-sm text-[#1F1F1F]/70">{draw.numbers.length} números sorteados</div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {/* MODIFIQUEI AQUI - não mutar draw.numbers com sort() */}
                    {[...draw.numbers].sort((a, b) => a - b).map((num) => (
                      <span key={num} className="bg-[#F4C430] text-[#1F1F1F] font-bold px-3 py-1 rounded-lg text-sm">
                        {num.toString().padStart(2, '0')}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ranking */}
        {participations.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-[#E5E5E5]">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-[#1F1F1F] mb-2">Nenhum participante ainda</h3>
            <p className="text-[#1F1F1F]/70 mb-6">Ainda não há participações ativas neste concurso.</p>

            {/* MODIFIQUEI AQUI - Usar getContestState para verificar se aceita participações */}
            {getContestState(contest, draws.length > 0).acceptsParticipations ? (
              <Link
                to={`/contests/${contest.id}/join`}
                className="inline-block px-6 py-3 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white rounded-xl font-bold hover:from-[#3CCB7F] hover:to-[#1E7F43] transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Participar Agora
              </Link>
            ) : (
              <div className="inline-block px-6 py-3 bg-[#E5E5E5] text-[#1F1F1F]/60 rounded-xl font-bold cursor-not-allowed">
                {getContestState(contest, draws.length > 0).label}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-[#E5E5E5] overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F]">
              <h2 className="text-2xl font-bold text-white">Classificação</h2>
            </div>

            {/* MODIFIQUEI AQUI - Mensagem quando não há ganhadores premiados (baseado em payouts, não score) */}
            {payoutSummary && selectedDrawId &&
              (() => {
                const hasPremiados = Object.values(payouts).some((p: any) => p.amount_won > 0)
                if (!hasPremiados && payoutSummary.maxScore === 0) {
                  return null
                } else if (!hasPremiados) {
                  return (
                    <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-200">
                      <p className="text-sm text-yellow-800">
                        <strong>Nenhum participante foi premiado neste sorteio.</strong> O ranking abaixo mostra a classificação dos participantes.
                      </p>
                    </div>
                  )
                }
                return null
              })()}

            {/* MODIFIQUEI AQUI - Filtros de categoria */}
            {selectedDrawId && (
              <div className="px-6 py-4 bg-[#F9F9F9] border-b border-[#E5E5E5]">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      filter === 'all'
                        ? 'bg-[#1E7F43] text-white'
                        : 'bg-white text-[#1F1F1F] hover:bg-[#E5E5E5]'
                    }`}
                  >
                    🔘 Todos
                  </button>
                  <button
                    onClick={() => setFilter('premiados')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      filter === 'premiados'
                        ? 'bg-[#1E7F43] text-white'
                        : 'bg-white text-[#1F1F1F] hover:bg-[#E5E5E5]'
                    }`}
                  >
                    🏆 Somente Premiados
                  </button>
                  <button
                    onClick={() => setFilter('TOP')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      filter === 'TOP'
                        ? 'bg-[#1E7F43] text-white'
                        : 'bg-white text-[#1F1F1F] hover:bg-[#E5E5E5]'
                    }`}
                  >
                    🥇 TOP
                  </button>
                  <button
                    onClick={() => setFilter('SECOND')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      filter === 'SECOND'
                        ? 'bg-[#1E7F43] text-white'
                        : 'bg-white text-[#1F1F1F] hover:bg-[#E5E5E5]'
                    }`}
                  >
                    🥈 SECOND
                  </button>
                  <button
                    onClick={() => setFilter('LOWEST')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      filter === 'LOWEST'
                        ? 'bg-[#1E7F43] text-white'
                        : 'bg-white text-[#1F1F1F] hover:bg-[#E5E5E5]'
                    }`}
                  >
                    🥉 LOWEST
                  </button>
                  <button
                    onClick={() => setFilter('nao_premiados')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      filter === 'nao_premiados'
                        ? 'bg-[#1E7F43] text-white'
                        : 'bg-white text-[#1F1F1F] hover:bg-[#E5E5E5]'
                    }`}
                  >
                    ❌ Não premiados
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                  <tr>
                    <th className="text-left py-4 px-6 font-semibold text-[#1F1F1F]">Posição</th>
                    <th className="text-left py-4 px-6 font-semibold text-[#1F1F1F]">Participante</th>
                    <th className="text-left py-4 px-6 font-semibold text-[#1F1F1F]">Números</th>
                    <th className="text-center py-4 px-6 font-semibold text-[#1F1F1F]">Pontuação</th>
                    <th className="text-left py-4 px-6 font-semibold text-[#1F1F1F]">Ticket</th>
                    <th className="text-center py-4 px-6 font-semibold text-[#1F1F1F]">Prêmio</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // MODIFIQUEI AQUI - Ordenar por pontuação e usar categorias de premiação
                    const sortedParticipations = [...participations].sort((a, b) => {
                      const scoreA = selectedDrawId ? getScoreUpToDraw(a, selectedDrawId) : getTotalScore(a)
                      const scoreB = selectedDrawId ? getScoreUpToDraw(b, selectedDrawId) : getTotalScore(b)
                      if (scoreB !== scoreA) return scoreB - scoreA
                      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    })

                    // MODIFIQUEI AQUI - Filtrar participações baseado no filtro selecionado
                    const filteredParticipations = sortedParticipations.filter((participation) => {
                      if (!selectedDrawId) return true
                      const payout = payouts[participation.id]
                      const { category } = getPayoutCategory(payout)

                      switch (filter) {
                        case 'all':
                          return true
                        case 'premiados':
                          return category !== 'NONE'
                        case 'TOP':
                          return category === 'TOP'
                        case 'SECOND':
                          return category === 'SECOND'
                        case 'LOWEST':
                          return category === 'LOWEST'
                        case 'nao_premiados':
                          return category === 'NONE'
                        default:
                          return true
                      }
                    })

                    return filteredParticipations.map((participation, index) => {
                      // MODIFIQUEI AQUI - Removido código duplicado antigo
                      const position = index + 1
                      const hitNumbers = getHitNumbersForParticipation(participation)
                      const displayScore = selectedDrawId ? getScoreUpToDraw(participation, selectedDrawId) : getTotalScore(participation)
                      const payout = payouts[participation.id]
                      const { medal } = getPayoutCategory(payout)
                      const hasMedal = medal !== undefined

                      // MODIFIQUEI AQUI - Para score 0, não mostrar ordinal “#3/#4...” (evita parecer pódio)
                      const positionLabel =
                        hasMedal ? medal : `#${position}`


                      return (
                        <tr
                          key={participation.id}
                          className={`border-b border-[#E5E5E5] transition-colors hover:bg-[#F9F9F9] ${
                            hasMedal ? 'bg-gradient-to-r from-yellow-50 to-yellow-100' : ''
                          }`}
                        >
                          {/* Posição */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <span className={`${hasMedal ? 'text-2xl' : 'text-xl'} font-bold text-[#1F1F1F]/60`}>
                                {positionLabel}
                              </span>
                            </div>
                          </td>

                          {/* Participante */}
                          <td className="py-4 px-6">
                            <div>
                              <div className="font-semibold text-[#1F1F1F]">{participation.user?.name || 'Usuário Anônimo'}</div>
                              {participation.user?.email && <div className="text-sm text-[#1F1F1F]/60">{participation.user.email}</div>}
                            </div>
                          </td>

                          {/* Números */}
                          <td className="py-4 px-6">
                            <div className="flex flex-wrap gap-2">
                              {[...participation.numbers].sort((a, b) => a - b).map((num) => {
                                const isHit = hitNumbers.includes(num)
                                const isDrawn = isNumberDrawn(num)

                                return (
                                  <span
                                    key={num}
                                    className={`font-bold px-3 py-1 rounded-lg text-sm transition-all ${
                                      isHit
                                        ? 'bg-[#1E7F43] text-white shadow-lg transform scale-110'
                                        : isDrawn
                                        ? 'bg-[#F4C430] text-[#1F1F1F]'
                                        : 'bg-[#E5E5E5] text-[#1F1F1F]'
                                    }`}
                                    title={isHit ? 'Número acertado!' : isDrawn ? 'Número sorteado' : ''}
                                  >
                                    {num.toString().padStart(2, '0')}
                                    {isHit && ' ✓'}
                                  </span>
                                )
                              })}
                            </div>
                          </td>

                          {/* Pontuação */}
                          <td className="py-4 px-6 text-center">
                            <span
                              className={`inline-block px-4 py-2 rounded-lg font-bold text-lg ${
                                displayScore > 0
                                  ? 'bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white'
                                  : 'bg-[#E5E5E5] text-[#1F1F1F]'
                              }`}
                            >
                              {displayScore}
                            </span>
                          </td>

                          {/* Ticket */}
                          <td className="py-4 px-6">
                            <span className="text-sm font-mono text-[#1F1F1F]/70">{participation.ticket_code || 'N/A'}</span>
                          </td>

                          {/* Prêmio */}
                          <td className="py-4 px-6 text-center">
                            {(() => {
                              if (draws.length === 0) {
                                return <span className="text-sm text-[#1F1F1F]/60">⏳ Aguardando sorteio</span>
                              }
                              if (!selectedDrawId) {
                                return <span className="text-sm text-[#1F1F1F]/40">—</span>
                              }
                              const payout = payouts[participation.id]
                              const payoutAmount = payout?.amount_won || 0
                              if (payoutAmount > 0) {
                                return (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="px-3 py-1 bg-gradient-to-r from-[#F4C430] to-[#FFD700] text-[#1F1F1F] rounded-lg font-bold text-sm">
                                      🏆 Premiado
                                    </span>
                                    <span className="text-lg font-extrabold text-[#1E7F43]">
                                      R$ {payoutAmount.toFixed(2).replace('.', ',')}
                                    </span>
                                  </div>
                                )
                              }
                              return <span className="text-sm text-[#1F1F1F]/60">❌ Não premiado</span>
                            })()}
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Informação sobre pontuação */}
        {draws.length === 0 && participations.length > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Aguardando sorteios</h3>
                <p className="text-sm text-blue-800">
                  O ranking será atualizado automaticamente após a realização dos sorteios. As pontuações são calculadas com base nos números acertados.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
