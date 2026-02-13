/**
 * Página de detalhes de um concurso
 * FASE 2: Participações e Ranking
 * 
 * Exibe informações do concurso e histórico de sorteios
 */
import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getContestById } from '../services/contestsService'
import { listOfficialRefsByContestId } from '../services/contestOfficialRefsService'
import { listDrawsByContestId } from '../services/drawsService'
import { getDrawPayoutSummary, getPayoutsByDraw } from '../services/payoutsService'
import { getContestRanking } from '../services/participationsService'
import { Contest, Draw, Participation, ContestOfficialRef } from '../types'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { getContestState } from '../utils/contestHelpers'
import { formatOfficialRefDate } from '../utils/contestOfficialRefUtils'
import OfficialContestNumbersBadges from '../components/OfficialContestNumbersBadges'

export default function ContestDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [contest, setContest] = useState<Contest | null>(null)
  const [draws, setDraws] = useState<Draw[]>([])
  const [participations, setParticipations] = useState<Participation[]>([])
  const [payouts, setPayouts] = useState<Record<string, { category: string; amount_won: number }>>({})
  const [topWinnersCount, setTopWinnersCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [officialRefs, setOfficialRefs] = useState<ContestOfficialRef[]>([])

  useEffect(() => {
    async function loadContestData() {
      if (!id) {
        setError('ID do concurso não fornecido')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Carregar concurso, sorteios e refs oficiais em paralelo
        const [contestData, drawsData, refsData] = await Promise.all([
          getContestById(id),
          listDrawsByContestId(id),
          listOfficialRefsByContestId(id).catch(() => []),
        ])

        if (!contestData) {
          setError('Concurso não encontrado')
          return
        }

        setContest(contestData)
        setDraws(drawsData)
        setOfficialRefs(refsData || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    loadContestData()
  }, [id])

  // Carregar participações e payouts do sorteio mais recente (para exibir números vencedores TOP)
  useEffect(() => {
    if (draws.length === 0 || !id) {
      setTopWinnersCount(0)
      setPayouts({})
      setParticipations([])
      return
    }
    const latestDraw = draws[0]
    Promise.all([
      getDrawPayoutSummary(latestDraw.id),
      getPayoutsByDraw(latestDraw.id),
      getContestRanking(id),
    ])
      .then(([summary, drawPayouts, rankingData]) => {
        const count = summary.categories.TOP?.winnersCount ?? 0
        setTopWinnersCount(count)
        const payoutsMap: Record<string, { category: string; amount_won: number }> = {}
        drawPayouts.forEach((p) => {
          payoutsMap[p.participation_id] = { category: p.category, amount_won: p.amount_won }
        })
        setPayouts(payoutsMap)
        setParticipations(rankingData)
      })
      .catch(() => {
        setTopWinnersCount(0)
        setPayouts({})
        setParticipations([])
      })
  }, [draws, id])

  // MODIFIQUEI AQUI - Atualizar estado do botão quando a data de início chegar
  useEffect(() => {
    if (!contest) return

    const contestState = getContestState(contest, draws.length > 0)
    
    // Se o concurso está "em breve", verificar quando a data de início chegar
    if (contestState.phase === 'upcoming') {
      const startDate = new Date(contest.start_date)
      const now = new Date()
      const timeUntilStart = startDate.getTime() - now.getTime()

      if (timeUntilStart > 0) {
        // Criar um timer para atualizar quando a data de início chegar
        const timer = setTimeout(() => {
          // Forçar re-render atualizando o estado (mesmo que seja o mesmo valor)
          setContest({ ...contest })
        }, timeUntilStart + 1000) // +1 segundo para garantir que passou

        return () => clearTimeout(timer)
      }
    }
  }, [contest, draws.length])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9]">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto"></div>
            <p className="mt-4 text-[#1F1F1F]/70">Carregando concurso...</p>
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
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
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-6xl flex-1">
        {/* Breadcrumb */}
        <nav className="mb-4 sm:mb-6">
          <Link
            to="/contests"
            className="inline-flex items-center gap-2 text-[#1E7F43] hover:text-[#3CCB7F] font-semibold transition-colors text-sm sm:text-base"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Voltar para concursos</span>
            <span className="sm:hidden">Voltar</span>
          </Link>
        </nav>

        {/* Header do Concurso com Gradiente */}
        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden mb-6 sm:mb-8 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1E7F43] via-[#1E7F43] to-[#3CCB7F] opacity-95"></div>
          <div className="relative bg-white/5 backdrop-blur-sm p-4 sm:p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <span className={`px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap ${
                    getContestState(contest, draws.length > 0).phase === 'accepting'
                      ? 'bg-[#3CCB7F]/30 text-white' 
                      : getContestState(contest, draws.length > 0).phase === 'finished'
                      ? 'bg-white/20 text-white'
                      : 'bg-[#F4C430]/30 text-white'
                  }`}>
                    {getContestState(contest, draws.length > 0).phase === 'accepting' 
                      ? '● Aceitando Participações' 
                      : getContestState(contest, draws.length > 0).phase === 'finished'
                      ? '● Finalizado'
                      : '● ' + getContestState(contest, draws.length > 0).label}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-3">
                  {contest.name}
                </h1>
                {/* MODIFIQUEI AQUI - Exibir código do concurso */}
                {contest.contest_code && (
                  <div className="mb-2">
                    <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs sm:text-sm font-mono font-semibold">
                      Código do Concurso: {contest.contest_code}
                    </span>
                  </div>
                )}
                {contest.description && (
                  <p className="text-white/90 text-sm sm:text-base md:text-lg max-w-2xl">{contest.description}</p>
                )}
              </div>
              {/* MODIFIQUEI AQUI - Usar getContestState para verificar se aceita participações e mostrar botão correto */}
              {getContestState(contest, draws.length > 0).acceptsParticipations ? (
                <button
                  onClick={() => {
                    // MODIFIQUEI AQUI - Redirecionar para login se não autenticado, senão para página de participação
                    if (!user) {
                      navigate('/login')
                    } else {
                      navigate(`/contests/${id}/join`)
                    }
                  }}
                  className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-white text-[#1E7F43] rounded-xl hover:bg-[#F4C430] hover:text-[#1F1F1F] transition-all font-bold text-base md:text-lg shadow-2xl transform hover:scale-105 text-center"
                >
                  Participar Agora
                </button>
              ) : (
                <div className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-[#E5E5E5] text-[#1F1F1F]/60 rounded-xl font-bold text-base md:text-lg text-center cursor-not-allowed">
                  {getContestState(contest, draws.length > 0).label}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cards de Informações */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Card Intervalo Numérico */}
          <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="p-2 sm:p-3 bg-[#F4C430]/10 rounded-lg sm:rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">Intervalo</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#F4C430] text-[#1F1F1F] rounded-lg font-bold text-lg sm:text-xl">{contest.min_number}</span>
              <span className="text-[#1F1F1F]/40 font-bold text-sm sm:text-base">até</span>
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#F4C430] text-[#1F1F1F] rounded-lg font-bold text-lg sm:text-xl">{contest.max_number}</span>
            </div>
          </div>

          {/* Card Números por Participação */}
          <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="p-2 sm:p-3 bg-[#1E7F43]/10 rounded-lg sm:rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">Por Participação</h3>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#1F1F1F]">
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#F4C430] text-[#1F1F1F] rounded-lg inline-block">{contest.numbers_per_participation}</span>
            </div>
          </div>

          {/* Card Status */}
          <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${
                getContestState(contest, draws.length > 0).phase === 'finished' 
                  ? 'bg-[#1F1F1F]/10' 
                  : getContestState(contest, draws.length > 0).phase === 'accepting'
                  ? 'bg-[#3CCB7F]/10'
                  : 'bg-[#F4C430]/10'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 sm:h-6 sm:w-6 ${
                  getContestState(contest, draws.length > 0).phase === 'finished' 
                    ? 'text-[#1F1F1F]/70' 
                    : getContestState(contest, draws.length > 0).phase === 'accepting'
                    ? 'text-[#3CCB7F]'
                    : 'text-[#F4C430]'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">Status</h3>
            </div>
            <span className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-base sm:text-lg font-bold inline-block ${
              getContestState(contest, draws.length > 0).phase === 'finished'
                ? 'bg-[#1F1F1F]/10 text-[#1F1F1F]/70'
                : getContestState(contest, draws.length > 0).phase === 'accepting'
                ? 'bg-[#3CCB7F]/20 text-[#1E7F43]'
                : getContestState(contest, draws.length > 0).phase === 'awaiting_result'
                ? 'bg-[#F4C430]/20 text-[#1F1F1F]'
                : 'bg-[#E5E5E5] text-[#1F1F1F]/60'
            }`}>
              {getContestState(contest, draws.length > 0).label}
            </span>
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-lg">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <div className="p-1.5 sm:p-2 bg-[#1E7F43]/10 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 uppercase">Data de Início</h3>
            </div>
            <p className="text-sm sm:text-base md:text-lg font-semibold text-[#1F1F1F] break-words">{formatDate(contest.start_date)}</p>
          </div>

          <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-lg">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <div className="p-1.5 sm:p-2 bg-[#1E7F43]/10 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 uppercase">Data de Encerramento</h3>
            </div>
            <p className="text-sm sm:text-base md:text-lg font-semibold text-[#1F1F1F] break-words">{formatDate(contest.end_date)}</p>
          </div>
        </div>

        {/* Bloco Concurso Oficial - padronizado com o sistema */}
        {(officialRefs.length > 0 || (contest.official_contest_name && contest.official_contest_code)) && (
          <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-lg mb-6 sm:mb-8">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="p-1.5 sm:p-2 bg-[#1E7F43]/10 rounded-lg shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7a1.994 1.994 0 01-.586-1.414V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/80 uppercase tracking-wide">Concurso Oficial</h3>
            </div>
            <div className="space-y-3">
              {officialRefs.length > 0
                ? officialRefs.map((ref) => (
                    <div key={ref.id} className="p-4 bg-[#1E7F43]/10 rounded-xl border border-[#1E7F43]/20 hover:border-[#1E7F43]/30 transition-colors">
                      <p className="text-base sm:text-lg font-bold text-[#1F1F1F]">
                        Concurso {ref.official_contest_code} • {ref.official_contest_name}
                      </p>
                      {ref.official_contest_numbers && (
                        <OfficialContestNumbersBadges numbers={ref.official_contest_numbers} />
                      )}
                      {ref.official_contest_date && (
                        <p className="text-sm text-[#1F1F1F]/60 mt-1 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatOfficialRefDate(ref.official_contest_date)}
                        </p>
                      )}
                    </div>
                  ))
                : (
                    <div className="p-4 bg-[#1E7F43]/10 rounded-xl border border-[#1E7F43]/20">
                      <p className="text-base sm:text-lg font-bold text-[#1F1F1F]">
                        Concurso {contest.official_contest_code} • {contest.official_contest_name}
                      </p>
                      {contest.official_contest_numbers && (
                        <OfficialContestNumbersBadges numbers={contest.official_contest_numbers} />
                      )}
                      {contest.official_contest_date && (
                        <p className="text-sm text-[#1F1F1F]/60 mt-1 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatOfficialRefDate(contest.official_contest_date)}
                        </p>
                      )}
                    </div>
                  )}
            </div>
          </div>
        )}

        {/* Resultado do Sorteio - números que fizeram (ganhadores TOP) */}
        {draws.length > 0 && (
          <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-lg mb-6 sm:mb-8">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-[#1F1F1F]">🎯 Resultado do Sorteio</h2>
            </div>
            {(() => {
              const topWinningParticipationIds = Object.entries(payouts)
                .filter(([, p]) => p && p.amount_won > 0 && p.category === 'TOP')
                .map(([pid]) => pid)

              const topWinningParticipations = participations.filter((p) =>
                topWinningParticipationIds.includes(p.id)
              )

              const uniqueWinningSets = Array.from(
                new Map(
                  topWinningParticipations.map((p) => {
                    const nums = [...(p.numbers || [])].sort((a, b) => a - b)
                    const key = nums.join(',')
                    return [key, nums]
                  })
                ).values()
              )

              return (
                <>
                  {uniqueWinningSets.length > 0 && (
                    <>
                      <p className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 uppercase tracking-wide mb-2 sm:mb-3">
                        Resultado / Números sorteados
                      </p>
                      <div className="space-y-4 mb-4">
                        {uniqueWinningSets.map((nums, idx) => (
                          <div key={idx} className="flex flex-wrap gap-2 sm:gap-3 items-center">
                            {nums.map((num) => (
                              <span
                                key={num}
                                className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#F4C430] text-[#1F1F1F] font-bold text-sm sm:text-base shadow-sm"
                              >
                                {num.toString().padStart(2, '0')}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="text-sm sm:text-base font-semibold text-[#1F1F1F]">
                    {topWinnersCount === 0
                      ? 'Nenhuma pessoa atingiu a pontuação máxima do sorteio'
                      : `${topWinnersCount} ${topWinnersCount === 1 ? 'pessoa atingiu' : 'pessoas atingiram'} a pontuação máxima do sorteio`}
                  </p>
                </>
              )
            })()}
          </div>
        )}

        {/* Botão para Ranking */}
        <div className="mb-6 sm:mb-8">
          <Link
            to={`/contests/${contest.id}/ranking`}
            className="inline-flex items-center gap-3 px-6 sm:px-8 py-4 sm:py-5 bg-gradient-to-r from-[#F4C430] to-[#FFD700] text-[#1F1F1F] rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <span>Ver Ranking</span>
          </Link>
        </div>

        {/* Histórico de Sorteios */}
        <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-4 sm:p-6 md:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3 mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 bg-[#F4C430]/10 rounded-lg sm:rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#1F1F1F]">
                Histórico de Sorteios
              </h2>
            </div>
            {draws.length > 0 && (
              <span className="px-3 py-1 bg-[#1E7F43]/10 text-[#1E7F43] rounded-full text-xs sm:text-sm font-semibold self-start sm:self-auto">
                {draws.length} {draws.length === 1 ? 'sorteio' : 'sorteios'}
              </span>
            )}
          </div>

          {draws.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-[#F9F9F9] rounded-full mb-3 sm:mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8 text-[#E5E5E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-[#1F1F1F]/60 text-base sm:text-lg">Nenhum sorteio realizado ainda.</p>
              <p className="text-[#1F1F1F]/40 text-xs sm:text-sm mt-2 px-4">Os sorteios aparecerão aqui quando forem realizados.</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {draws.map((draw, index) => (
                <div
                  key={draw.id}
                  className="rounded-lg sm:rounded-xl border-2 border-[#E5E5E5] bg-gradient-to-r from-white to-[#F9F9F9] p-4 sm:p-6 hover:border-[#1E7F43] hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="flex items-start gap-2 sm:gap-4 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-[#F4C430] rounded-full font-bold text-[#1F1F1F] text-sm sm:text-lg flex-shrink-0">
                        #{draws.length - index}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[#1F1F1F] text-base sm:text-lg mb-1 break-words">
                          Sorteio realizado em {formatDate(draw.draw_date)}
                        </h3>
                        <p className="text-xs sm:text-sm text-[#1F1F1F]/60">
                          Criado em {formatDate(draw.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-[#E5E5E5]">
                    <p className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 mb-2 sm:mb-3 uppercase tracking-wide">Números Sorteados</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {draw.numbers
                        .sort((a, b) => a - b)
                        .map((number) => (
                          <span
                            key={number}
                            className="px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-[#F4C430] text-[#1F1F1F] rounded-lg text-xs sm:text-sm md:text-base font-bold shadow-sm hover:scale-110 transition-transform"
                          >
                            {number}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
