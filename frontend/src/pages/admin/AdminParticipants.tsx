/**
 * Admin Participants - Gestão de Participantes
 * FASE 2: Participações e Ranking
 * 
 * Listar participantes, filtrar e ver participações
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { listAllParticipations } from '../../services/participationsService'
import { Participation, Contest } from '../../types'
import { listAllContests } from '../../services/contestsService'

interface ParticipationWithDetails extends Participation {
  contest: Contest | null
  user: { id: string; name: string; email: string } | null
}

interface UserParticipations {
  userId: string
  userName: string
  userEmail: string
  participations: ParticipationWithDetails[]
}

export default function AdminParticipants() {
  const navigate = useNavigate()
  const [participations, setParticipations] = useState<ParticipationWithDetails[]>([])
  const [contests, setContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // MODIFIQUEI AQUI - Filtros
  const [filterContestId, setFilterContestId] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [participationsData, contestsData] = await Promise.all([
        listAllParticipations(),
        listAllContests(),
      ])
      setParticipations(participationsData)
      setContests(contestsData)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar participantes')
    } finally {
      setLoading(false)
    }
  }

  // MODIFIQUEI AQUI - Agrupar participações por usuário
  const groupedByUser = (): UserParticipations[] => {
    const filtered = participations.filter(p => {
      // Filtro por concurso
      if (filterContestId !== 'all' && p.contest_id !== filterContestId) return false
      
      // Filtro por status
      if (filterStatus !== 'all' && p.status !== filterStatus) return false
      
      // Busca por nome, email ou código/ticket
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchesName = p.user?.name?.toLowerCase().includes(query)
        const matchesEmail = p.user?.email?.toLowerCase().includes(query)
        const matchesTicket = p.ticket_code?.toLowerCase().includes(query)
        if (!matchesName && !matchesEmail && !matchesTicket) return false
      }
      
      return true
    })

    // Agrupar por usuário
    const grouped = new Map<string, UserParticipations>()
    
    filtered.forEach(participation => {
      if (!participation.user) return
      
      const userId = participation.user.id
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          userId,
          userName: participation.user.name,
          userEmail: participation.user.email,
          participations: [],
        })
      }
      
      grouped.get(userId)!.participations.push(participation)
    })

    // Ordenar por número de participações (maior primeiro) e depois por nome
    return Array.from(grouped.values()).sort((a, b) => {
      if (b.participations.length !== a.participations.length) {
        return b.participations.length - a.participations.length
      }
      return a.userName.localeCompare(b.userName)
    })
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


  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-[#F4C430]/20 text-[#F4C430]',
      active: 'bg-[#3CCB7F]/20 text-[#3CCB7F]',
      cancelled: 'bg-red-100 text-red-700',
    }
    const labels = {
      pending: 'Pendente',
      active: 'Ativa',
      cancelled: 'Cancelada',
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status as keyof typeof styles] || styles.pending}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    )
  }

  const userGroups = groupedByUser()

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        {/* Cabeçalho */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin')}
            className="text-[#1E7F43] hover:text-[#3CCB7F] font-semibold mb-4 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar ao Dashboard
          </button>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F1F1F] mb-2">
            Participantes
          </h1>
          <p className="text-[#1F1F1F]/70">
            Listar participantes, filtrar e ver participações
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Total de Participantes</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-[#1E7F43]">{loading ? '...' : userGroups.length}</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Total de Participações</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#3CCB7F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-[#3CCB7F]">{loading ? '...' : participations.length}</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Ativas</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#3CCB7F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-[#3CCB7F]">{loading ? '...' : participations.filter(p => p.status === 'active').length}</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Pendentes</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-[#F4C430]">{loading ? '...' : participations.filter(p => p.status === 'pending').length}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6 bg-white rounded-2xl border border-[#E5E5E5] p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="contest-filter" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                Filtrar por Concurso
              </label>
              <select
                id="contest-filter"
                value={filterContestId}
                onChange={(e) => setFilterContestId(e.target.value)}
                className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
              >
                <option value="all">Todos os Concursos</option>
                {contests.map((contest) => (
                  <option key={contest.id} value={contest.id}>
                    {contest.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status-filter" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                Filtrar por Status
              </label>
              <select
                id="status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
              >
                <option value="all">Todos os Status</option>
                <option value="pending">Pendente</option>
                <option value="active">Ativa</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
            <div>
              <label htmlFor="search" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                Buscar (Nome, Email ou Código/Ticket)
              </label>
              <input
                id="search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex: João Silva, joao@email.com ou TKT-20250124-A1B2C3"
                className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Lista de Participantes */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43]"></div>
            <p className="mt-4 text-[#1F1F1F]/70">Carregando participantes...</p>
          </div>
        ) : userGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-[#1F1F1F]/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Nenhum Participante Encontrado</h2>
            <p className="text-[#1F1F1F]/70">
              {searchQuery || filterContestId !== 'all' || filterStatus !== 'all'
                ? 'Nenhum participante corresponde aos filtros aplicados.'
                : 'Ainda não há participantes cadastrados no sistema.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {userGroups.map((userGroup) => (
              <div
                key={userGroup.userId}
                className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm hover:shadow-md transition-all"
              >
                {/* Cabeçalho do Usuário */}
                <div
                  className="p-6 cursor-pointer"
                  onClick={() => setExpandedUserId(expandedUserId === userGroup.userId ? null : userGroup.userId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-[#1F1F1F]">
                          {userGroup.userName}
                        </h3>
                        <span className="px-3 py-1 bg-[#1E7F43]/10 text-[#1E7F43] rounded-lg text-xs font-semibold">
                          {userGroup.participations.length} {userGroup.participations.length === 1 ? 'participação' : 'participações'}
                        </span>
                      </div>
                      <p className="text-sm text-[#1F1F1F]/70">{userGroup.userEmail}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-[#1F1F1F]/60">Ativas</p>
                        <p className="text-lg font-bold text-[#3CCB7F]">
                          {userGroup.participations.filter(p => p.status === 'active').length}
                        </p>
                      </div>
                      <button className="text-[#1E7F43] hover:text-[#3CCB7F] transition-colors">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-6 w-6 transform transition-transform ${expandedUserId === userGroup.userId ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de Participações (Expandida) */}
                {expandedUserId === userGroup.userId && (
                  <div className="border-t border-[#E5E5E5] p-6 space-y-4">
                    {userGroup.participations.map((participation) => (
                      <div
                        key={participation.id}
                        className="bg-[#F9F9F9] rounded-xl p-4 hover:bg-[#F5F5F5] transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-semibold text-[#1F1F1F]">
                                {participation.contest?.name || 'Concurso não encontrado'}
                              </h4>
                              {getStatusBadge(participation.status)}
                            </div>
                            {participation.ticket_code && (
                              <p className="text-xs text-[#1F1F1F]/60 mb-2">
                                Código: <span className="font-mono font-semibold">{participation.ticket_code}</span>
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => participation.contest && navigate(`/contests/${participation.contest_id}`)}
                            className="text-[#1E7F43] hover:text-[#3CCB7F] transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>

                        {/* Números Escolhidos */}
                        <div className="mb-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F1F1F]/60 mb-2">
                            Números Escolhidos
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {participation.numbers.map((num, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-[#F4C430] text-[#1F1F1F] rounded-lg font-bold text-sm"
                              >
                                {num.toString().padStart(2, '0')}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Informações Adicionais */}
                        <div className="flex flex-wrap gap-4 text-xs text-[#1F1F1F]/70">
                          <span>
                            Criada em: {formatDate(participation.created_at)}
                          </span>
                          {participation.current_score > 0 && (
                            <span className="font-semibold text-[#1E7F43]">
                              Pontuação: {participation.current_score}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
