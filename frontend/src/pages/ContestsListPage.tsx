/**
 * Página de listagem de concursos ativos
 * FASE 2: Participações e Ranking
 * 
 * Exibe lista de concursos disponíveis para participação
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { listActiveContests, listFinishedContests } from '../services/contestsService'
import { listDrawsByContestId } from '../services/drawsService'
import { getDrawPayoutSummary } from '../services/payoutsService'
import { Contest } from '../types'
import { countActiveParticipationsByContest } from '../services/participationsService'
import { sumBolaoCollectedForContest } from '../services/paymentsService'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ContestStatusBadge from '../components/ContestStatusBadge'
import ContestPrizePoolInfo from '../components/ContestPrizePoolInfo'
import { formatCurrency } from '../utils/formatters'

type TabType = 'active' | 'history'

export default function ContestsListPage() {
  const [poolCountByContest, setPoolCountByContest] = useState<Record<string, number>>({})
  const [poolCollectedByContest, setPoolCollectedByContest] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const [activeContests, setActiveContests] = useState<Contest[]>([])
  const [finishedContests, setFinishedContests] = useState<Contest[]>([])
  const [contestsWithDraws, setContestsWithDraws] = useState<Record<string, boolean>>({})
  const [topWinnersByContest, setTopWinnersByContest] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)

  // Função helper para adicionar timeout a qualquer promise
  // `<T,>` evita que o parser TSX interprete `<T>` como tag JSX
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      ),
    ])
  }

  const loadInFlight = useRef(false)
  const hasLoadedListRef = useRef(false)

  const loadContests = useCallback(async (options?: { force?: boolean }) => {
    if (loadInFlight.current) return
    if (options?.force) {
      hasLoadedListRef.current = false
    }
    if (hasLoadedListRef.current) return
    loadInFlight.current = true
    try {
      setLoading(true)
      setError(null)

      const [activeData, finishedData] = await Promise.all([
        withTimeout(listActiveContests(), 12000, 'Timeout ao carregar concursos ativos'),
        withTimeout(listFinishedContests(), 12000, 'Timeout ao carregar concursos finalizados'),
      ])

      setActiveContests(activeData)
      setFinishedContests(finishedData)
      setDataLoaded(true)
      hasLoadedListRef.current = true

      queueMicrotask(() => {
        const enrich = async () => {
          const drawsMap: Record<string, boolean> = {}
          const topWinnersMap: Record<string, number> = {}
          const ordered = [...activeData, ...finishedData]

          await Promise.allSettled(
            ordered.map(async (contest) => {
              try {
                const draws = await withTimeout(
                  listDrawsByContestId(contest.id),
                  8000,
                  `Timeout sorteios ${contest.id}`
                )
                drawsMap[contest.id] = draws.length > 0

                if (contest.status === 'finished' && draws.length > 0) {
                  try {
                    const summary = await withTimeout(
                      getDrawPayoutSummary(draws[0].id),
                      8000,
                      `Timeout resumo prêmios ${draws[0].id}`
                    )
                    topWinnersMap[contest.id] = summary.categories.TOP?.winnersCount ?? 0
                  } catch {
                    topWinnersMap[contest.id] = 0
                  }
                }
              } catch {
                drawsMap[contest.id] = false
              }
            })
          )

          setContestsWithDraws((prev) => ({ ...prev, ...drawsMap }))
          setTopWinnersByContest((prev) => ({ ...prev, ...topWinnersMap }))
        }

        void enrich()
      })
    } catch (err) {
      console.error('[ContestsListPage] Erro ao carregar concursos:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar concursos')
      setDataLoaded(false)
    } finally {
      setLoading(false)
      loadInFlight.current = false
    }
  }, [])

  useEffect(() => {
    void loadContests()
  }, [loadContests])

  useEffect(() => {
    if (!dataLoaded) {
      setPoolCountByContest({})
      setPoolCollectedByContest({})
      return
    }
    if (activeContests.length === 0 && finishedContests.length === 0) {
      setPoolCountByContest({})
      setPoolCollectedByContest({})
      return
    }

    let cancelled = false

    const loadCounts = async (contests: Contest[]) => {
      if (contests.length === 0) return
      const rows = await Promise.all(
        contests.map(async (c) => ({
          id: c.id,
          count: await countActiveParticipationsByContest(c.id),
          collected: await sumBolaoCollectedForContest(c.id),
        }))
      )
      if (cancelled) return
      setPoolCountByContest((prev) => {
        const next = { ...prev }
        rows.forEach((r) => {
          next[r.id] = r.count
        })
        return next
      })
      setPoolCollectedByContest((prev) => {
        const next = { ...prev }
        rows.forEach((r) => {
          if (r.collected != null) next[r.id] = r.collected
        })
        return next
      })
    }

    void (async () => {
      await loadCounts(activeContests)
      if (cancelled) return
      await loadCounts(finishedContests)
    })()

    return () => {
      cancelled = true
    }
  }, [dataLoaded, activeContests, finishedContests])

  if (loading && !dataLoaded) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto"></div>
            <p className="mt-4 text-[#1F1F1F]/70">Carregando concursos...</p>
            <p className="mt-2 text-xs text-[#1F1F1F]/50">Isso pode levar alguns segundos</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1 px-4">
          <div className="text-center max-w-md">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Erro ao Carregar</h2>
            <p className="text-[#1F1F1F]/70 mb-6">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null)
                void loadContests({ force: true })
              }}
              className="px-6 py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors"
            >
              Tentar Novamente
            </button>
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
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E7F43] via-[#1E7F43] to-[#3CCB7F] opacity-95"></div>
        <div className="relative bg-white/5 backdrop-blur-sm p-4 sm:p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 flex-wrap">
                <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="px-3 sm:px-4 py-1 bg-[#3CCB7F]/30 text-white rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap">
                  ● {activeTab === 'active' ? activeContests.length : finishedContests.length} {activeTab === 'active' ? 'Ativos' : 'Finalizados'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-3">
                {activeTab === 'active' ? 'Concursos Disponíveis' : 'Histórico de Concursos'}
              </h1>
              <p className="text-white/90 text-sm sm:text-base md:text-lg max-w-2xl">
                {activeTab === 'active' 
                  ? 'Escolha um concurso e participe agora! Sorte, confiança e praticidade em cada participação.'
                  : 'Visualize concursos finalizados e seus resultados. Histórico completo de sorteios realizados.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Abas para alternar entre Ativos e Histórico */}
      <div className="container mx-auto px-2 sm:px-4 mb-6 max-w-7xl">
        <div className="flex gap-2 bg-white rounded-xl p-1 shadow-lg border border-[#E5E5E5] max-w-md">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'active'
                ? 'bg-[#1E7F43] text-white shadow-md'
                : 'text-[#1F1F1F]/70 hover:text-[#1F1F1F]'
            }`}
          >
            Ativos ({activeContests.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'history'
                ? 'bg-[#1E7F43] text-white shadow-md'
                : 'text-[#1F1F1F]/70 hover:text-[#1F1F1F]'
            }`}
          >
            Histórico ({finishedContests.length})
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="container mx-auto px-2 sm:px-4 pb-6 sm:pb-8 flex-1 max-w-7xl">
        {(() => {
          const currentContests = activeTab === 'active' ? activeContests : finishedContests
          
          if (currentContests.length === 0) {
            return (
              <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-8 sm:p-12 text-center shadow-xl">
                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-[#F9F9F9] rounded-full mb-3 sm:mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8 text-[#E5E5E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-[#1F1F1F]/70 text-base sm:text-lg mb-2 px-4">
                  {activeTab === 'active' 
                    ? 'Nenhum concurso ativo no momento.'
                    : 'Nenhum concurso finalizado ainda.'}
                </p>
                <p className="text-[#1F1F1F]/40 text-xs sm:text-sm px-4">
                  {activeTab === 'active'
                    ? 'Novos concursos aparecerão aqui quando forem criados.'
                    : 'Os concursos finalizados aparecerão aqui após a realização dos sorteios.'}
                </p>
              </div>
            )
          }
          
          return (
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {currentContests.map((contest) => (
              <div
                key={contest.id}
                className="rounded-2xl sm:rounded-3xl border-2 border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-xl hover:shadow-2xl hover:border-[#1E7F43] transition-all hover:scale-[1.01] sm:hover:scale-[1.02]"
              >
                {/* Header do Card */}
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <ContestStatusBadge 
                        contest={contest} 
                        hasDraws={contestsWithDraws[contest.id] || false}
                        variant="card"
                      />
                    </div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-[#1F1F1F] mb-2 break-words">
                      {contest.name}
                    </h3>
                    {contest.description && (
                      <p className="text-[#1F1F1F]/70 text-xs sm:text-sm line-clamp-2">
                        {contest.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Cards de Informações */}
                <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
                  {/* Intervalo Numérico */}
                  <div className="rounded-lg sm:rounded-xl border border-[#E5E5E5] bg-[#F9F9F9] p-2 sm:p-3">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <div className="p-1 sm:p-1.5 bg-[#F4C430]/10 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">Intervalo</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#F4C430] text-[#1F1F1F] rounded-lg font-bold text-xs sm:text-sm">{contest.min_number}</span>
                      <span className="text-[#1F1F1F]/40 font-bold text-xs">até</span>
                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#F4C430] text-[#1F1F1F] rounded-lg font-bold text-xs sm:text-sm">{contest.max_number}</span>
                    </div>
                  </div>

                  {/* Números por Participação */}
                  <div className="rounded-lg sm:rounded-xl border border-[#E5E5E5] bg-[#F9F9F9] p-2 sm:p-3">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <div className="p-1 sm:p-1.5 bg-[#1E7F43]/10 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">Por Participação</span>
                    </div>
                    <div className="text-base sm:text-lg font-extrabold text-[#1F1F1F]">
                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#F4C430] text-[#1F1F1F] rounded-lg inline-block">{contest.numbers_per_participation}</span>
                    </div>
                  </div>

                  {/* Valor da cota — mesmo bloco em todos os tamanhos de ecrã */}
                  <div className="rounded-lg sm:rounded-xl border border-[#E5E5E5] bg-[#F9F9F9] p-2 sm:p-3">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <div className="p-1 sm:p-1.5 bg-[#1E7F43]/10 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">Valor da cota</span>
                    </div>
                    <p className="text-base sm:text-lg font-extrabold text-[#1E7F43] tabular-nums">
                      {contest.participation_value != null ? formatCurrency(contest.participation_value) : '—'}
                    </p>
                  </div>
                </div>

                {/* Texto de ganhadores TOP (apenas no histórico, concursos com sorteio) */}
                {activeTab === 'history' && contestsWithDraws[contest.id] && (
                  <p className="text-sm sm:text-base font-semibold text-[#1F1F1F] mb-3">
                    {(topWinnersByContest[contest.id] ?? 0) === 0
                      ? 'Nenhuma pessoa atingiu a pontuação máxima do sorteio'
                      : `${topWinnersByContest[contest.id]} ${topWinnersByContest[contest.id] === 1 ? 'pessoa atingiu' : 'pessoas atingiram'} a pontuação máxima do sorteio`}
                  </p>
                )}

                <ContestPrizePoolInfo
                  contest={contest}
                  variant="compact"
                  showColumnAmountsOnly
                  participationsCount={poolCountByContest[contest.id]}
                  collectedAmountOverride={poolCollectedByContest[contest.id]}
                />

                {/* Botão */}
                <Link
                  to={`/contests/${contest.id}`}
                  className={`block w-full text-center rounded-lg sm:rounded-xl py-2.5 sm:py-3 px-4 font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.01] sm:hover:scale-[1.02] text-sm sm:text-base ${
                    activeTab === 'history'
                      ? 'bg-[#1F1F1F]/70 text-white hover:bg-[#1F1F1F]'
                      : 'bg-[#1E7F43] text-white hover:bg-[#3CCB7F]'
                  }`}
                >
                  {activeTab === 'history' ? 'Ver Resultados' : 'Ver Detalhes'}
                </Link>
              </div>
              ))}
            </div>
          )
        })()}
      </div>
      <Footer />
    </div>
  )
}
