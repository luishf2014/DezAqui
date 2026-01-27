/**
 * Página de Ranking de um Concurso
 * FASE 2: Participações e Ranking
 * 
 * Exibe o ranking de participantes ordenado por pontuação
 */
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getContestById } from '../services/contestsService'
import { getContestRanking } from '../services/participationsService'
import { listDrawsByContestId } from '../services/drawsService'
import { Contest, Participation, Draw } from '../types'
import { getHitNumbers } from '../utils/rankingHelpers'
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar ranking')
      } finally {
        setLoading(false)
      }
    }

    loadRankingData()
  }, [id])

  // Obter todos os números sorteados (união de todos os sorteios)
  const getAllDrawnNumbers = (): number[] => {
    const allNumbers = new Set<number>()
    draws.forEach(draw => {
      draw.numbers.forEach(num => allNumbers.add(num))
    })
    return Array.from(allNumbers).sort((a, b) => a - b)
  }

  // Verificar se um número foi sorteado
  const isNumberDrawn = (number: number): boolean => {
    return getAllDrawnNumbers().includes(number)
  }

  // Obter números acertados de uma participação
  const getHitNumbersForParticipation = (participation: Participation): number[] => {
    if (draws.length === 0) return []
    // Usar o último sorteio para destacar números acertados
    const lastDraw = draws[0] // Já está ordenado por data (mais recente primeiro)
    return getHitNumbers(lastDraw.numbers, participation.numbers)
  }

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
            <Link
              to="/contests"
              className="text-[#1E7F43] hover:text-[#3CCB7F] underline font-semibold"
            >
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
            <h1 className="text-3xl font-extrabold text-[#1F1F1F] mb-2">
              🏆 Ranking - {contest.name}
            </h1>
            <p className="text-[#1F1F1F]/70 mb-4">
              {contest.description || 'Classificação dos participantes por pontuação'}
            </p>
            
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
                <div className="text-3xl font-bold">
                  {participations.length > 0 ? participations[0].current_score : 0}
                </div>
              </div>
            </div>
          </div>
        </div>

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
                      <div className="font-semibold text-[#1F1F1F]">
                        {formatDateTime(draw.draw_date)}
                      </div>
                      <div className="text-sm text-[#1F1F1F]/70">
                        {draw.numbers.length} números sorteados
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {draw.numbers.sort((a, b) => a - b).map((num) => (
                      <span
                        key={num}
                        className="bg-[#F4C430] text-[#1F1F1F] font-bold px-3 py-1 rounded-lg text-sm"
                      >
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
            <p className="text-[#1F1F1F]/70 mb-6">
              Ainda não há participações ativas neste concurso.
            </p>
            <Link
              to={`/contests/${contest.id}/join`}
              className="inline-block px-6 py-3 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white rounded-xl font-bold hover:from-[#3CCB7F] hover:to-[#1E7F43] transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Participar Agora
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-[#E5E5E5] overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F]">
              <h2 className="text-2xl font-bold text-white">Classificação</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                  <tr>
                    <th className="text-left py-4 px-6 font-semibold text-[#1F1F1F]">Posição</th>
                    <th className="text-left py-4 px-6 font-semibold text-[#1F1F1F]">Participante</th>
                    <th className="text-left py-4 px-6 font-semibold text-[#1F1F1F]">Números</th>
                    <th className="text-center py-4 px-6 font-semibold text-[#1F1F1F]">Pontuação</th>
                    <th className="text-left py-4 px-6 font-semibold text-[#1F1F1F]">Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {participations.map((participation, index) => {
                    const position = index + 1
                    const hitNumbers = getHitNumbersForParticipation(participation)
                    const isTopThree = position <= 3
                    
                    return (
                      <tr
                        key={participation.id}
                        className={`border-b border-[#E5E5E5] transition-colors hover:bg-[#F9F9F9] ${
                          isTopThree ? 'bg-gradient-to-r from-yellow-50 to-yellow-100' : ''
                        }`}
                      >
                        {/* Posição */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {isTopThree ? (
                              <span className="text-2xl">
                                {position === 1 ? '🥇' : position === 2 ? '🥈' : '🥉'}
                              </span>
                            ) : (
                              <span className="text-xl font-bold text-[#1F1F1F]/60">
                                #{position}
                              </span>
                            )}
                          </div>
                        </td>
                        
                        {/* Participante */}
                        <td className="py-4 px-6">
                          <div>
                            <div className="font-semibold text-[#1F1F1F]">
                              {participation.user?.name || 'Usuário Anônimo'}
                            </div>
                            {participation.user?.email && (
                              <div className="text-sm text-[#1F1F1F]/60">
                                {participation.user.email}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Números */}
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-2">
                            {participation.numbers.sort((a, b) => a - b).map((num) => {
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
                              participation.current_score > 0
                                ? 'bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white'
                                : 'bg-[#E5E5E5] text-[#1F1F1F]'
                            }`}
                          >
                            {participation.current_score}
                          </span>
                        </td>
                        
                        {/* Ticket */}
                        <td className="py-4 px-6">
                          <span className="text-sm font-mono text-[#1F1F1F]/70">
                            {participation.ticket_code || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
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
                  O ranking será atualizado automaticamente após a realização dos sorteios. 
                  As pontuações são calculadas com base nos números acertados.
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
