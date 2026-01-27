/**
 * Página de Meus Tickets
 * FASE 2: Participações e Ranking
 * 
 * Exibe todas as participações do usuário com seus números e informações do concurso
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMyParticipations } from '../services/participationsService'
import { Participation, Contest } from '../types'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

interface ParticipationWithContest extends Participation {
  contest: Contest | null
}

export default function MyTicketsPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [participations, setParticipations] = useState<ParticipationWithContest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // MODIFIQUEI AQUI - Redirecionar para login se não autenticado
    if (!authLoading && !user) {
      navigate('/login')
      return
    }

    if (!user) return

    async function loadParticipations() {
      try {
        setLoading(true)
        setError(null)
        const data = await listMyParticipations()
        setParticipations(data)
      } catch (err) {
        console.error('[MyTicketsPage] Erro ao carregar participações:', err)
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar seus tickets'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadParticipations()
  }, [user, authLoading, navigate])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto"></div>
            <p className="mt-4 text-[#1F1F1F]/70">Carregando seus tickets...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (error && !participations.length) {
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
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E7F43] via-[#1E7F43] to-[#3CCB7F] opacity-95"></div>
        <div className="relative bg-white/5 backdrop-blur-sm p-4 sm:p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 flex-wrap">
                <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                <span className="px-3 sm:px-4 py-1 bg-[#3CCB7F]/30 text-white rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap">
                  ● {participations.length} {participations.length === 1 ? 'Ticket' : 'Tickets'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-3">
                Meus Tickets
              </h1>
              <p className="text-white/90 text-sm sm:text-base md:text-lg max-w-2xl">
                Visualize todos os seus números e concursos em que você está participando
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

        {participations.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-8 sm:p-12 text-center shadow-xl">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-[#F9F9F9] rounded-full mb-3 sm:mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8 text-[#E5E5E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <p className="text-[#1F1F1F]/70 text-base sm:text-lg mb-2 px-4">Você ainda não possui tickets.</p>
            <p className="text-[#1F1F1F]/40 text-xs sm:text-sm px-4 mb-4">Participe de um concurso para ver seus tickets aqui.</p>
            <Link
              to="/contests"
              className="inline-block px-6 py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-all shadow-lg"
            >
              Ver Concursos Disponíveis
            </Link>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {participations.map((participation) => (
              <div
                key={participation.id}
                className="rounded-2xl sm:rounded-3xl border-2 border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-xl hover:shadow-2xl hover:border-[#1E7F43] transition-all"
              >
                {/* Header do Ticket */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 sm:mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 flex-wrap">
                      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        participation.status === 'active' 
                          ? 'bg-[#3CCB7F]/20 text-[#1E7F43]' 
                          : participation.status === 'pending'
                          ? 'bg-[#F4C430]/20 text-[#F4C430]'
                          : 'bg-[#E5E5E5] text-[#1F1F1F]/60'
                      }`}>
                        {participation.status === 'active' ? '● Ativo' : participation.status === 'pending' ? '● Pendente' : '● Cancelado'}
                      </span>
                      {participation.ticket_code && (
                        <span className="px-2 sm:px-3 py-1 bg-[#1E7F43] text-white rounded-lg font-mono text-xs font-bold whitespace-nowrap">
                          {participation.ticket_code}
                        </span>
                      )}
                      {participation.contest && (
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          participation.contest.status === 'active' 
                            ? 'bg-[#1E7F43]/10 text-[#1E7F43]' 
                            : 'bg-[#E5E5E5] text-[#1F1F1F]/60'
                        }`}>
                          {participation.contest.status === 'active' ? 'Concurso Ativo' : participation.contest.status}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#1F1F1F] mb-2 break-words">
                      {participation.contest?.name || 'Concurso não encontrado'}
                    </h3>
                    {participation.contest?.description && (
                      <p className="text-[#1F1F1F]/70 text-xs sm:text-sm line-clamp-2 mb-2">
                        {participation.contest.description}
                      </p>
                    )}
                    <p className="text-[#1F1F1F]/50 text-xs sm:text-sm">
                      Criado em {formatDate(participation.created_at)}
                    </p>
                  </div>
                  {participation.contest && (
                    <Link
                      to={`/contests/${participation.contest.id}`}
                      className="px-4 py-2 bg-[#1E7F43] text-white rounded-lg font-semibold hover:bg-[#3CCB7F] transition-all text-sm sm:text-base whitespace-nowrap text-center"
                    >
                      Ver Concurso
                    </Link>
                  )}
                </div>

                {/* Números do Ticket */}
                <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-[#F9F9F9] p-4 sm:p-6 mb-4">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="p-1.5 sm:p-2 bg-[#F4C430]/10 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                    </div>
                    <h4 className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">
                      Seus Números
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {participation.numbers
                      .sort((a, b) => a - b)
                      .map((number) => (
                        <span
                          key={number}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#F4C430] text-[#1F1F1F] rounded-lg text-sm sm:text-base md:text-lg font-bold shadow-sm hover:scale-110 transition-transform"
                        >
                          {number}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Informações Adicionais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="rounded-lg sm:rounded-xl border border-[#E5E5E5] bg-white p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1 sm:p-1.5 bg-[#1E7F43]/10 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">Pontuação</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-extrabold text-[#1F1F1F]">
                      {participation.current_score} pontos
                    </div>
                  </div>
                  {participation.contest && (
                    <div className="rounded-lg sm:rounded-xl border border-[#E5E5E5] bg-white p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1 sm:p-1.5 bg-[#3CCB7F]/10 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 text-[#3CCB7F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">Encerramento</span>
                      </div>
                      <div className="text-sm sm:text-base font-semibold text-[#1F1F1F]">
                        {formatDate(participation.contest.end_date)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
