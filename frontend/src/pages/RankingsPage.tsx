/**
 * Página de Rankings Gerais
 * FASE 2: Participações e Ranking
 *
 * Exibe rankings de concursos, similar ao estilo de "Meus Tickets"
 * Admin: vê todos os concursos ativos
 * Usuário comum: vê apenas concursos onde está participando
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listActiveContests, listFinishedContests, getContestById } from '../services/contestsService'
import { getContestRanking, listMyParticipations } from '../services/participationsService'
import { listDrawsByContestId } from '../services/drawsService'
import { getDrawPayoutSummary, getPayoutsByDraw } from '../services/payoutsService'
import { Contest, Participation, Draw } from '../types'
import { calculateRanking, createRankingMap, RankingEntry } from '../utils/rankingCalculator'
import { useAuth } from '../contexts/AuthContext'
import ContestStatusBadge from '../components/ContestStatusBadge'
import Header from '../components/Header'
import Footer from '../components/Footer'

interface ParticipationWithUser extends Participation {
  user: { id: string; name: string; email: string } | null
}

type TabType = 'active' | 'history'

export default function RankingsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const [activeContests, setActiveContests] = useState<Contest[]>([])
  const [finishedContests, setFinishedContests] = useState<Contest[]>([])
  const [availableContests, setAvailableContests] = useState<Contest[]>([])
  const [selectedContestId, setSelectedContestId] = useState<string>('')
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null)
  const [ranking, setRanking] = useState<ParticipationWithUser[]>([])
  const [draws, setDraws] = useState<Draw[]>([])
  const [payouts, setPayouts] = useState<Record<string, any>>({}) // participationId -> DrawPayout
  const [payoutSummary, setPayoutSummary] = useState<any>(null)
  // MODIFIQUEI AQUI - permitir selecionar o sorteio do concurso
  const [selectedDrawId, setSelectedDrawId] = useState<string>('')

  const [loading, setLoading] = useState(true)
  const [loadingRanking, setLoadingRanking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // MODIFIQUEI AQUI - Carregar concursos ativos e finalizados baseado no tipo de usuário
  useEffect(() => {
    async function loadAvailableContests() {
      if (authLoading) return

      try {
        setLoading(true)
        setError(null)

        if (isAdmin) {
          // Admin: ver todos os concursos ativos e finalizados
          const [activeData, finishedData] = await Promise.all([listActiveContests(), listFinishedContests()])
          setActiveContests(activeData)
          setFinishedContests(finishedData)
        } else if (user) {
          // Usuário comum: ver apenas concursos onde está participando (ativos + finalizados)
          const myParticipations = await listMyParticipations()
          // Extrair IDs únicos de concursos
          const contestIds = [...new Set(myParticipations.map((p) => p.contest_id).filter(Boolean))]

          // Buscar detalhes dos concursos
          const allContests = await Promise.all(
            contestIds.map(async (contestId) => {
              try {
                return await getContestById(contestId)
              } catch (err) {
                console.error(`Erro ao buscar concurso ${contestId}:`, err)
                return null
              }
            })
          )

          const validContests = allContests.filter((c): c is Contest => c !== null)
          // Separar em ativos e finalizados
          const active = validContests.filter((c) => c.status === 'active')
          const finished = validContests.filter((c) => c.status === 'finished')

          setActiveContests(active)
          setFinishedContests(finished)
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

  // MODIFIQUEI AQUI - Atualizar lista de concursos disponíveis baseado na aba selecionada
  useEffect(() => {
    const currentContests = activeTab === 'active' ? activeContests : finishedContests
    setAvailableContests(currentContests)

    // Limpar seleção se o concurso selecionado não estiver na lista atual
    if (selectedContestId && !currentContests.find((c) => c.id === selectedContestId)) {
      setSelectedContestId('')
      setSelectedContest(null)
      setRanking([])
      setDraws([])
      setPayouts({})
      setPayoutSummary(null)
      // MODIFIQUEI AQUI
      setSelectedDrawId('')
    }
  }, [activeTab, activeContests, finishedContests, selectedContestId])

  // MODIFIQUEI AQUI - Carregar ranking quando um concurso for selecionado
  useEffect(() => {
    async function loadRanking() {
      if (!selectedContestId) {
        setRanking([])
        setDraws([])
        setPayouts({})
        setPayoutSummary(null)
        setSelectedContest(null)
        // MODIFIQUEI AQUI
        setSelectedDrawId('')
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

        // Buscar ranking, sorteios e payouts do concurso selecionado
        const [rankingData, drawsData] = await Promise.all([getContestRanking(selectedContestId), listDrawsByContestId(selectedContestId)])

        setRanking(rankingData)
        setDraws(drawsData)

        // MODIFIQUEI AQUI - Buscar payouts do sorteio selecionado (default: último)
        if (drawsData.length > 0) {
          // MODIFIQUEI AQUI - não forçar setState se já existe um selecionado válido
          const defaultDrawId = selectedDrawId || drawsData[0].id // drawsData[0] é o mais recente
          if (!selectedDrawId) setSelectedDrawId(defaultDrawId)

          try {
            const [summary, drawPayouts] = await Promise.all([getDrawPayoutSummary(defaultDrawId), getPayoutsByDraw(defaultDrawId)])

            setPayoutSummary(summary)

            // Criar mapa de participação -> payout
            const payoutsMap: Record<string, any> = {}
            drawPayouts.forEach((p) => {
              payoutsMap[p.participation_id] = p
            })
            setPayouts(payoutsMap)
          } catch (err) {
            console.error('[RankingsPage] Erro ao carregar payouts:', err)
            setPayouts({})
            setPayoutSummary(null)
          }
        } else {
          setSelectedDrawId('')
          setPayouts({})
          setPayoutSummary(null)
        }
      } catch (err) {
        console.error('[RankingsPage] Erro ao carregar ranking:', err)
        setError(err instanceof Error ? err.message : 'Erro ao carregar ranking')
      } finally {
        setLoadingRanking(false)
      }
    }

    loadRanking()
  }, [selectedContestId, selectedDrawId]) // MODIFIQUEI AQUI - inclui selectedDrawId para recarregar payouts ao trocar sorteio

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // FONTE ÚNICA DE VERDADE: Calcula ranking completo usando calculateRanking
  const rankingResult = useMemo(() => {
    if (!selectedContest || ranking.length === 0) {
      return {
        entries: [],
        summary: {
          topWinnersCount: 0,
          secondWinnersCount: 0,
          lowestWinnersCount: 0,
          maxScore: 0,
          lowestWinningScore: null,
          hasAnyWinner: false,
        },
      }
    }

    // Calcular total arrecadado
    const totalCollected = ranking.length * (selectedContest.ticket_price || 0)

    return calculateRanking({
      contest: selectedContest,
      participations: ranking,
      draws,
      selectedDrawId: selectedDrawId || undefined,
      totalCollected,
    })
  }, [selectedContest, ranking, draws, selectedDrawId])

  // Map para lookup rápido por participationId
  const rankingMap = useMemo(() => {
    return createRankingMap(rankingResult.entries)
  }, [rankingResult.entries])

  // Objeto de compatibilidade para Top 3 cards (mantém estrutura antiga para UI)
  const drawWinnersByScore = useMemo(() => {
    const N = Number(selectedContest?.numbers_per_participation || 0)
    const { summary } = rankingResult

    // Criar Sets de IDs para cada categoria
    const topWinnerIds = new Set(
      rankingResult.entries.filter((e) => e.category === 'TOP').map((e) => e.participationId)
    )
    const secondWinnerIds = new Set(
      rankingResult.entries.filter((e) => e.category === 'SECOND').map((e) => e.participationId)
    )
    const lowestWinnerIds = new Set(
      rankingResult.entries.filter((e) => e.category === 'LOWEST').map((e) => e.participationId)
    )

    return {
      TOP: { score: N, winnersCount: summary.topWinnersCount, winnerIds: topWinnerIds },
      SECOND: { score: N - 1, winnersCount: summary.secondWinnersCount, winnerIds: secondWinnerIds },
      LOWEST: { score: summary.lowestWinningScore, winnersCount: summary.lowestWinnersCount, winnerIds: lowestWinnerIds },
      hasAnyWinner: summary.hasAnyWinner,
    }
  }, [selectedContest, rankingResult])

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
            <Link to="/contests" className="mt-4 inline-block text-[#1E7F43] hover:text-[#3CCB7F] underline font-semibold">
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 sm:h-6 sm:w-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                    />
                  </svg>
                </div>
                <span className="px-3 sm:px-4 py-1 bg-white/30 text-[#1F1F1F] rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap">
                  ● {availableContests.length} {availableContests.length === 1 ? 'Concurso' : 'Concursos'}{' '}
                  {isAdmin ? 'Disponíveis' : 'Participando'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#1F1F1F] mb-3">🏆 Rankings</h1>
              <p className="text-[#1F1F1F]/90 text-sm sm:text-base md:text-lg max-w-2xl">
                {isAdmin
                  ? 'Visualize os rankings de todos os concursos ativos e veja quem está na liderança'
                  : 'Visualize o ranking dos concursos em que você está participando'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MODIFIQUEI AQUI - Abas para alternar entre Ativos e Histórico */}
      <div className="container mx-auto px-2 sm:px-4 mb-6 max-w-7xl">
        <div className="flex gap-2 bg-white rounded-xl p-1 shadow-lg border border-[#E5E5E5] max-w-md">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'active' ? 'bg-[#1E7F43] text-white shadow-md' : 'text-[#1F1F1F]/70 hover:text-[#1F1F1F]'
            }`}
          >
            Ativos ({activeContests.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'history' ? 'bg-[#1E7F43] text-white shadow-md' : 'text-[#1F1F1F]/70 hover:text-[#1F1F1F]'
            }`}
          >
            Histórico ({finishedContests.length})
          </button>
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
              onChange={(e) => {
                setSelectedContestId(e.target.value)
                // MODIFIQUEI AQUI - resetar sorteio ao trocar concurso
                setSelectedDrawId('')
              }}
              className="w-full px-4 py-3 border-2 border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent text-sm sm:text-base font-semibold bg-white"
            >
              <option value="">-- Selecione um concurso --</option>
              {availableContests.map((contest) => (
                <option key={contest.id} value={contest.id}>
                  {contest.name}{' '}
                  {contest.status === 'active' ? '(Ativo)' : contest.status === 'finished' ? '(Finalizado)' : ''}
                </option>
              ))}
            </select>
            {availableContests.length === 0 && (
              <p className="mt-3 text-sm text-[#1F1F1F]/60">
                {activeTab === 'active'
                  ? isAdmin
                    ? 'Nenhum concurso ativo no momento.'
                    : 'Você ainda não está participando de nenhum concurso ativo.'
                  : isAdmin
                  ? 'Nenhum concurso finalizado ainda.'
                  : 'Você ainda não participou de nenhum concurso finalizado.'}
              </p>
            )}
          </div>
        </div>

        {/* MODIFIQUEI AQUI - Ranking do Concurso Selecionado */}
        {!selectedContestId ? (
          <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-8 sm:p-12 text-center shadow-xl">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-[#F9F9F9] rounded-full mb-3 sm:mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 sm:h-8 sm:w-8 text-[#E5E5E5]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
            </div>
            <p className="text-[#1F1F1F]/70 text-base sm:text-lg mb-2 px-4">Selecione um concurso acima para visualizar o ranking.</p>
          </div>
        ) : loadingRanking ? (
          <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-8 sm:p-12 text-center shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto"></div>
            <p className="mt-4 text-[#1F1F1F]/70">Carregando ranking...</p>
          </div>
        ) : selectedContest ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="rounded-2xl sm:rounded-3xl border-2 border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-xl hover:shadow-2xl hover:border-[#F4C430] transition-all">
              {/* Header do Concurso */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 sm:mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 flex-wrap">
                    <ContestStatusBadge contest={selectedContest} hasDraws={draws.length > 0} variant="card" />
                    <span className="px-2 sm:px-3 py-1 bg-[#F4C430]/20 text-[#1F1F1F] rounded-full text-xs font-semibold whitespace-nowrap">
                      {ranking.length} {ranking.length === 1 ? 'Participante' : 'Participantes'}
                    </span>
                    {draws.length > 0 && (
                      <span className="px-2 sm:px-3 py-1 bg-blue-500/20 text-blue-700 rounded-full text-xs font-semibold whitespace-nowrap">
                        {draws.length} {draws.length === 1 ? 'Sorteio' : 'Sorteios'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#1F1F1F] mb-2 break-words">{selectedContest.name}</h3>
                  {/* MODIFIQUEI AQUI - Exibir código do concurso */}
                  {selectedContest.contest_code && (
                    <div className="mb-2">
                      <span className="px-2 py-1 bg-[#1E7F43] text-white rounded-full text-xs font-mono font-semibold">
                        Código do Concurso: {selectedContest.contest_code}
                      </span>
                    </div>
                  )}
                  {selectedContest.description && (
                    <p className="text-[#1F1F1F]/70 text-xs sm:text-sm line-clamp-2 mb-2">{selectedContest.description}</p>
                  )}
                  <p className="text-[#1F1F1F]/50 text-xs sm:text-sm">
                    {selectedContest.status === 'finished'
                      ? `Finalizado em ${formatDate(selectedContest.end_date)}`
                      : `Encerra em ${formatDate(selectedContest.end_date)}`}
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

              {/* MODIFIQUEI AQUI - Seletor de Sorteio */}
              {draws.length > 0 && (
                <div className="mb-4">
                  <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                    <label className="block text-sm font-semibold text-[#1F1F1F] mb-2">Selecione o Sorteio:</label>
                    <select
                      value={selectedDrawId}
                      onChange={(e) => setSelectedDrawId(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent text-sm font-semibold bg-white"
                    >
                      <option value="">Todos os sorteios (pontuação total)</option>
                      {draws.map((d) => (
                        <option key={d.id} value={d.id}>
                          {formatDate(d.draw_date)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* MODIFIQUEI AQUI - Mensagem correta quando ainda não houve sorteio */}
              {ranking.length > 0 && draws.length === 0 && (
                <div className="rounded-xl sm:rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-6 mb-4">
                  <div className="text-center">
                    <div className="text-3xl mb-2">⏳</div>
                    <h4 className="text-base sm:text-lg font-bold text-blue-900 mb-2">Aguardando sorteio</h4>
                    <p className="text-blue-800 text-xs sm:text-sm">
                      Ainda não há sorteios realizados. A classificação abaixo mostra os participantes (pontuação 0 até o primeiro sorteio).
                    </p>
                  </div>
                </div>
              )}

              {/* Top 3 Podium */}
              {ranking.length > 0 &&
                draws.length > 0 &&
                (() => {
                  const isFinished = selectedContest.status === 'finished'

                  // FONTE ÚNICA DE VERDADE: Usar entries do rankingResult
                  const topWinners = rankingResult.entries.filter((e) => e.category === 'TOP')
                  const secondWinners = rankingResult.entries.filter((e) => e.category === 'SECOND')
                  const lowestWinners = rankingResult.entries.filter((e) => e.category === 'LOWEST')

                  // MODIFIQUEI AQUI - mensagem neutra baseada em existência de premiados
                  const hasPremiados = drawWinnersByScore.hasAnyWinner

                  if (!hasPremiados) {
                    return (
                      <div className="rounded-xl sm:rounded-2xl border-2 border-yellow-200 bg-yellow-50 p-4 sm:p-6 mb-4">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-yellow-100 rounded-full mb-3 sm:mb-4">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          </div>
                          <h4 className="text-base sm:text-lg font-bold text-yellow-900 mb-2">
                            Ainda não há pontuação suficiente para exibir o Top 3.
                          </h4>
                          <p className="text-yellow-800 text-xs sm:text-sm">
                            {isFinished ? 'O ranking abaixo mostra a classificação final dos participantes.' : 'O ranking abaixo mostra a classificação dos participantes.'}
                          </p>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-gradient-to-br from-[#F9F9F9] to-white p-4 sm:p-6 mb-4">
                      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                        <div className="p-1.5 sm:p-2 bg-[#F4C430]/10 rounded-lg">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 sm:h-5 sm:w-5 text-[#F4C430]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                            />
                          </svg>
                        </div>
                        <h4 className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">Top 3</h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        {/* SECOND */}
                        {secondWinners.length > 0 && (
                          <div className="order-2 sm:order-1 rounded-lg sm:rounded-xl border-2 border-[#E5E5E5] bg-gradient-to-br from-gray-50 to-white p-3 sm:p-4 text-center">
                            <div className="text-2xl sm:text-3xl mb-2">🥈</div>
                            <div className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 mb-1">SEGUNDA MAIOR</div>
                            {secondWinners.map((entry, idx) => (
                              <div
                                key={entry.participationId}
                                className={idx > 0 ? 'mt-2 pt-2 border-t border-[#E5E5E5]' : ''}
                              >
                                <div className="text-sm sm:text-base font-bold text-[#1F1F1F] mb-1 truncate">
                                  {entry.userName}
                                </div>
                                <div className="text-lg sm:text-xl font-extrabold text-[#1F1F1F]">{entry.score} pts</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* TOP */}
                        {topWinners.length > 0 && (
                          <div className="order-1 sm:order-2 rounded-lg sm:rounded-xl border-2 border-[#F4C430] bg-gradient-to-br from-[#F4C430]/20 to-[#FFD700]/20 p-3 sm:p-4 text-center transform sm:-translate-y-2">
                            <div className="text-3xl sm:text-4xl mb-2">🥇</div>
                            <div className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 mb-1">MAIOR PONTUAÇÃO</div>
                            {topWinners.map((entry, idx) => (
                              <div
                                key={entry.participationId}
                                className={idx > 0 ? 'mt-2 pt-2 border-t border-[#E5E5E5]' : ''}
                              >
                                <div className="text-base sm:text-lg font-bold text-[#1F1F1F] mb-1 truncate">
                                  {entry.userName}
                                </div>
                                <div className="text-xl sm:text-2xl font-extrabold text-[#1F1F1F]">{entry.score} pts</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* LOWEST */}
                        {lowestWinners.length > 0 && (
                          <div className="order-3 rounded-lg sm:rounded-xl border-2 border-[#E5E5E5] bg-gradient-to-br from-orange-50 to-white p-3 sm:p-4 text-center">
                            <div className="text-2xl sm:text-3xl mb-2">🥉</div>
                            <div className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 mb-1">MENOR PONTUAÇÃO</div>
                            {lowestWinners.map((entry, idx) => (
                              <div
                                key={entry.participationId}
                                className={idx > 0 ? 'mt-2 pt-2 border-t border-[#E5E5E5]' : ''}
                              >
                                <div className="text-sm sm:text-base font-bold text-[#1F1F1F] mb-1 truncate">
                                  {entry.userName}
                                </div>
                                <div className="text-lg sm:text-xl font-extrabold text-[#1F1F1F]">{entry.score} pts</div>
                              </div>
                            ))}
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 sm:h-5 sm:w-5 text-[#1E7F43]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                    </div>
                    <h4 className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">Classificação Completa</h4>
                  </div>

                  <div className="space-y-2">
                    {/* FONTE ÚNICA DE VERDADE: Usar entries já ordenados do rankingResult */}
                    {rankingResult.entries.slice(0, 10).map((entry) => (
                      <div
                        key={entry.participationId}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          entry.highlightRow
                            ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-[#F4C430]'
                            : 'bg-white border-[#E5E5E5] hover:border-[#1E7F43]'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            {entry.medal ? (
                              <span className="text-xl sm:text-2xl">{entry.medal}</span>
                            ) : (
                              <span className="text-sm sm:text-base font-bold text-[#1F1F1F]/60">#{entry.position}</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[#1F1F1F] truncate">{entry.userName}</div>
                            {entry.userEmail && (
                              <div className="text-xs text-[#1F1F1F]/60 truncate">{entry.userEmail}</div>
                            )}
                          </div>

                          {entry.hitNumbers.length > 0 && (
                            <div className="hidden sm:flex gap-1 flex-wrap pr-2">
                              {entry.hitNumbers.map((num) => (
                                <span key={num} className="px-2 py-1 bg-[#1E7F43] text-white rounded text-xs font-bold">
                                  {num.toString().padStart(2, '0')}✓
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span
                            className={`px-3 py-1 rounded-lg font-bold text-sm sm:text-base ${
                              entry.score > 0
                                ? 'bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white'
                                : 'bg-[#E5E5E5] text-[#1F1F1F]'
                            }`}
                          >
                            {entry.score}
                          </span>
                        </div>
                      </div>
                    ))}

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
                  <p className="text-[#1F1F1F]/70 text-sm sm:text-base">Ainda não há participantes neste concurso.</p>
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
