/**
 * Página de Rankings Gerais
 * FASE 2: Participações e Ranking
 * 
 * Exibe rankings de concursos, similar ao estilo de "Meus Tickets"
 * Admin: vê todos os concursos ativos
 * Usuário comum: vê apenas concursos onde está participando
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listActiveContests, getContestById } from '../services/contestsService'
import { getContestRanking, listMyParticipations } from '../services/participationsService'
import { listDrawsByContestId } from '../services/drawsService'
import { Contest, Participation, Draw } from '../types'
import { getHitNumbers } from '../utils/rankingHelpers'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/Header'
import Footer from '../components/Footer'

interface ParticipationWithUser extends Participation {
  user: { id: string; name: string; email: string } | null
}

export default function RankingsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [availableContests, setAvailableContests] = useState<Contest[]>([])
  const [selectedContestId, setSelectedContestId] = useState<string>('')
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null)
  const [ranking, setRanking] = useState<ParticipationWithUser[]>([])
  const [draws, setDraws] = useState<Draw[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRanking, setLoadingRanking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // MODIFIQUEI AQUI - Carregar concursos disponíveis baseado no tipo de usuário
  useEffect(() => {
    async function loadAvailableContests() {
      if (authLoading) return

      try {
        setLoading(true)
        setError(null)

        if (isAdmin) {
          // Admin: ver todos os concursos ativos
          const contests = await listActiveContests()
          setAvailableContests(contests)
        } else if (user) {
          // Usuário comum: ver apenas concursos onde está participando
          const myParticipations = await listMyParticipations()
          // Extrair IDs únicos de concursos
          const contestIds = [...new Set(myParticipations.map(p => p.contest_id).filter(Boolean))]
          
          // Buscar detalhes dos concursos
          const contests = await Promise.all(
            contestIds.map(async (contestId) => {
              try {
                return await getContestById(contestId)
              } catch (err) {
                console.error(`Erro ao buscar concurso ${contestId}:`, err)
                return null
              }
            })
          )
          
          setAvailableContests(contests.filter((c): c is Contest => c !== null))
        } else {
          // Não autenticado: redirecionar para login
          navigate('/login')
          return
        }
      } catch (err) {
        console.error('[RankingsPage] Erro ao carregar concursos:', err)
        setError(err instanceof Error ? err.message : 'Erro ao carregar concursos')
      } finally {
        setLoading(false)
      }
    }

    loadAvailableContests()
  }, [user, isAdmin, authLoading, navigate])

  // MODIFIQUEI AQUI - Carregar ranking quando um concurso for selecionado
  useEffect(() => {
    async function loadRanking() {
      if (!selectedContestId) {
        setRanking([])
        setDraws([])
        setSelectedContest(null)
        return
      }

      try {
        setLoadingRanking(true)
        setError(null)

        // Buscar detalhes do concurso selecionado
        const contest = await getContestById(selectedContestId)
        if (!contest) {
          setError('Concurso não encontrado')
          return
        }

        setSelectedContest(contest)

        // Buscar ranking e sorteios do concurso selecionado
        const [rankingData, drawsData] = await Promise.all([
          getContestRanking(selectedContestId),
          listDrawsByContestId(selectedContestId),
        ])

        setRanking(rankingData)
        setDraws(drawsData)
      } catch (err) {
        console.error('[RankingsPage] Erro ao carregar ranking:', err)
        setError(err instanceof Error ? err.message : 'Erro ao carregar ranking')
      } finally {
        setLoadingRanking(false)
      }
    }

    loadRanking()
  }, [selectedContestId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Obter números acertados de uma participação
  const getHitNumbersForParticipation = (participation: Participation, draws: Draw[]): number[] => {
    if (draws.length === 0) return []
    // Usar o último sorteio para destacar números acertados
    const lastDraw = draws[0] // Já está ordenado por data (mais recente primeiro)
    return getHitNumbers(lastDraw.numbers, participation.numbers)
  }

  // Verificar se um número foi sorteado
  const isNumberDrawn = (number: number, draws: Draw[]): boolean => {
    const allNumbers = new Set<number>()
    draws.forEach(draw => {
      draw.numbers.forEach(num => allNumbers.add(num))
    })
    return allNumbers.has(number)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto"></div>
            <p className="mt-4 text-[#1F1F1F]/70">Carregando...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1 px-4">
          <div className="text-center">
            <div className="text-red-600 text-xl mb-2">⚠️ Acesso Restrito</div>
            <p className="text-[#1F1F1F]/70 mb-4">Você precisa estar autenticado para ver os rankings.</p>
            <Link
              to="/login"
              className="mt-4 inline-block px-6 py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-all shadow-lg"
            >
              Fazer Login
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (error && availableContests.length === 0) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1 px-4">
          <div className="text-center">
            <div className="text-red-600 text-xl mb-2">⚠️ Erro</div>
            <p className="text-[#1F1F1F]/70">{error}</p>
            <Link
              to="/contests"
              className="mt-4 inline-block text-[#1E7F43] hover:text-[#3CCB7F] underline font-semibold"
            >
              Voltar para concursos
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />

      {/* Header da Página com Gradiente */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden mx-2 sm:mx-4 mt-4 sm:mt-6 mb-6 sm:mb-8 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F4C430] via-[#F4C430] to-[#FFD700] opacity-95"></div>
        <div className="relative bg-white/5 backdrop-blur-sm p-4 sm:p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 flex-wrap">
                <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <span className="px-3 sm:px-4 py-1 bg-white/30 text-[#1F1F1F] rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap">
                  ● {availableContests.length} {availableContests.length === 1 ? 'Concurso' : 'Concursos'} {isAdmin ? 'Disponíveis' : 'Participando'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#1F1F1F] mb-3">
                🏆 Rankings
              </h1>
              <p className="text-[#1F1F1F]/90 text-sm sm:text-base md:text-lg max-w-2xl">
                {isAdmin 
                  ? 'Visualize os rankings de todos os concursos ativos e veja quem está na liderança'
                  : 'Visualize o ranking dos concursos em que você está participando'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="container mx-auto px-2 sm:px-4 pb-6 sm:pb-8 flex-1 max-w-7xl">
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* MODIFIQUEI AQUI - Seletor de Concurso */}
        <div className="mb-6 sm:mb-8">
          <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-lg">
            <label htmlFor="contest-select" className="block text-sm sm:text-base font-semibold text-[#1F1F1F] mb-3">
              Selecione o Concurso para ver o Ranking:
            </label>
            <select
              id="contest-select"
              value={selectedContestId}
              onChange={(e) => setSelectedContestId(e.target.value)}
              className="w-full px-4 py-3 border-2 border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent text-sm sm:text-base font-semibold bg-white"
            >
              <option value="">-- Selecione um concurso --</option>
              {availableContests.map((contest) => (
                <option key={contest.id} value={contest.id}>
                  {contest.name} {contest.status === 'active' ? '(Ativo)' : ''}
                </option>
              ))}
            </select>
            {availableContests.length === 0 && (
              <p className="mt-3 text-sm text-[#1F1F1F]/60">
                {isAdmin 
                  ? 'Nenhum concurso ativo no momento.'
                  : 'Você ainda não está participando de nenhum concurso.'}
              </p>
            )}
          </div>
        </div>

        {/* MODIFIQUEI AQUI - Ranking do Concurso Selecionado */}
        {!selectedContestId ? (
          <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-8 sm:p-12 text-center shadow-xl">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-[#F9F9F9] rounded-full mb-3 sm:mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8 text-[#E5E5E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <p className="text-[#1F1F1F]/70 text-base sm:text-lg mb-2 px-4">
              Selecione um concurso acima para visualizar o ranking.
            </p>
          </div>
        ) : loadingRanking ? (
          <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-8 sm:p-12 text-center shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto"></div>
            <p className="mt-4 text-[#1F1F1F]/70">Carregando ranking...</p>
          </div>
        ) : selectedContest ? (
          <div className="space-y-4 sm:space-y-6">
            <div
              className="rounded-2xl sm:rounded-3xl border-2 border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-xl hover:shadow-2xl hover:border-[#F4C430] transition-all"
            >
              {/* Header do Concurso */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 sm:mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 flex-wrap">
                    <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                      selectedContest.status === 'active' 
                        ? 'bg-[#1E7F43]/20 text-[#1E7F43]' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      ● {selectedContest.status === 'active' ? 'Concurso Ativo' : 'Concurso Encerrado'}
                    </span>
                    <span className="px-2 sm:px-3 py-1 bg-[#F4C430]/20 text-[#1F1F1F] rounded-full text-xs font-semibold whitespace-nowrap">
                      {ranking.length} {ranking.length === 1 ? 'Participante' : 'Participantes'}
                    </span>
                    {draws.length > 0 && (
                      <span className="px-2 sm:px-3 py-1 bg-blue-500/20 text-blue-700 rounded-full text-xs font-semibold whitespace-nowrap">
                        {draws.length} {draws.length === 1 ? 'Sorteio' : 'Sorteios'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#1F1F1F] mb-2 break-words">
                    {selectedContest.name}
                  </h3>
                  {selectedContest.description && (
                    <p className="text-[#1F1F1F]/70 text-xs sm:text-sm line-clamp-2 mb-2">
                      {selectedContest.description}
                    </p>
                  )}
                  <p className="text-[#1F1F1F]/50 text-xs sm:text-sm">
                    Encerra em {formatDate(selectedContest.end_date)}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    to={`/contests/${selectedContest.id}/ranking`}
                    className="px-4 py-2 bg-[#F4C430] text-[#1F1F1F] rounded-lg font-semibold hover:bg-[#FFD700] transition-all text-sm sm:text-base whitespace-nowrap text-center"
                  >
                    Ver Ranking Completo
                  </Link>
                  <Link
                    to={`/contests/${selectedContest.id}`}
                    className="px-4 py-2 bg-[#1E7F43] text-white rounded-lg font-semibold hover:bg-[#3CCB7F] transition-all text-sm sm:text-base whitespace-nowrap text-center"
                  >
                    Ver Concurso
                  </Link>
                </div>
              </div>

              {/* Top 3 Podium */}
              {ranking.length > 0 && (() => {
                const topThree = ranking.slice(0, 3)
                return topThree.length > 0 && (
                  <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-gradient-to-br from-[#F9F9F9] to-white p-4 sm:p-6 mb-4">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                      <div className="p-1.5 sm:p-2 bg-[#F4C430]/10 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <h4 className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">
                        Top 3
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      {/* 2º Lugar */}
                      {topThree[1] && (
                        <div className="order-2 sm:order-1 rounded-lg sm:rounded-xl border-2 border-[#E5E5E5] bg-gradient-to-br from-gray-50 to-white p-3 sm:p-4 text-center">
                          <div className="text-2xl sm:text-3xl mb-2">🥈</div>
                          <div className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 mb-1">2º Lugar</div>
                          <div className="text-sm sm:text-base font-bold text-[#1F1F1F] mb-2 truncate">
                            {topThree[1].user?.name || 'Anônimo'}
                          </div>
                          <div className="text-lg sm:text-xl font-extrabold text-[#1F1F1F]">
                            {topThree[1].current_score} pts
                          </div>
                        </div>
                      )}

                      {/* 1º Lugar */}
                      {topThree[0] && (
                        <div className="order-1 sm:order-2 rounded-lg sm:rounded-xl border-2 border-[#F4C430] bg-gradient-to-br from-[#F4C430]/20 to-[#FFD700]/20 p-3 sm:p-4 text-center transform sm:-translate-y-2">
                          <div className="text-3xl sm:text-4xl mb-2">🥇</div>
                          <div className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 mb-1">1º Lugar</div>
                          <div className="text-base sm:text-lg font-bold text-[#1F1F1F] mb-2 truncate">
                            {topThree[0].user?.name || 'Anônimo'}
                          </div>
                          <div className="text-xl sm:text-2xl font-extrabold text-[#1F1F1F]">
                            {topThree[0].current_score} pts
                          </div>
                        </div>
                      )}

                      {/* 3º Lugar */}
                      {topThree[2] && (
                        <div className="order-3 rounded-lg sm:rounded-xl border-2 border-[#E5E5E5] bg-gradient-to-br from-orange-50 to-white p-3 sm:p-4 text-center">
                          <div className="text-2xl sm:text-3xl mb-2">🥉</div>
                          <div className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 mb-1">3º Lugar</div>
                          <div className="text-sm sm:text-base font-bold text-[#1F1F1F] mb-2 truncate">
                            {topThree[2].user?.name || 'Anônimo'}
                          </div>
                          <div className="text-lg sm:text-xl font-extrabold text-[#1F1F1F]">
                            {topThree[2].current_score} pts
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Lista de Participantes (Top 10) */}
              {ranking.length > 0 && (
                <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-[#F9F9F9] p-4 sm:p-6">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="p-1.5 sm:p-2 bg-[#1E7F43]/10 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h4 className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">
                      Classificação Completa
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {ranking.slice(0, 10).map((participation, index) => {
                      const position = index + 1
                      const hitNumbers = getHitNumbersForParticipation(participation, draws)
                      const isTopThree = position <= 3

                      return (
                        <div
                          key={participation.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            isTopThree
                              ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-[#F4C430]'
                              : 'bg-white border-[#E5E5E5] hover:border-[#1E7F43]'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex-shrink-0">
                              {isTopThree ? (
                                <span className="text-xl sm:text-2xl">
                                  {position === 1 ? '🥇' : position === 2 ? '🥈' : '🥉'}
                                </span>
                              ) : (
                                <span className="text-sm sm:text-base font-bold text-[#1F1F1F]/60">
                                  #{position}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-[#1F1F1F] truncate">
                                {participation.user?.name || 'Usuário Anônimo'}
                              </div>
                              {participation.user?.email && (
                                <div className="text-xs text-[#1F1F1F]/60 truncate">
                                  {participation.user.email}
                                </div>
                              )}
                            </div>
                            {hitNumbers.length > 0 && (
                              <div className="hidden sm:flex gap-1 flex-wrap">
                                {hitNumbers.slice(0, 3).map((num) => (
                                  <span
                                    key={num}
                                    className="px-2 py-1 bg-[#1E7F43] text-white rounded text-xs font-bold"
                                  >
                                    {num.toString().padStart(2, '0')}✓
                                  </span>
                                ))}
                                {hitNumbers.length > 3 && (
                                  <span className="px-2 py-1 bg-[#1E7F43]/50 text-white rounded text-xs font-bold">
                                    +{hitNumbers.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span
                              className={`px-3 py-1 rounded-lg font-bold text-sm sm:text-base ${
                                participation.current_score > 0
                                  ? 'bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white'
                                  : 'bg-[#E5E5E5] text-[#1F1F1F]'
                              }`}
                            >
                              {participation.current_score}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {ranking.length > 10 && (
                      <div className="text-center pt-2">
                        <Link
                          to={`/contests/${selectedContest.id}/ranking`}
                          className="text-sm text-[#1E7F43] hover:text-[#3CCB7F] font-semibold underline"
                        >
                          Ver todos os {ranking.length} participantes →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mensagem quando não há participantes */}
              {ranking.length === 0 && (
                <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-[#F9F9F9] p-6 sm:p-8 text-center">
                  <div className="text-4xl mb-2">📊</div>
                  <p className="text-[#1F1F1F]/70 text-sm sm:text-base">
                    Ainda não há participantes neste concurso.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      <Footer />
    </div>
  )
}
