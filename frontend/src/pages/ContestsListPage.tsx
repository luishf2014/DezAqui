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

export default function ContestsListPage() {
  const [contests, setContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadContests() {
      try {
        setLoading(true)
        setError(null)
        const data = await listActiveContests()
        setContests(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar concursos')
      } finally {
        setLoading(false)
      }
    }

    loadContests()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando concursos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-2">⚠️ Erro</div>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Concursos Ativos
        </h1>

        {contests.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 text-lg">
              Nenhum concurso ativo no momento.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contests.map((contest) => (
              <div
                key={contest.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-3">
                  {contest.name}
                </h2>

                {contest.description && (
                  <p className="text-gray-600 text-sm mb-4">
                    {contest.description}
                  </p>
                )}

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Intervalo numérico:</span>
                    <span className="font-medium">
                      {contest.min_number} - {contest.max_number}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Números por participação:</span>
                    <span className="font-medium">
                      {contest.numbers_per_participation}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                      {contest.status}
                    </span>
                  </div>
                </div>

                <Link
                  to={`/contests/${contest.id}`}
                  className="block w-full text-center bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
                >
                  Ver detalhes
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
