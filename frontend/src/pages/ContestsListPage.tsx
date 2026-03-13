/**
 * Página de listagem de concursos ativos
 * FASE 2: Participações e Ranking
 * 
 * Exibe lista de concursos disponíveis para participação
 */
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { listActiveContests, listFinishedContests } from '../services/contestsService'
import { listDrawsByContestId } from '../services/drawsService'
import { getDrawPayoutSummary } from '../services/payoutsService'
import { Contest } from '../types'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ContestStatusBadge from '../components/ContestStatusBadge'

type TabType = 'active' | 'history'

export default function ContestsListPage() {
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const [activeContests, setActiveContests] = useState<Contest[]>([])
  const [finishedContests, setFinishedContests] = useState<Contest[]>([])
  const [contestsWithDraws, setContestsWithDraws] = useState<Record<string, boolean>>({})
  const [topWinnersByContest, setTopWinnersByContest] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [simpleMode, setSimpleMode] = useState(true) // Padrão: modo simples para teste

  // Função helper para adicionar timeout a qualquer promise
  const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      )
    ])
  }

  // Carregamento super simples para teste
  const loadContestsSimple = useCallback(async () => {
    if (loading || dataLoaded) return

    try {
      setLoading(true)
      setError(null)
      console.log('[ContestsListPage] Modo simples - carregando apenas concursos básicos...')
      
      // Carregar apenas concursos, sem informações detalhadas
      const activeData = await withTimeout(
        listActiveContests(), 
        5000, 
        'Timeout ao carregar concursos ativos'
      )
      
      const finishedData = await withTimeout(
        listFinishedContests(), 
        5000, 
        'Timeout ao carregar concursos finalizados'
      )
      
      console.log('[ContestsListPage] Modo simples - Concursos carregados!')
      
      setActiveContests(activeData)
      setFinishedContests(finishedData)
      setDataLoaded(true)
    } catch (err) {
      console.error('[ContestsListPage] Erro no modo simples:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar concursos')
      setDataLoaded(false)
    } finally {
      setLoading(false)
    }
  }, [loading, dataLoaded])

  const loadContests = useCallback(async () => {
    // Evitar carregar múltiplas vezes
    if (loading || dataLoaded) return

    try {
      setLoading(true)
      setError(null)
      console.log('[ContestsListPage] Carregando concursos...')
      
      // PASSO 1: Carregar concursos básicos com timeout curto
      const contestsPromise = Promise.all([
        withTimeout(listActiveContests(), 8000, 'Timeout ao carregar concursos ativos'),
        withTimeout(listFinishedContests(), 8000, 'Timeout ao carregar concursos finalizados'),
      ])
      
      const [activeData, finishedData] = await contestsPromise
      console.log('[ContestsListPage] Concursos carregados - Ativos:', activeData.length, 'Finalizados:', finishedData.length)
      
      // Atualizar UI imediatamente com dados básicos
      setActiveContests(activeData)
      setFinishedContests(finishedData)
      setDataLoaded(true)
      setLoading(false)
      
      // PASSO 2: Carregar informações detalhadas em background (não bloquear UI)
      setTimeout(async () => {
        try {
          console.log('[ContestsListPage] Carregando informações detalhadas...')
          const drawsMap: Record<string, boolean> = {}
          const topWinnersMap: Record<string, number> = {}
          const allContests = [...activeData, ...finishedData]
          
          // Processar apenas 3 concursos por vez para evitar sobrecarga
          const batchSize = 3
          for (let i = 0; i < allContests.length; i += batchSize) {
            const batch = allContests.slice(i, i + batchSize)
            
            const results = await Promise.allSettled(
              batch.map(async (contest) => {
                try {
                  // Timeout específico para cada consulta
                  const draws = await withTimeout(
                    listDrawsByContestId(contest.id), 
                    5000, 
                    `Timeout ao verificar sorteios do concurso ${contest.id}`
                  )
                  drawsMap[contest.id] = draws.length > 0
                  
                  // Para concursos finalizados com sorteio, buscar contagem de ganhadores TOP
                  if (contest.status === 'finished' && draws.length > 0) {
                    try {
                      const summary = await withTimeout(
                        getDrawPayoutSummary(draws[0].id),
                        5000,
                        `Timeout ao carregar resumo de prêmios do sorteio ${draws[0].id}`
                      )
                      topWinnersMap[contest.id] = summary.categories.TOP?.winnersCount ?? 0
                    } catch {
                      topWinnersMap[contest.id] = 0
                    }
                  }
                } catch (err) {
                  console.warn(`Erro ao processar concurso ${contest.id}:`, err)
                  drawsMap[contest.id] = false
                }
              })
            )
            
            // Atualizar UI progressivamente
            setContestsWithDraws({...drawsMap})
            setTopWinnersByContest({...topWinnersMap})
            
            // Pequena pausa entre lotes para não sobrecarregar
            if (i + batchSize < allContests.length) {
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          }
          
          console.log('[ContestsListPage] Informações detalhadas carregadas')
        } catch (err) {
          console.warn('[ContestsListPage] Erro ao carregar informações detalhadas:', err)
          // Não mostrar erro para o usuário, pois os dados básicos já foram carregados
        }
      }, 100) // Pequeno delay para permitir que a UI seja atualizada primeiro
      
    } catch (err) {
      console.error('[ContestsListPage] Erro ao carregar concursos:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar concursos'
      setError(errorMessage)
      setDataLoaded(false) // Permite nova tentativa
      setLoading(false)
    }
  }, [loading, dataLoaded])

  useEffect(() => {
    console.log('[ContestsListPage] useEffect - dataLoaded:', dataLoaded, 'loading:', loading, 'simpleMode:', simpleMode)
    if (!dataLoaded && !loading) {
      if (simpleMode) {
        console.log('[ContestsListPage] Iniciando loadContestsSimple...')
        loadContestsSimple()
      } else {
        console.log('[ContestsListPage] Iniciando loadContests completo...')
        loadContests()
      }
    }
  }, [loadContests, loadContestsSimple, dataLoaded, loading, simpleMode])

  // Reset quando alterar modo
  useEffect(() => {
    setDataLoaded(false)
    setLoading(false)
    setActiveContests([])
    setFinishedContests([])
    setContestsWithDraws({})
    setTopWinnersByContest({})
    setError(null)
  }, [simpleMode])

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
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setError(null)
                  setDataLoaded(false)
                  if (simpleMode) {
                    loadContestsSimple()
                  } else {
                    loadContests()
                  }
                }}
                className="px-6 py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors"
              >
                Tentar Novamente
              </button>
              <button
                onClick={() => {
                  setSimpleMode(!simpleMode)
                  setError(null)
                  setDataLoaded(false)
                }}
                className="px-4 py-3 bg-yellow-500 text-white rounded-xl font-semibold hover:bg-yellow-600 transition-colors text-sm"
              >
                {simpleMode ? 'Modo Completo' : 'Modo Simples'}
              </button>
            </div>
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
                </div>

                {/* Texto de ganhadores TOP (apenas no histórico, concursos com sorteio) */}
                {activeTab === 'history' && contestsWithDraws[contest.id] && (
                  <p className="text-sm sm:text-base font-semibold text-[#1F1F1F] mb-3">
                    {(topWinnersByContest[contest.id] ?? 0) === 0
                      ? 'Nenhuma pessoa atingiu a pontuação máxima do sorteio'
                      : `${topWinnersByContest[contest.id]} ${topWinnersByContest[contest.id] === 1 ? 'pessoa atingiu' : 'pessoas atingiram'} a pontuação máxima do sorteio`}
                  </p>
                )}

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
