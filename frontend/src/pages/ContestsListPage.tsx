/**
 * Página de listagem de concursos ativos
 * FASE 2: Participações e Ranking
 * 
 * Exibe lista de concursos disponíveis para participação
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listActiveContests } from '../services/contestsService'
import { Contest } from '../types'
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function ContestsListPage() {
  const [contests, setContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadContests() {
      try {
        setLoading(true)
        setError(null)
        console.log('[ContestsListPage] MODIFIQUEI AQUI - Carregando concursos ativos...')
        const data = await listActiveContests()
        console.log('[ContestsListPage] MODIFIQUEI AQUI - Concursos carregados:', data.length)
        setContests(data)
      } catch (err) {
        console.error('[ContestsListPage] MODIFIQUEI AQUI - Erro ao carregar concursos:', err)
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar concursos'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadContests()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto"></div>
            <p className="mt-4 text-[#1F1F1F]/70">Carregando concursos...</p>
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
          <div className="text-center">
            <div className="text-red-600 text-xl mb-2">⚠️ Erro</div>
            <p className="text-[#1F1F1F]/70">{error}</p>
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
                  ● {contests.length} {contests.length === 1 ? 'Concurso Ativo' : 'Concursos Ativos'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-3">
                Concursos Disponíveis
              </h1>
              <p className="text-white/90 text-sm sm:text-base md:text-lg max-w-2xl">
                Escolha um concurso e participe agora! Sorte, confiança e praticidade em cada participação.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="container mx-auto px-2 sm:px-4 pb-6 sm:pb-8 flex-1 max-w-7xl">
        {contests.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-8 sm:p-12 text-center shadow-xl">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-[#F9F9F9] rounded-full mb-3 sm:mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8 text-[#E5E5E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-[#1F1F1F]/70 text-base sm:text-lg mb-2 px-4">Nenhum concurso ativo no momento.</p>
            <p className="text-[#1F1F1F]/40 text-xs sm:text-sm px-4">Novos concursos aparecerão aqui quando forem criados.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {contests.map((contest) => (
              <div
                key={contest.id}
                className="rounded-2xl sm:rounded-3xl border-2 border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-xl hover:shadow-2xl hover:border-[#1E7F43] transition-all hover:scale-[1.01] sm:hover:scale-[1.02]"
              >
                {/* Header do Card */}
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        contest.status === 'active' 
                          ? 'bg-[#3CCB7F]/20 text-[#1E7F43]' 
                          : 'bg-[#E5E5E5] text-[#1F1F1F]/60'
                      }`}>
                        {contest.status === 'active' ? '● Ativo' : contest.status}
                      </span>
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

                {/* Botão */}
                <Link
                  to={`/contests/${contest.id}`}
                  className="block w-full text-center rounded-lg sm:rounded-xl bg-[#1E7F43] text-white py-2.5 sm:py-3 px-4 font-bold hover:bg-[#3CCB7F] transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.01] sm:hover:scale-[1.02] text-sm sm:text-base"
                >
                  Ver Detalhes
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
