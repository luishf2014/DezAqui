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
import CustomSelect from '../../components/CustomSelect'
import { listAllParticipations } from '../../services/participationsService'
import { Participation, Contest, User } from '../../types'
import { listAllContests } from '../../services/contestsService'
import { listAllUsers } from '../../services/profilesService'
import { formatPhoneBR, navigateToTop } from '../../utils/formatters'
import {
  exportParticipantsDirectoryToCSV,
  exportParticipantsDirectoryToExcel,
  exportParticipantsDirectoryToPDF,
} from '../../utils/exportUtils'

interface ParticipationWithDetails extends Participation {
  contest: Contest | null
  user: { id: string; name: string; email: string } | null
}

interface UserParticipations {
  userId: string
  userName: string
  userEmail: string
  userPhone?: string
  participations: ParticipationWithDetails[]
}

export default function AdminParticipants() {
  const navigate = useNavigate()
  const [participations, setParticipations] = useState<ParticipationWithDetails[]>([])
  const [contests, setContests] = useState<Contest[]>([])
  const [users, setUsers] = useState<User[]>([])
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
      const [participationsData, contestsData, usersData] = await Promise.all([
        listAllParticipations(),
        listAllContests(),
        listAllUsers(),
      ])
      setParticipations(participationsData)
      setContests(contestsData)
      setUsers(usersData)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar participantes')
    } finally {
      setLoading(false)
    }
  }

  // MODIFIQUEI AQUI - Agrupar participações por usuário, incluindo usuários sem participações
  const groupedByUser = (): UserParticipations[] => {
    // Filtrar participações primeiro
    const filteredParticipations = participations.filter(p => {
      // Filtro por concurso
      if (filterContestId !== 'all' && p.contest_id !== filterContestId) return false
      
      // Filtro por status
      if (filterStatus !== 'all' && p.status !== filterStatus) return false
      
      return true
    })

    // Criar mapa de usuários com suas participações
    const grouped = new Map<string, UserParticipations>()
    
    // Se não há filtro de status, mostrar todos os usuários (mesmo sem participações)
    if (filterStatus === 'all') {
      users.forEach(user => {
        grouped.set(user.id, {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userPhone: user.phone,
          participations: [],
        })
      })
    }
    
    // Adicionar as participações filtradas aos usuários correspondentes
    filteredParticipations.forEach(participation => {
      if (!participation.user) return
      
      const userId = participation.user.id
      
      // Se não existe o usuário no mapa, criar (acontece quando há filtro de status)
      if (!grouped.has(userId)) {
        const user = users.find(u => u.id === userId)
        if (user) {
          grouped.set(userId, {
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            userPhone: user.phone,
            participations: [],
          })
        }
      }
      
      // Adicionar a participação
      if (grouped.has(userId)) {
        grouped.get(userId)!.participations.push(participation)
      }
    })

    // Aplicar filtro de busca por nome, email, telefone ou código/ticket
    let result = Array.from(grouped.values())
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(userGroup => {
        // Busca por dados do usuário
        const matchesName = userGroup.userName?.toLowerCase().includes(query)
        const matchesEmail = userGroup.userEmail?.toLowerCase().includes(query)
        const matchesPhone = userGroup.userPhone?.toLowerCase().includes(query)
        
        // Busca por código de ticket nas participações
        const matchesTicket = userGroup.participations.some(p => 
          p.ticket_code?.toLowerCase().includes(query)
        )
        
        return matchesName || matchesEmail || matchesPhone || matchesTicket
      })
    }

    // Ordenar por número de participações (maior primeiro) e depois por nome
    return result.sort((a, b) => {
      if (b.participations.length !== a.participations.length) {
        return b.participations.length - a.participations.length
      }
      return a.userName.localeCompare(b.userName)
    })
  }

  const formatDateWithTime = (dateString: string) => {
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

  const buildParticipantExportRows = () =>
    userGroups.map((g) => {
      const u = users.find((x) => x.id === g.userId)
      const registrationDate = u?.created_at
        ? new Date(u.created_at).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—'
      return {
        name: g.userName?.trim() || '—',
        phone: formatPhoneBR(g.userPhone) || '—',
        email: g.userEmail?.trim() || '—',
        registrationDate,
      }
    })

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        {/* Cabeçalho */}
        <div className="mb-6">
          <button
            onClick={() => navigateToTop(navigate, '/admin')}
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
            <p className="text-3xl font-bold text-[#1E7F43]">{loading ? '...' : users.length}</p>
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

        {/* Filtros + exportação (PDF integrado ao mesmo bloco) */}
        <div className="mb-6 bg-white rounded-2xl border border-[#E5E5E5] p-4 sm:p-6 shadow-sm">
          <div className="mb-4 pb-4 border-b border-[#E5E5E5]">
            <h2 className="text-base font-bold text-[#1F1F1F]">Filtros e busca</h2>
            <p className="text-sm text-[#1F1F1F]/60 mt-1">
              Ajuste concurso, status e texto de busca. A lista abaixo e o PDF seguem estes filtros.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="contest-filter" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                Filtrar por Concurso
              </label>
              <CustomSelect
                id="contest-filter"
                value={filterContestId}
                onChange={setFilterContestId}
                options={[
                  { value: 'all', label: 'Todos os Concursos' },
                  ...contests.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
            <div>
              <label htmlFor="status-filter" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                Filtrar por Status
              </label>
              <CustomSelect
                id="status-filter"
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: 'all', label: 'Todos os Status' },
                  { value: 'pending', label: 'Pendente' },
                  { value: 'active', label: 'Ativa' }
                ]}
              />
            </div>
            <div>
              <label htmlFor="search" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                Buscar (Nome, Email, Telefone ou Código/Ticket)
              </label>
              <input
                id="search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex: João Silva, joao@email.com, (11) 99999-9999 ou TK-A1B2C3"
                className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-[#E5E5E5] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 rounded-xl bg-[#F9F9F9]/80 px-4 py-4 border border-[#E5E5E5]/80">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1F1F1F]">Exportar lista</p>
              <p className="text-xs text-[#1F1F1F]/60 mt-0.5">
                PDF, Excel (.xlsx) ou CSV — colunas: nome, telefone, data de cadastro e e-mail. Apenas participantes visíveis com os filtros atuais.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:items-center shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => exportParticipantsDirectoryToPDF(buildParticipantExportRows())}
                disabled={loading || userGroups.length === 0}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E7F43] text-white font-semibold text-sm shadow-sm hover:bg-[#3CCB7F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full sm:w-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Exportar PDF
              </button>
              <button
                type="button"
                onClick={() => exportParticipantsDirectoryToExcel(buildParticipantExportRows())}
                disabled={loading || userGroups.length === 0}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-[#1E7F43] bg-white text-[#1E7F43] font-semibold text-sm shadow-sm hover:bg-[#E8F5EF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full sm:w-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Excel
              </button>
              <button
                type="button"
                onClick={() => exportParticipantsDirectoryToCSV(buildParticipantExportRows())}
                disabled={loading || userGroups.length === 0}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-[#1E7F43] bg-white text-[#1E7F43] font-semibold text-sm shadow-sm hover:bg-[#E8F5EF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full sm:w-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV
              </button>
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
            <p className="mt-4 text-[#1F1F1F]/70">Carregando usuários e participações...</p>
          </div>
        ) : userGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-[#1F1F1F]/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Nenhum Usuário Encontrado</h2>
            <p className="text-[#1F1F1F]/70">
              {searchQuery || filterContestId !== 'all' || filterStatus !== 'all'
                ? 'Nenhum usuário corresponde aos filtros aplicados.'
                : 'Ainda não há usuários cadastrados no sistema.'}
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
                      {userGroup.userPhone && (
                        <p className="text-sm text-[#1F1F1F]/70">{formatPhoneBR(userGroup.userPhone)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {(() => {
                        const pendingCount = userGroup.participations.filter(p => p.status === 'pending').length
                        const activeCount = userGroup.participations.filter(p => p.status === 'active').length
                        
                        return (
                          <div className="flex items-center gap-4">
                            {pendingCount > 0 && (
                              <div className="text-right">
                                <p className="text-xs text-[#1F1F1F]/60">Pendentes</p>
                                <p className="text-lg font-bold text-[#F4C430]">
                                  {pendingCount}
                                </p>
                              </div>
                            )}
                            {activeCount > 0 && (
                              <div className="text-right">
                                <p className="text-xs text-[#1F1F1F]/60">Ativas</p>
                                <p className="text-lg font-bold text-[#3CCB7F]">
                                  {activeCount}
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      })()}
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
                    {(() => {
                      // Separar participações por status
                      const pendingParticipations = userGroup.participations.filter(p => p.status === 'pending')
                      const activeParticipations = userGroup.participations.filter(p => p.status === 'active')
                      const totalParticipations = userGroup.participations.length
                      
                      // Se não há participações
                      if (totalParticipations === 0) {
                        return (
                          <div className="text-center py-6">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[#1F1F1F]/20 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-sm text-[#1F1F1F]/60">Nenhuma participação encontrada</p>
                          </div>
                        )
                      }
                      
                      return (
                        <div className="space-y-6">
                          {/* Seção de Participações Pendentes */}
                          {pendingParticipations.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#E5E5E5]">
                                <h5 className="text-sm font-bold text-[#1F1F1F] uppercase tracking-[0.1em]">
                                  {pendingParticipations.length} Participaç{pendingParticipations.length === 1 ? 'ão' : 'ões'} Pendente{pendingParticipations.length === 1 ? '' : 's'}
                                </h5>
                                <span className="px-2 py-1 bg-[#F4C430]/20 text-[#F4C430] rounded-full text-xs font-semibold">
                                  Clique para ativar
                                </span>
                              </div>
                              <div className="space-y-4">
                                {pendingParticipations.map((participation) => (
                        <div
                        key={participation.id}
                        className={`bg-[#F9F9F9] rounded-xl p-4 transition-colors ${
                          participation.status === 'pending' 
                            ? 'hover:bg-[#F4C430]/10 cursor-pointer border-2 border-transparent hover:border-[#F4C430]/20' 
                            : 'hover:bg-[#F5F5F5]'
                        }`}
                        onClick={() => {
                          if (participation.status === 'pending') {
                            navigateToTop(navigate, '/admin/activations')
                          }
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex-1">
                                <h4 className="font-semibold text-[#1F1F1F] flex items-center gap-2">
                                  {participation.contest?.name || 'Concurso não encontrado'}
                                  {participation.status === 'pending' && (
                                    <span className="text-xs bg-[#F4C430]/20 text-[#F4C430] px-2 py-1 rounded-full font-normal">
                                      Clique para ativar
                                    </span>
                                  )}
                                </h4>
                                {/* MODIFIQUEI AQUI - Exibir código do concurso */}
                                {participation.contest?.contest_code && (
                                  <p className="text-xs text-[#1F1F1F]/60 mt-1 font-mono">
                                    Código do Concurso: {participation.contest.contest_code}
                                  </p>
                                )}
                              </div>
                              {getStatusBadge(participation.status)}
                            </div>
                            {participation.ticket_code && (
                              <p className="text-xs text-[#1F1F1F]/60 mb-2">
                                Código: <span className="font-mono font-semibold">{participation.ticket_code}</span>
                              </p>
                            )}
                          </div>
                          <button
            onClick={(e) => {
              e.stopPropagation()
              if (participation.contest) {
                navigateToTop(navigate, `/contests/${participation.contest_id}`)
              }
            }}
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
                            Criada em: {formatDateWithTime(participation.created_at)}
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
                            </div>
                          )}

                          {/* Seção de Participações Ativas */}
                          {activeParticipations.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#E5E5E5]">
                                <h5 className="text-sm font-bold text-[#1F1F1F] uppercase tracking-[0.1em]">
                                  {activeParticipations.length} Participaç{activeParticipations.length === 1 ? 'ão' : 'ões'} Ativa{activeParticipations.length === 1 ? '' : 's'}
                                </h5>
                              </div>
                              <div className="space-y-4">
                                {activeParticipations.map((participation) => (
                                  <div
                                    key={participation.id}
                                    className="bg-[#F9F9F9] rounded-xl p-4 hover:bg-[#F5F5F5] transition-colors"
                                  >
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                          <div className="flex-1">
                                            <h4 className="font-semibold text-[#1F1F1F]">
                                              {participation.contest?.name || 'Concurso não encontrado'}
                                            </h4>
                                            {participation.contest?.contest_code && (
                                              <p className="text-xs text-[#1F1F1F]/60 mt-1 font-mono">
                                                Código do Concurso: {participation.contest.contest_code}
                                              </p>
                                            )}
                                          </div>
                                          {getStatusBadge(participation.status)}
                                        </div>
                                        {participation.ticket_code && (
                                          <p className="text-xs text-[#1F1F1F]/60 mb-2">
                                            Código: <span className="font-mono font-semibold">{participation.ticket_code}</span>
                                          </p>
                                        )}
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (participation.contest) {
                                            navigateToTop(navigate, `/contests/${participation.contest_id}`)
                                          }
                                        }}
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
                                        Criada em: {formatDateWithTime(participation.created_at)}
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
                            </div>
                          )}
                        </div>
                      )
                    })()}
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
