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
import Header from '../components/Header'
import Footer from '../components/Footer'

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
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto"></div>
            <p className="mt-4 text-[#1F1F1F]/70">Carregando concurso...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (error && !contest) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1 px-4">
          <div className="text-center">
            <div className="text-red-600 text-xl mb-2">⚠️ Erro</div>
            <p className="text-[#1F1F1F]/70 mb-4">{error}</p>
            <Link
              to="/contests"
              className="text-[#1E7F43] hover:text-[#3CCB7F] underline font-semibold"
            >
              Voltar para lista de concursos
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1 px-4">
          <div className="text-center">
            <div className="text-red-600 text-xl mb-2">⚠️ Autenticação necessária</div>
            <p className="text-[#1F1F1F]/70 mb-4">
              Você precisa estar logado para participar de concursos
            </p>
            <Link
              to="/contests"
              className="text-[#1E7F43] hover:text-[#3CCB7F] underline font-semibold"
            >
              Voltar para lista de concursos
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (!contest) return null

  if (success) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1 px-4">
          <div className="text-center rounded-3xl border border-[#E5E5E5] bg-white p-8 shadow-xl">
            <div className="text-[#1E7F43] text-4xl mb-4">✓</div>
            <h2 className="text-2xl font-extrabold text-[#1F1F1F] mb-2">
              Participação criada com sucesso!
            </h2>
            <p className="text-[#1F1F1F]/70 mb-4">
              Status: <span className="font-semibold text-[#1E7F43]">Pendente</span>
            </p>
            <p className="text-sm text-[#1F1F1F]/60">
              Redirecionando para o concurso...
            </p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 md:py-8 flex-1 max-w-4xl">
        <Link
          to={`/contests/${id}`}
          className="text-[#1E7F43] hover:text-[#3CCB7F] mb-4 inline-block font-semibold transition-colors text-sm sm:text-base"
        >
          <span className="hidden sm:inline">← Voltar para o concurso</span>
          <span className="sm:hidden">← Voltar</span>
        </Link>

        <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-4 sm:p-6 mb-6 shadow-xl">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#1F1F1F] mb-2">
            Participar: {contest.name}
          </h1>
          {contest.description && (
            <p className="text-[#1F1F1F]/70 mb-4">{contest.description}</p>
          )}

          <div className="rounded-2xl border border-[#E5E5E5] bg-[#F9F9F9] p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-[#1F1F1F]/60">Intervalo numérico:</span>
                <span className="ml-2 font-semibold">
                  <span className="px-2 py-1 bg-[#F4C430] text-[#1F1F1F] rounded font-bold">{contest.min_number}</span>
                  {' - '}
                  <span className="px-2 py-1 bg-[#F4C430] text-[#1F1F1F] rounded font-bold">{contest.max_number}</span>
                </span>
              </div>
              <div>
                <span className="text-[#1F1F1F]/60">Números por participação:</span>
                <span className="ml-2 px-2 py-1 bg-[#F4C430] text-[#1F1F1F] rounded font-bold">
                  {contest.numbers_per_participation}
                </span>
              </div>
              <div>
                <span className="text-[#1F1F1F]/60">Status:</span>
                <span className="ml-2 px-3 py-1 bg-[#3CCB7F]/20 text-[#1E7F43] rounded-full text-xs font-semibold">
                  {contest.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-4 sm:p-6 shadow-xl">
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#1F1F1F] mb-4">
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
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              type="submit"
              disabled={
                submitting ||
                selectedNumbers.length !== contest.numbers_per_participation
              }
              className={`
                w-full sm:flex-1 py-3 px-6 rounded-xl font-semibold transition-colors shadow-lg text-sm sm:text-base
                ${
                  submitting ||
                  selectedNumbers.length !== contest.numbers_per_participation
                    ? 'bg-[#E5E5E5] text-[#1F1F1F]/60 cursor-not-allowed'
                    : 'bg-[#1E7F43] text-white hover:bg-[#3CCB7F]'
                }
              `}
            >
              {submitting ? 'Criando participação...' : 'Confirmar participação'}
            </button>
            <Link
              to={`/contests/${id}`}
              className="w-full sm:w-auto py-3 px-6 rounded-xl font-semibold bg-[#E5E5E5] text-[#1F1F1F] hover:bg-[#E5E5E5]/80 transition-colors text-center text-sm sm:text-base"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  )
}
