/**
 * Formulário de Criar/Editar Concurso - Painel Administrativo
 * FASE 1: CRUD de concursos
 * 
 * Formulário para criar novos concursos ou editar existentes
 */
import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { getContestById, createContest, updateContest, CreateContestInput, UpdateContestInput } from '../../services/contestsService'

export default function AdminContestForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<CreateContestInput>({
    name: '',
    description: '',
    min_number: 1,
    max_number: 60,
    numbers_per_participation: 6,
    start_date: '',
    end_date: '',
    status: 'draft',
    participation_value: undefined,
  })

  useEffect(() => {
    if (isEditing && id) {
      loadContest()
    }
  }, [id, isEditing])

  const loadContest = async () => {
    if (!id) return

    try {
      setLoading(true)
      const contest = await getContestById(id)
      if (!contest) {
        setError('Concurso não encontrado')
        return
      }

      // Converter datas para formato de input (YYYY-MM-DDTHH:mm)
      const startDate = new Date(contest.start_date)
      const endDate = new Date(contest.end_date)

      setFormData({
        name: contest.name,
        description: contest.description || '',
        min_number: contest.min_number,
        max_number: contest.max_number,
        numbers_per_participation: contest.numbers_per_participation,
        start_date: startDate.toISOString().slice(0, 16),
        end_date: endDate.toISOString().slice(0, 16),
        status: contest.status,
        participation_value: contest.participation_value || undefined,
      })
    } catch (err) {
      console.error('Erro ao carregar concurso:', err)
      setError('Erro ao carregar concurso. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      // Validações
      if (!formData.name.trim()) {
        throw new Error('O nome do concurso é obrigatório')
      }

      if (formData.min_number >= formData.max_number) {
        throw new Error('O número mínimo deve ser menor que o número máximo')
      }

      if (formData.numbers_per_participation > (formData.max_number - formData.min_number + 1)) {
        throw new Error('A quantidade de números por participação não pode ser maior que o intervalo disponível')
      }

      const startDate = new Date(formData.start_date)
      const endDate = new Date(formData.end_date)

      if (endDate <= startDate) {
        throw new Error('A data de término deve ser posterior à data de início')
      }

      if (isEditing && id) {
        const updateData: UpdateContestInput = {
          name: formData.name,
          description: formData.description || undefined,
          min_number: formData.min_number,
          max_number: formData.max_number,
          numbers_per_participation: formData.numbers_per_participation,
          start_date: formData.start_date,
          end_date: formData.end_date,
          status: formData.status,
          participation_value: formData.participation_value || undefined,
        }
        await updateContest(id, updateData)
      } else {
        await createContest(formData)
      }

      navigate('/admin/contests')
    } catch (err) {
      console.error('Erro ao salvar concurso:', err)
      setError(err instanceof Error ? err.message : 'Erro ao salvar concurso. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'min_number' || name === 'max_number' || name === 'numbers_per_participation' || name === 'participation_value'
        ? value === '' ? undefined : Number(value)
        : value,
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mb-4"></div>
            <p className="text-[#1F1F1F]">Carregando...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
        {/* Cabeçalho */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/contests')}
            className="text-[#1E7F43] hover:text-[#3CCB7F] font-semibold mb-4 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar para lista
          </button>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F1F1F] mb-2">
            {isEditing ? 'Editar Concurso' : 'Criar Novo Concurso'}
          </h1>
          <p className="text-[#1F1F1F]/70">
            {isEditing ? 'Atualize as informações do concurso' : 'Preencha os dados para criar um novo concurso'}
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E5E5E5] p-6 sm:p-8 shadow-sm">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm font-semibold">{error}</p>
            </div>
          )}

          {/* Nome */}
          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
              Nome do Concurso <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
              placeholder="Ex: Mega Sena DezAqui"
            />
          </div>

          {/* Descrição */}
          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
              Descrição
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent resize-none"
              placeholder="Descreva o concurso..."
            />
          </div>

          {/* Configuração Numérica */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[#1F1F1F] mb-4">Configuração Numérica</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="min_number" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                  Número Mínimo <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="min_number"
                  name="min_number"
                  value={formData.min_number}
                  onChange={handleChange}
                  required
                  min="1"
                  className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="max_number" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                  Número Máximo <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="max_number"
                  name="max_number"
                  value={formData.max_number}
                  onChange={handleChange}
                  required
                  min="1"
                  className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="numbers_per_participation" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                  Números por Participação <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="numbers_per_participation"
                  name="numbers_per_participation"
                  value={formData.numbers_per_participation}
                  onChange={handleChange}
                  required
                  min="1"
                  className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Datas */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[#1F1F1F] mb-4">Datas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="start_date" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                  Data e Hora de Início <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  id="start_date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="end_date" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                  Data e Hora de Término <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  id="end_date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Status e Valor */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[#1F1F1F] mb-4">Configurações Adicionais</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                >
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativo</option>
                  <option value="finished">Finalizado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div>
                <label htmlFor="participation_value" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                  Valor da Participação (R$)
                </label>
                <input
                  type="number"
                  id="participation_value"
                  name="participation_value"
                  value={formData.participation_value || ''}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-[#E5E5E5]">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvando...' : isEditing ? 'Atualizar Concurso' : 'Criar Concurso'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/contests')}
              disabled={saving}
              className="px-6 py-3 bg-white border-2 border-[#E5E5E5] text-[#1F1F1F] rounded-xl font-semibold hover:border-[#1E7F43] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  )
}
