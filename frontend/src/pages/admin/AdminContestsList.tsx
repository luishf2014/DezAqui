/**
 * Lista de Concursos - Painel Administrativo
 * FASE 1: CRUD de concursos
 * 
 * Página para listar, visualizar e gerenciar todos os concursos
 */
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { listAllContests, deleteContest } from '../../services/contestsService'
import { Contest } from '../../types'

export default function AdminContestsList() {
  const [contests, setContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    loadContests()
  }, [])

  const loadContests = async () => {
    try {
      const data = await listAllContests()
      setContests(data)
    } catch (error) {
      console.error('Erro ao carregar concursos:', error)
      alert('Erro ao carregar concursos. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja deletar o concurso "${name}"?\n\nEsta ação é irreversível!`)) {
      return
    }

    setDeletingId(id)
    try {
      await deleteContest(id)
      await loadContests()
    } catch (error) {
      console.error('Erro ao deletar concurso:', error)
      alert('Erro ao deletar concurso. Tente novamente.')
    } finally {
      setDeletingId(null)
    }
  }

  const filteredContests = filterStatus === 'all'
    ? contests
    : contests.filter(c => c.status === filterStatus)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        {/* Cabeçalho */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F1F1F] mb-2">
              Gerenciar Concursos
            </h1>
            <p className="text-[#1F1F1F]/70">
              Crie, edite e gerencie todos os concursos do sistema
            </p>
          </div>
          <Link
            to="/admin/contests/new"
            className="px-6 py-3 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Concurso
          </Link>
        </div>

        {/* Filtros */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
              filterStatus === 'all'
                ? 'bg-[#1E7F43] text-white'
                : 'bg-white text-[#1F1F1F] border border-[#E5E5E5] hover:border-[#1E7F43]'
            }`}
          >
            Todos ({contests.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
              filterStatus === 'active'
                ? 'bg-[#3CCB7F] text-white'
                : 'bg-white text-[#1F1F1F] border border-[#E5E5E5] hover:border-[#3CCB7F]'
            }`}
          >
            Ativos ({contests.filter(c => c.status === 'active').length})
          </button>
          <button
            onClick={() => setFilterStatus('draft')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
              filterStatus === 'draft'
                ? 'bg-[#F4C430] text-white'
                : 'bg-white text-[#1F1F1F] border border-[#E5E5E5] hover:border-[#F4C430]'
            }`}
          >
            Rascunhos ({contests.filter(c => c.status === 'draft').length})
          </button>
          <button
            onClick={() => setFilterStatus('finished')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
              filterStatus === 'finished'
                ? 'bg-[#1F1F1F] text-white'
                : 'bg-white text-[#1F1F1F] border border-[#E5E5E5] hover:border-[#1F1F1F]'
            }`}
          >
            Finalizados ({contests.filter(c => c.status === 'finished').length})
          </button>
        </div>

        {/* Lista de Concursos */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43]"></div>
          </div>
        ) : filteredContests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-[#1F1F1F]/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-[#1F1F1F]/70 mb-4">
              {filterStatus === 'all' 
                ? 'Nenhum concurso criado ainda.'
                : `Nenhum concurso com status "${filterStatus}".`}
            </p>
            {filterStatus === 'all' && (
              <Link
                to="/admin/contests/new"
                className="inline-block px-6 py-2 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors"
              >
                Criar Primeiro Concurso
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredContests.map((contest) => (
              <div
                key={contest.id}
                className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-[#1F1F1F] mb-2">{contest.name}</h3>
                    {contest.description && (
                      <p className="text-sm text-[#1F1F1F]/70 line-clamp-2 mb-3">
                        {contest.description}
                      </p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ml-4 ${
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
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-[#1F1F1F]/70 mb-1">Números</p>
                    <p className="font-semibold text-[#1F1F1F]">
                      {contest.min_number} - {contest.max_number}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#1F1F1F]/70 mb-1">Por Participação</p>
                    <p className="font-semibold text-[#1F1F1F]">
                      {contest.numbers_per_participation} números
                    </p>
                  </div>
                  <div>
                    <p className="text-[#1F1F1F]/70 mb-1">Início</p>
                    <p className="font-semibold text-[#1F1F1F]">{formatDate(contest.start_date)}</p>
                  </div>
                  <div>
                    <p className="text-[#1F1F1F]/70 mb-1">Fim</p>
                    <p className="font-semibold text-[#1F1F1F]">{formatDate(contest.end_date)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-[#E5E5E5]">
                  <Link
                    to={`/admin/contests/${contest.id}`}
                    className="flex-1 px-4 py-2 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors text-center text-sm"
                  >
                    Editar
                  </Link>
                  <Link
                    to={`/contests/${contest.id}`}
                    className="px-4 py-2 bg-white border border-[#E5E5E5] text-[#1F1F1F] rounded-xl font-semibold hover:border-[#1E7F43] transition-colors text-sm"
                  >
                    Ver
                  </Link>
                  <button
                    onClick={() => handleDelete(contest.id, contest.name)}
                    disabled={deletingId === contest.id}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === contest.id ? 'Deletando...' : 'Deletar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
