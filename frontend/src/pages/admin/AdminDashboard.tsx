/**
 * Dashboard Administrativo
 * FASE 1: Painel administrativo básico
 * 
 * Página principal do painel administrativo com visão geral do sistema
 */
import { Link } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { useEffect, useState } from 'react'
import { listAllContests } from '../../services/contestsService'
import { listDrawsByContestId } from '../../services/drawsService'
import { getRecentWinners, countRecentWinners, getDrawPayoutSummary, RecentWinner } from '../../services/payoutsService'
import { Contest } from '../../types'

export default function AdminDashboard() {
  const { profile, isAdmin, user, loading: authLoading } = useAuth()
  const [contests, setContests] = useState<Contest[]>([])
  const [topWinnersByContest, setTopWinnersByContest] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [recentWinners, setRecentWinners] = useState<RecentWinner[]>([])
  const [winnersCount, setWinnersCount] = useState(0)
  const [loadingWinners, setLoadingWinners] = useState(true)

  // Debug: Log do estado de autenticação
  useEffect(() => {
    console.log('AdminDashboard - Estado de autenticação:', {
      user: user?.id,
      profile: profile?.id,
      isAdmin,
      authLoading,
      profileData: profile
    })
  }, [user, profile, isAdmin, authLoading])

  useEffect(() => {
    loadContests()
    loadWinners()
  }, [])

  const loadContests = async () => {
    try {
      const data = await listAllContests()
      setContests(data)

      const topWinnersMap: Record<string, number> = {}
      await Promise.all(
        data.map(async (contest) => {
          if (contest.status !== 'finished') return
          try {
            const draws = await listDrawsByContestId(contest.id)
            if (draws.length > 0) {
              const summary = await getDrawPayoutSummary(draws[0].id)
              topWinnersMap[contest.id] = summary.categories.TOP?.winnersCount ?? 0
            }
          } catch {
            topWinnersMap[contest.id] = 0
          }
        })
      )
      setTopWinnersByContest(topWinnersMap)
    } catch (error) {
      console.error('Erro ao carregar concursos:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadWinners = async () => {
    try {
      setLoadingWinners(true)
      const [winners, count] = await Promise.all([
        getRecentWinners(5),
        countRecentWinners(),
      ])
      setRecentWinners(winners)
      setWinnersCount(count)
    } catch (error) {
      console.error('Erro ao carregar ganhadores:', error)
    } finally {
      setLoadingWinners(false)
    }
  }

  const stats = {
    total: contests.length,
    active: contests.filter(c => c.status === 'active').length,
    draft: contests.filter(c => c.status === 'draft').length,
    finished: contests.filter(c => c.status === 'finished').length,
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        {/* Cabeçalho do Dashboard */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F1F1F] mb-2">
            Painel Administrativo
          </h1>
          <p className="text-[#1F1F1F]/70">
            Bem-vindo, {profile?.name || 'Administrador'}! Gerencie seus concursos e participantes.
          </p>
        </div>

        {/* Notificação de Ganhadores (se houver) */}
        {winnersCount > 0 && (
          <div className="mb-6 animate-pulse">
            <Link
              to="/admin/reports"
              className="block bg-gradient-to-r from-[#F4C430] to-[#FFD700] rounded-2xl border-2 border-[#F4C430] p-6 shadow-lg hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/30 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#1F1F1F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#1F1F1F]">
                    {winnersCount === 1 ? 'Novo Ganhador!' : `${winnersCount} Novos Ganhadores!`}
                  </h3>
                  <p className="text-sm text-[#1F1F1F]/80">
                    {winnersCount === 1
                      ? 'Um participante atingiu a pontuação máxima nas últimas 24h.'
                      : `${winnersCount} participantes atingiram pontuação máxima nas últimas 24h.`}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[#1F1F1F] font-semibold">
                  Ver Relatório
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Total de Concursos</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-[#1F1F1F]">{loading ? '...' : stats.total}</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Ativos</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#3CCB7F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-[#3CCB7F]">{loading ? '...' : stats.active}</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Rascunhos</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-[#F4C430]">{loading ? '...' : stats.draft}</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Finalizados</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1F1F1F]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-[#1F1F1F]/50">{loading ? '...' : stats.finished}</p>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm mb-8">
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Ações Rápidas</h2>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/admin/contests/new"
              className="px-6 py-3 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Criar Novo Concurso
            </Link>
            <Link
              to="/admin/contests"
              className="px-6 py-3 bg-white border-2 border-[#1E7F43] text-[#1E7F43] rounded-xl font-semibold hover:bg-[#F9F9F9] transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Gerenciar Concursos
            </Link>
          </div>
        </div>

        {/* Seção de Ganhadores Recentes */}
        {recentWinners.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#F4C430]/20 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[#1F1F1F]">Ganhadores Recentes</h2>
              </div>
              <Link
                to="/admin/reports"
                className="text-sm text-[#1E7F43] font-semibold hover:underline"
              >
                Ver todos
              </Link>
            </div>

            {loadingWinners ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#F4C430]"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {recentWinners.map((winner) => (
                  <div
                    key={winner.id}
                    className="p-4 rounded-xl bg-gradient-to-r from-[#F4C430]/10 to-transparent border border-[#F4C430]/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#F4C430] rounded-full flex items-center justify-center text-white font-bold">
                          {winner.user_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <h4 className="font-semibold text-[#1F1F1F]">{winner.user_name}</h4>
                          <p className="text-sm text-[#1F1F1F]/70">
                            {winner.contest_name}
                            {winner.draw_date && (
                              <span className="ml-2 text-xs text-[#1F1F1F]/50">
                                {new Date(winner.draw_date).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-[#F4C430] text-[#1F1F1F] rounded-lg text-xs font-bold">
                            {winner.score} pts
                          </span>
                          <span className="px-2 py-1 bg-[#1E7F43] text-white rounded-lg text-xs font-bold">
                            TOP
                          </span>
                        </div>
                        <p className="text-sm font-bold text-[#1E7F43] mt-1">
                          R$ {winner.amount_won.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Seção de Módulos Administrativos */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm mb-8">
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Módulos Administrativos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              to="/admin/contests"
              className="p-4 rounded-xl border border-[#E5E5E5] hover:border-[#1E7F43] hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#1E7F43]/10 rounded-lg group-hover:bg-[#1E7F43]/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[#1F1F1F]">Gestão de Concursos</h3>
              </div>
              <p className="text-sm text-[#1F1F1F]/70">Criar, editar e gerenciar concursos</p>
            </Link>

            <Link
              to="/admin/draws"
              className="p-4 rounded-xl border border-[#E5E5E5] hover:border-[#1E7F43] hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#F4C430]/10 rounded-lg group-hover:bg-[#F4C430]/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[#1F1F1F]">Sorteios Múltiplos</h3>
              </div>
              <p className="text-sm text-[#1F1F1F]/70">Gerenciar sorteios com datas/horários</p>
            </Link>

            <Link
              to="/admin/participants"
              className="p-4 rounded-xl border border-[#E5E5E5] hover:border-[#1E7F43] hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#3CCB7F]/10 rounded-lg group-hover:bg-[#3CCB7F]/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#3CCB7F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[#1F1F1F]">Participantes</h3>
              </div>
              <p className="text-sm text-[#1F1F1F]/70">Listar e gerenciar participantes</p>
            </Link>

            <Link
              to="/admin/activations"
              className="p-4 rounded-xl border border-[#E5E5E5] hover:border-[#1E7F43] hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#1E7F43]/10 rounded-lg group-hover:bg-[#1E7F43]/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[#1F1F1F]">Ativações</h3>
              </div>
              <p className="text-sm text-[#1F1F1F]/70">Ativar participações manual/offline</p>
            </Link>

            <Link
              to="/admin/finance"
              className="p-4 rounded-xl border border-[#E5E5E5] hover:border-[#1E7F43] hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#F4C430]/10 rounded-lg group-hover:bg-[#F4C430]/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[#1F1F1F]">Financeiro</h3>
              </div>
              <p className="text-sm text-[#1F1F1F]/70">Taxas, parametrização e valores</p>
            </Link>

            <Link
              to="/admin/reports"
              className="p-4 rounded-xl border border-[#E5E5E5] hover:border-[#1E7F43] hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#3CCB7F]/10 rounded-lg group-hover:bg-[#3CCB7F]/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#3CCB7F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[#1F1F1F]">Relatórios</h3>
              </div>
              <p className="text-sm text-[#1F1F1F]/70">Arrecadação, rateio e exportações</p>
            </Link>
          </div>
        </div>

        {/* Concursos Recentes */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#1F1F1F]">Concursos Recentes</h2>
            <Link
              to="/admin/contests"
              className="text-sm text-[#1E7F43] font-semibold hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E7F43]"></div>
            </div>
          ) : contests.length === 0 ? (
            <div className="text-center py-8">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[#1F1F1F]/30 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-[#1F1F1F]/70 mb-4">Nenhum concurso criado ainda.</p>
              <Link
                to="/admin/contests/new"
                className="inline-block px-6 py-2 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors"
              >
                Criar Primeiro Concurso
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {contests.slice(0, 5).map((contest) => (
                <Link
                  key={contest.id}
                  to={`/admin/contests/${contest.id}`}
                  className="block p-4 rounded-xl border border-[#E5E5E5] hover:border-[#1E7F43] hover:shadow-md transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#1F1F1F] mb-1">{contest.name}</h3>
                      {contest.contest_code && (
                        <p className="text-xs text-[#1F1F1F]/70 mb-1 font-mono">
                          Código: {contest.contest_code}
                        </p>
                      )}
                      <p className="text-sm text-[#1F1F1F]/70 line-clamp-1">{contest.description || 'Sem descrição'}</p>
                      {contest.status === 'finished' && topWinnersByContest[contest.id] !== undefined && (
                        <p className="text-xs sm:text-sm font-semibold text-[#1F1F1F] mt-1">
                          {topWinnersByContest[contest.id] === 0
                            ? 'Nenhuma pessoa atingiu a pontuação máxima do sorteio'
                            : `${topWinnersByContest[contest.id]} ${topWinnersByContest[contest.id] === 1 ? 'pessoa atingiu' : 'pessoas atingiram'} a pontuação máxima do sorteio`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        contest.status === 'active' ? 'bg-[#3CCB7F]/20 text-[#3CCB7F]' :
                        contest.status === 'draft' ? 'bg-[#F4C430]/20 text-[#F4C430]' :
                        contest.status === 'finished' ? 'bg-[#1F1F1F]/10 text-[#1F1F1F]/70' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {contest.status === 'active' ? 'Ativo' :
                         contest.status === 'draft' ? 'Rascunho' :
                         contest.status === 'finished' ? 'Finalizado' :
                         'Cancelado'}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1F1F1F]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
