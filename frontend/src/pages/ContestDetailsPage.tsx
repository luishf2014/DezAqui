/**
 * Página de detalhes de um concurso
 * FASE 2: Participações e Ranking
 * 
 * Exibe informações do concurso e histórico de sorteios
 */
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getContestById } from '../services/contestsService'
import { listDrawsByContestId } from '../services/drawsService'
import { Contest, Draw } from '../types'
import { useAuth } from '../contexts/AuthContext'

export default function ContestDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [contest, setContest] = useState<Contest | null>(null)
  const [draws, setDraws] = useState<Draw[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadContestData() {
      if (!id) {
        setError('ID do concurso não fornecido')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Carregar concurso e sorteios em paralelo
        const [contestData, drawsData] = await Promise.all([
          getContestById(id),
          listDrawsByContestId(id),
        ])

        if (!contestData) {
          setError('Concurso não encontrado')
          return
        }

        setContest(contestData)
        setDraws(drawsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    loadContestData()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando concurso...</p>
        </div>
      </div>
    )
  }

  if (error || !contest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-2">⚠️ Erro</div>
          <p className="text-gray-700 mb-4">{error || 'Concurso não encontrado'}</p>
          <Link
            to="/contests"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Voltar para lista de concursos
          </Link>
        </div>
      </div>
    )
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <Link
          to="/contests"
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Voltar para concursos
        </Link>

        {/* Cabeçalho do concurso */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {contest.name}
              </h1>
              {contest.description && (
                <p className="text-gray-600">{contest.description}</p>
              )}
            </div>
            {/* CHATGPT: Botão Participar adicionado */}
            {user && contest.status === 'active' && (
              <Link
                to={`/contests/${id}/join`}
                className="ml-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
              >
                Participar
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600">Intervalo numérico:</span>
              <span className="ml-2 font-medium">
                {contest.min_number} - {contest.max_number}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Números por participação:</span>
              <span className="ml-2 font-medium">
                {contest.numbers_per_participation}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Data de início:</span>
              <span className="ml-2 font-medium">
                {formatDate(contest.start_date)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Data de encerramento:</span>
              <span className="ml-2 font-medium">
                {formatDate(contest.end_date)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                {contest.status}
              </span>
            </div>
          </div>
        </div>

        {/* Histórico de sorteios */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Histórico de Sorteios
          </h2>

          {draws.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              Nenhum sorteio realizado ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {draws.map((draw) => (
                <div
                  key={draw.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Sorteio realizado em {formatDate(draw.draw_date)}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Criado em {formatDate(draw.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-2">Números sorteados:</p>
                    <div className="flex flex-wrap gap-2">
                      {draw.numbers
                        .sort((a, b) => a - b)
                        .map((number) => (
                          <span
                            key={number}
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                          >
                            {number}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
