/**
 * Página de participação em concurso
 * FASE 2: Participações e Ranking
 * 
 * Permite que usuários escolham números e participem de um concurso
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getContestById } from '../services/contestsService'
import { createParticipation } from '../services/participationsService'
import { Contest } from '../types'
import NumberPicker from '../components/NumberPicker'
import { useAuth } from '../contexts/AuthContext'

export default function JoinContestPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [contest, setContest] = useState<Contest | null>(null)
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function loadContest() {
      if (!id) {
        setError('ID do concurso não fornecido')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const contestData = await getContestById(id)

        if (!contestData) {
          setError('Concurso não encontrado')
          return
        }

        if (contestData.status !== 'active') {
          setError('Este concurso não está ativo para participação')
          return
        }

        setContest(contestData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar concurso')
      } finally {
        setLoading(false)
      }
    }

    loadContest()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!contest || !id) return

    // Validação no frontend
    if (selectedNumbers.length !== contest.numbers_per_participation) {
      setError(
        `Você deve selecionar exatamente ${contest.numbers_per_participation} números`
      )
      return
    }

    // Validar intervalo
    const invalidNumbers = selectedNumbers.filter(
      (n) => n < contest.min_number || n > contest.max_number
    )
    if (invalidNumbers.length > 0) {
      setError(
        `Números fora do intervalo permitido (${contest.min_number} - ${contest.max_number})`
      )
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      await createParticipation({
        contestId: id,
        numbers: selectedNumbers,
      })

      setSuccess(true)
      
      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate(`/contests/${id}`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar participação')
    } finally {
      setSubmitting(false)
    }
  }

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

  if (error && !contest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-2">⚠️ Erro</div>
          <p className="text-gray-700 mb-4">{error}</p>
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

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-2">⚠️ Autenticação necessária</div>
          <p className="text-gray-700 mb-4">
            Você precisa estar logado para participar de concursos
          </p>
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

  if (!contest) return null

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-green-600 text-4xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Participação criada com sucesso!
          </h2>
          <p className="text-gray-600 mb-4">
            Status: <span className="font-medium">Pendente</span>
          </p>
          <p className="text-sm text-gray-500">
            Redirecionando para o concurso...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <Link
          to={`/contests/${id}`}
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Voltar para o concurso
        </Link>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Participar: {contest.name}
          </h1>
          {contest.description && (
            <p className="text-gray-600 mb-4">{contest.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
              <span className="text-gray-600">Status:</span>
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                {contest.status}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Escolha seus números
          </h2>

          <NumberPicker
            min={contest.min_number}
            max={contest.max_number}
            maxSelected={contest.numbers_per_participation}
            selectedNumbers={selectedNumbers}
            onChange={setSelectedNumbers}
          />

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="mt-6 flex gap-4">
            <button
              type="submit"
              disabled={
                submitting ||
                selectedNumbers.length !== contest.numbers_per_participation
              }
              className={`
                flex-1 py-3 px-6 rounded-lg font-medium transition-colors
                ${
                  submitting ||
                  selectedNumbers.length !== contest.numbers_per_participation
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }
              `}
            >
              {submitting ? 'Criando participação...' : 'Confirmar participação'}
            </button>
            <Link
              to={`/contests/${id}`}
              className="py-3 px-6 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
