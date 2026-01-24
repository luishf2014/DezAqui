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
import { Contest } from '../../types'

export default function AdminDashboard() {
  const { profile, isAdmin, user, loading: authLoading } = useAuth()
  const [contests, setContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)

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
  }, [])

  const loadContests = async () => {
    try {
      const data = await listAllContests()
      setContests(data)
    } catch (error) {
      console.error('Erro ao carregar concursos:', error)
    } finally {
      setLoading(false)
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
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#1F1F1F] mb-1">{contest.name}</h3>
                      <p className="text-sm text-[#1F1F1F]/70 line-clamp-1">{contest.description || 'Sem descrição'}</p>
                    </div>
                    <div className="flex items-center gap-3">
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
