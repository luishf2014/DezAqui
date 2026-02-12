/**
 * Página de Última Compra
 *
 * Lista todas as compras (participações) do usuário e permite adicionar os mesmos
 * números em concursos disponíveis, com opções de adicionar ao carrinho ou comprar agora.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { listMyParticipations } from '../services/participationsService'
import { listActiveContests } from '../services/contestsService'
import { Participation, Contest } from '../types'
import Header from '../components/Header'
import Footer from '../components/Footer'

interface ParticipationWithContest extends Participation {
  contest: Contest | null
}

// Verifica se os números são compatíveis com o concurso
function isCompatible(contest: Contest, numbers: number[]): boolean {
  if (numbers.length !== contest.numbers_per_participation) return false
  const invalid = numbers.some(n => n < contest.min_number || n > contest.max_number)
  return !invalid
}

export default function LastPurchasePage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { addItem } = useCart()
  const [participations, setParticipations] = useState<ParticipationWithContest[]>([])
  const [activeContests, setActiveContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingToCart, setAddingToCart] = useState<string | null>(null)
  const [buyingNow, setBuyingNow] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
      return
    }
    if (!user) return

    async function loadData() {
      try {
        setLoading(true)
        setError(null)
        const [parts, contests] = await Promise.all([
          listMyParticipations(),
          listActiveContests(),
        ])
        setParticipations(parts)
        setActiveContests(contests)
      } catch (err) {
        console.error('[LastPurchasePage] Erro ao carregar:', err)
        setError(err instanceof Error ? err.message : 'Erro ao carregar suas compras')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, authLoading, navigate])

  const handleAddToCart = (contest: Contest, numbers: number[]) => {
    const key = `${contest.id}-${numbers.join('-')}`
    setAddingToCart(key)
    try {
      addItem(contest, numbers)
    } finally {
      setTimeout(() => setAddingToCart(null), 600)
    }
  }

  const handleBuyNow = (contest: Contest, numbers: number[]) => {
    const key = `${contest.id}-${numbers.join('-')}`
    setBuyingNow(key)
    try {
      addItem(contest, numbers)
      navigate('/cart')
    } finally {
      setTimeout(() => setBuyingNow(null), 300)
    }
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-[#1E7F43] mx-auto"></div>
            <p className="mt-4 text-sm sm:text-base text-[#1F1F1F]/70">Carregando suas compras...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />

      {/* Header da Página */}
      <div className="relative rounded-xl sm:rounded-2xl md:rounded-3xl overflow-hidden mx-3 sm:mx-4 md:mx-6 mt-3 sm:mt-4 md:mt-6 mb-4 sm:mb-6 md:mb-8 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E7F43] via-[#1E7F43] to-[#3CCB7F] opacity-95"></div>
        <div className="relative bg-white/5 backdrop-blur-sm p-4 sm:p-5 md:p-6 lg:p-8">
          <div className="flex flex-col gap-4 sm:gap-5">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="p-2 sm:p-2.5 md:p-3 bg-white/20 rounded-lg md:rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="px-2.5 sm:px-3 md:px-4 py-1 bg-[#3CCB7F]/30 text-white rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap">
                ● {participations.length} {participations.length === 1 ? 'Compra' : 'Compras'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
              Última Compra
            </h1>
            <p className="text-white/90 text-xs sm:text-sm md:text-base max-w-2xl leading-relaxed">
              Repita suas apostas favoritas em novos concursos. Adicione ao carrinho ou compre agora.
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="container mx-auto px-3 sm:px-4 md:px-6 pb-6 sm:pb-8 md:pb-10 flex-1 max-w-5xl">
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-red-700 break-words">{error}</p>
          </div>
        )}

        {participations.length === 0 ? (
          <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-white p-6 sm:p-8 md:p-10 lg:p-12 text-center shadow-xl">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-[#F9F9F9] rounded-full mb-3 sm:mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 sm:h-8 sm:w-8 text-[#E5E5E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-[#1F1F1F]/70 text-base sm:text-lg mb-1.5 sm:mb-2 px-2">Você ainda não possui compras.</p>
            <p className="text-[#1F1F1F]/40 text-xs sm:text-sm mb-4 sm:mb-5 px-2">Participe de um concurso para poder repetir suas apostas aqui.</p>
            <Link
              to="/contests"
              className="inline-block px-5 py-2.5 sm:px-6 sm:py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-all shadow-lg text-sm sm:text-base"
            >
              Ver Concursos Disponíveis
            </Link>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            {participations.map((participation) => {
              const numbers = [...participation.numbers].sort((a, b) => a - b)
             // Inclui todos os concursos ativos compatíveis (incluindo o próprio bolão de origem)
              const compatibleContests = activeContests.filter(c => isCompatible(c, numbers))

              return (
                <div
                  key={participation.id}
                  className="rounded-xl sm:rounded-2xl border-2 border-[#E5E5E5] bg-white p-3 sm:p-4 md:p-6 shadow-xl hover:border-[#1E7F43]/50 transition-all"
                >
                  {/* Cabeçalho da compra */}
                  <div className="mb-3 sm:mb-4">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <span className="text-[10px] sm:text-xs font-semibold text-[#1F1F1F]/60 uppercase tracking-wide">
                        Compra em {formatDate(participation.created_at)}
                      </span>
                      {participation.contest && (
                        <span className="px-2 py-0.5 sm:py-1 bg-[#1E7F43]/10 text-[#1E7F43] rounded-lg text-[10px] sm:text-xs font-semibold truncate max-w-full">
                          {participation.contest.name}
                        </span>
                      )}
                    </div>

                    {/* Números */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {numbers.map((n) => (
                        <span
                          key={n}
                          className="px-2 py-1 sm:px-3 sm:py-1.5 bg-[#1E7F43] text-white rounded-lg font-bold text-xs sm:text-sm"
                        >
                          {n.toString().padStart(2, '0')}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Concursos disponíveis */}
                  {compatibleContests.length > 0 ? (
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-[#1F1F1F]/80 mb-2 sm:mb-3">
                        Adicionar estes números em:
                      </h4>
                      <div className="space-y-2 sm:space-y-2.5">
                        {compatibleContests.map((contest) => {
                          const addKey = `${contest.id}-${numbers.join('-')}`
                          const isAdding = addingToCart === addKey
                          const isBuying = buyingNow === addKey

                          return (
                            <div
                              key={contest.id}
                              className="flex flex-col gap-3 p-3 sm:p-4 bg-[#F9F9F9] rounded-lg sm:rounded-xl border border-[#E5E5E5]"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-baseline gap-0.5 sm:gap-2">
                                  <span className="font-semibold text-[#1F1F1F] text-sm sm:text-base truncate">
                                    {contest.name}
                                  </span>
                                  {contest.contest_code && (
                                    <span className="text-[10px] sm:text-xs text-[#1F1F1F]/60 font-mono">
                                      ({contest.contest_code})
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-[#1E7F43] font-semibold mt-1">
                                  {formatCurrency(contest.participation_value || 0)}
                                </p>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:flex-shrink-0">
                                <button
                                  onClick={() => handleAddToCart(contest, numbers)}
                                  disabled={isAdding || isBuying}
                                  className="flex-1 sm:flex-initial px-3 py-2 sm:px-4 sm:py-2.5 bg-white border-2 border-[#1E7F43] text-[#1E7F43] rounded-xl font-semibold hover:bg-[#1E7F43]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs sm:text-sm"
                                >
                                  {isAdding ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                      <span>Adicionado!</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                      </svg>
                                      <span className="hidden sm:inline">Adicionar no carrinho</span>
                                      <span className="sm:hidden">Adicionar</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleBuyNow(contest, numbers)}
                                  disabled={isAdding || isBuying}
                                  className="flex-1 sm:flex-initial px-3 py-2 sm:px-4 sm:py-2.5 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs sm:text-sm"
                                >
                                  {isBuying ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                      <span>Indo...</span>
                                    </>
                                  ) : (
                                    'Comprar agora'
                                  )}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-[#1F1F1F]/50 italic">
                      Nenhum concurso ativo compatível com estes números no momento.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {participations.length > 0 && (
          <div className="mt-4 sm:mt-6 flex justify-center px-2">
            <Link
              to="/cart"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors text-sm sm:text-base"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Ir para o Carrinho
            </Link>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}