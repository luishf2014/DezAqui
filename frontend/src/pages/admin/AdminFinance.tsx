/**
 * Admin Finance - Parametrização Financeira
 * FASE 1: Painel Administrativo
 * 
 * Taxas, parametrização e valores
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { listAllContests, updateContest } from '../../services/contestsService'
import { listAllPayments, getFinancialStats, PaymentWithDetails, FinancialStats, PaymentFilters } from '../../services/paymentsService'
import { listAllDiscounts, createDiscount, updateDiscount, deleteDiscount, CreateDiscountInput, UpdateDiscountInput } from '../../services/discountsService'
import { Contest, Discount, DiscountType } from '../../types'

export default function AdminFinance() {
  const navigate = useNavigate()
  const [contests, setContests] = useState<Contest[]>([])
  const [payments, setPayments] = useState<PaymentWithDetails[]>([])
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estados para filtros
  const [filterContestId, setFilterContestId] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterMethod, setFilterMethod] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  
  // Estados para edição de valores
  const [editingContestId, setEditingContestId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [savingValue, setSavingValue] = useState(false)
  
  // Estados para descontos e promoções (MODIFIQUEI AQUI)
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null)
  const [discountForm, setDiscountForm] = useState<CreateDiscountInput>({
    code: '',
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 0,
    contest_id: null,
    start_date: '',
    end_date: '',
    max_uses: null,
  })
  const [savingDiscount, setSavingDiscount] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadData()
    loadDiscounts() // MODIFIQUEI AQUI
  }, [])

  useEffect(() => {
    loadPayments()
    loadStats()
  }, [filterContestId, filterStatus, filterMethod, startDate, endDate])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const contestsData = await listAllContests()
      setContests(contestsData)
      await loadPayments()
      await loadStats()
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados financeiros')
    } finally {
      setLoading(false)
    }
  }

  const loadPayments = async () => {
    try {
      const filters: PaymentFilters = {}
      
      if (filterContestId !== 'all') {
        filters.contestId = filterContestId
      }
      if (filterStatus !== 'all') {
        filters.status = filterStatus as 'pending' | 'paid' | 'cancelled' | 'refunded'
      }
      if (filterMethod !== 'all') {
        filters.paymentMethod = filterMethod as 'pix' | 'cash' | 'manual'
      }
      if (startDate) {
        filters.startDate = startDate
      }
      if (endDate) {
        filters.endDate = endDate
      }

      const paymentsData = await listAllPayments(filters)
      setPayments(paymentsData)
    } catch (err) {
      console.error('Erro ao carregar pagamentos:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico financeiro')
    }
  }

  const loadStats = async () => {
    try {
      const filters: PaymentFilters = {}
      
      if (filterContestId !== 'all') {
        filters.contestId = filterContestId
      }
      if (startDate) {
        filters.startDate = startDate
      }
      if (endDate) {
        filters.endDate = endDate
      }

      const statsData = await getFinancialStats(filters)
      setStats(statsData)
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err)
    }
  }

  const handleEditValue = (contest: Contest) => {
    setEditingContestId(contest.id)
    setEditingValue(contest.participation_value?.toString() || '')
  }

  const handleSaveValue = async (contestId: string) => {
    try {
      setSavingValue(true)
      const value = editingValue.trim() === '' ? undefined : parseFloat(editingValue)
      
      if (value !== undefined && (isNaN(value) || value < 0)) {
        setSavingValue(false)
        showErrorModal(
          'Valor inválido',
          'Por favor, informe um valor válido maior ou igual a zero.',
          'money'
        )
        return
      }

      await updateContest(contestId, {
        participation_value: value,
      })

      // Atualizar lista de concursos
      const updatedContests = contests.map(c => 
        c.id === contestId ? { ...c, participation_value: value } : c
      )
      setContests(updatedContests)
      
      setEditingContestId(null)
      setEditingValue('')
    } catch (err) {
      console.error('Erro ao salvar valor:', err)
      setSavingValue(false)
      showErrorModal(
        'Erro ao salvar',
        err instanceof Error ? err.message : 'Erro ao salvar valor',
        'error'
      )
    } finally {
      setSavingValue(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingContestId(null)
    setEditingValue('')
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-[#1E7F43] text-white'
      case 'pending':
        return 'bg-[#F4C430] text-[#1F1F1F]'
      case 'cancelled':
        return 'bg-red-500 text-white'
      case 'refunded':
        return 'bg-gray-500 text-white'
      default:
        return 'bg-gray-300 text-[#1F1F1F]'
    }
  }

  const getMethodBadgeClass = (method?: string) => {
    switch (method) {
      case 'pix':
        return 'bg-[#3CCB7F] text-white'
      case 'cash':
        return 'bg-[#F4C430] text-[#1F1F1F]'
      case 'manual':
        return 'bg-blue-500 text-white'
      default:
        return 'bg-gray-300 text-[#1F1F1F]'
    }
  }

  // MODIFIQUEI AQUI - Função auxiliar para mostrar modais de erro com ícones
  type ErrorIconType = 'warning' | 'error' | 'info' | 'money' | 'calendar' | 'code' | 'name'
  
  const showErrorModal = (title: string, message: string, iconType: ErrorIconType = 'warning') => {
    // Definir ícone e cor baseado no tipo
    let iconSvg = ''
    let iconBgClass = 'bg-orange-500'
    
    switch (iconType) {
      case 'error':
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        `
        iconBgClass = 'bg-red-500'
        break
      case 'money':
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        `
        iconBgClass = 'bg-green-500'
        break
      case 'calendar':
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        `
        iconBgClass = 'bg-blue-500'
        break
      case 'code':
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        `
        iconBgClass = 'bg-purple-500'
        break
      case 'name':
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        `
        iconBgClass = 'bg-indigo-500'
        break
      case 'info':
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        `
        iconBgClass = 'bg-blue-500'
        break
      case 'warning':
      default:
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        `
        iconBgClass = 'bg-orange-500'
        break
    }
    
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-[fadeIn_0.2s_ease-out]'
    modal.innerHTML = `
      <div class="bg-white rounded-2xl p-8 max-w-md mx-4 animate-[scaleIn_0.3s_ease-out] shadow-2xl">
        <div class="text-center">
          <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full ${iconBgClass} mb-4">
            ${iconSvg}
          </div>
          <h3 class="text-xl font-bold text-[#1F1F1F] mb-2">${title}</h3>
          <p class="text-[#1F1F1F]/70 mb-6">${message}</p>
          <button class="px-6 py-2 bg-[#1E7F43] text-white rounded-lg hover:bg-[#3CCB7F] transition-colors font-semibold">
            Entendi
          </button>
        </div>
      </div>
    `
    document.body.appendChild(modal)
    
    const closeBtn = modal.querySelector('button')
    const closeModal = () => {
      modal.remove()
    }
    closeBtn?.addEventListener('click', closeModal)
    // Fechar ao clicar fora do modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal()
      }
    })
  }

  // Funções para gestão de descontos (MODIFIQUEI AQUI)
  const loadDiscounts = async () => {
    try {
      const discountsData = await listAllDiscounts()
      setDiscounts(discountsData)
    } catch (err) {
      console.error('Erro ao carregar descontos:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar descontos')
    }
  }

  const handleOpenDiscountModal = (discount?: Discount) => {
    if (discount) {
      setEditingDiscount(discount)
      setDiscountForm({
        code: discount.code,
        name: discount.name,
        description: discount.description || '',
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        contest_id: discount.contest_id || null,
        start_date: discount.start_date.split('T')[0],
        end_date: discount.end_date.split('T')[0],
        max_uses: discount.max_uses || null,
      })
    } else {
      setEditingDiscount(null)
      setDiscountForm({
        code: '',
        name: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 0,
        contest_id: null,
        start_date: '',
        end_date: '',
        max_uses: null,
      })
    }
    setShowDiscountModal(true)
  }

  const handleCloseDiscountModal = () => {
    setShowDiscountModal(false)
    setEditingDiscount(null)
    setDiscountForm({
      code: '',
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 0,
      contest_id: null,
      start_date: '',
      end_date: '',
      max_uses: null,
    })
  }

  const handleSaveDiscount = async () => {
    try {
      setSavingDiscount(true)
      setError(null)

      if (!discountForm.code.trim()) {
        setSavingDiscount(false)
        showErrorModal(
          'Código obrigatório',
          'Por favor, informe o código do desconto.',
          'code'
        )
        return
      }

      if (!discountForm.name.trim()) {
        setSavingDiscount(false)
        showErrorModal(
          'Nome obrigatório',
          'Por favor, informe o nome da promoção.',
          'name'
        )
        return
      }

      if (discountForm.discount_value <= 0) {
        setSavingDiscount(false)
        showErrorModal(
          'Valor inválido',
          'Por favor, informe um valor de desconto válido maior que zero.',
          'money'
        )
        return
      }

      if (discountForm.discount_type === 'percentage' && discountForm.discount_value > 100) {
        setSavingDiscount(false)
        showErrorModal(
          'Valor percentual inválido',
          'O desconto percentual não pode ser maior que 100%.',
          'money'
        )
        return
      }

      if (!discountForm.start_date || !discountForm.end_date) {
        setSavingDiscount(false)
        showErrorModal(
          'Datas obrigatórias',
          'Por favor, informe as datas de início e término.',
          'calendar'
        )
        return
      }

      if (new Date(discountForm.end_date) <= new Date(discountForm.start_date)) {
        setSavingDiscount(false)
        showErrorModal(
          'Data inválida',
          'A data de término deve ser posterior à data de início.',
          'calendar'
        )
        return
      }

      const input: CreateDiscountInput | UpdateDiscountInput = {
        ...discountForm,
        start_date: new Date(discountForm.start_date).toISOString(),
        end_date: new Date(discountForm.end_date).toISOString(),
        contest_id: discountForm.contest_id === 'all' ? null : discountForm.contest_id || null,
      }

      if (editingDiscount) {
        await updateDiscount(editingDiscount.id, input as UpdateDiscountInput)
      } else {
        await createDiscount(input as CreateDiscountInput)
      }

      await loadDiscounts()
      handleCloseDiscountModal()
      
      // Mostrar mensagem de sucesso
      const successMessage = editingDiscount 
        ? 'Desconto atualizado com sucesso!' 
        : 'Desconto criado com sucesso!'
      
      // Criar modal de sucesso visual
      const modal = document.createElement('div')
      modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50'
      modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-md mx-4 animate-[scaleIn_0.3s_ease-out]">
          <div class="text-center">
            <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-[#1E7F43] mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 class="text-xl font-bold text-[#1F1F1F] mb-2">Sucesso!</h3>
            <p class="text-[#1F1F1F]/70 mb-6">${successMessage}</p>
            <button class="px-6 py-2 bg-[#1E7F43] text-white rounded-lg hover:bg-[#3CCB7F] transition-colors font-semibold">
              Fechar
            </button>
          </div>
        </div>
      `
      document.body.appendChild(modal)
      
      const closeBtn = modal.querySelector('button')
      const closeModal = () => {
        modal.remove()
      }
      closeBtn?.addEventListener('click', closeModal)
      setTimeout(closeModal, 3000)
    } catch (err) {
      console.error('Erro ao salvar desconto:', err)
      setSavingDiscount(false)
      showErrorModal(
        'Erro ao salvar',
        err instanceof Error ? err.message : 'Erro ao salvar desconto',
        'error'
      )
    } finally {
      setSavingDiscount(false)
    }
  }

  const handleToggleDiscountStatus = async (discount: Discount) => {
    try {
      await updateDiscount(discount.id, { is_active: !discount.is_active })
      await loadDiscounts()
    } catch (err) {
      console.error('Erro ao alterar status do desconto:', err)
      showErrorModal(
        'Erro ao alterar status',
        err instanceof Error ? err.message : 'Erro ao alterar status do desconto',
        'error'
      )
    }
  }

  const handleDeleteDiscount = async (id: string) => {
    try {
      await deleteDiscount(id)
      await loadDiscounts()
      setShowDeleteConfirm(null)
      
      // Mostrar mensagem de sucesso
      const modal = document.createElement('div')
      modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50'
      modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-md mx-4 animate-[scaleIn_0.3s_ease-out]">
          <div class="text-center">
            <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-[#1E7F43] mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 class="text-xl font-bold text-[#1F1F1F] mb-2">Desconto excluído!</h3>
            <p class="text-[#1F1F1F]/70 mb-6">O desconto foi removido com sucesso</p>
            <button class="px-6 py-2 bg-[#1E7F43] text-white rounded-lg hover:bg-[#3CCB7F] transition-colors font-semibold">
              Fechar
            </button>
          </div>
        </div>
      `
      document.body.appendChild(modal)
      
      const closeBtn = modal.querySelector('button')
      const closeModal = () => {
        modal.remove()
      }
      closeBtn?.addEventListener('click', closeModal)
      setTimeout(closeModal, 3000)
    } catch (err) {
      console.error('Erro ao deletar desconto:', err)
      setShowDeleteConfirm(null)
      showErrorModal(
        'Erro ao excluir',
        err instanceof Error ? err.message : 'Erro ao deletar desconto',
        'error'
      )
    }
  }

  const getDiscountStatusBadge = (discount: Discount) => {
    const now = new Date()
    const startDate = new Date(discount.start_date)
    const endDate = new Date(discount.end_date)
    
    if (!discount.is_active) {
      return { text: 'Inativo', class: 'bg-gray-500 text-white' }
    }
    
    if (now < startDate) {
      return { text: 'Agendado', class: 'bg-blue-500 text-white' }
    }
    
    if (now > endDate) {
      return { text: 'Expirado', class: 'bg-red-500 text-white' }
    }
    
    if (discount.max_uses && discount.current_uses >= discount.max_uses) {
      return { text: 'Esgotado', class: 'bg-orange-500 text-white' }
    }
    
    return { text: 'Ativo', class: 'bg-[#1E7F43] text-white' }
  }

  return (
    <>
      {/* Estilos customizados para animações e scrollbar */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #F9F9F9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E5E5;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #1E7F43;
        }
      `}</style>
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        {/* Cabeçalho */}
        <div className="mb-6">
          <div className="mb-6 relative flex flex-col sm:flex-row sm:items-center">
            <button
              onClick={() => navigate('/admin')}
              className="text-[#1E7F43] hover:text-[#3CCB7F] font-semibold mb-4 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Voltar ao Dashboard
            </button>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F1F1F] mb-2 sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:mb-0">
              Financeiro
            </h1>
          </div>
          
          <div className="text-center">
            <p className="text-[#1F1F1F]/70">
              Parametrização de taxas, valores e histórico financeiro
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43]"></div>
          </div>
        ) : (
          <>
            {/* Estatísticas Financeiras */}
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Total Arrecadado</h3>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-[#1E7F43]">{formatCurrency(stats.totalRevenue)}</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Total Pagamentos</h3>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#3CCB7F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-[#3CCB7F]">{stats.totalPayments}</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Ticket Médio</h3>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-[#F4C430]">{formatCurrency(stats.averagePayment)}</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Pix</h3>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#3CCB7F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-[#3CCB7F]">{formatCurrency(stats.revenueByMethod.pix)}</p>
                </div>
              </div>
            )}

            {/* Filtros */}
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm mb-6">
              <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Filtros</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label htmlFor="contest-filter" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                    Concurso
                  </label>
                  <select
                    id="contest-filter"
                    value={filterContestId}
                    onChange={(e) => setFilterContestId(e.target.value)}
                    className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                  >
                    <option value="all">Todos</option>
                    {contests.map((contest) => (
                      <option key={contest.id} value={contest.id}>
                        {contest.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="status-filter" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                    Status
                  </label>
                  <select
                    id="status-filter"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                  >
                    <option value="all">Todos</option>
                    <option value="paid">Pago</option>
                    <option value="pending">Pendente</option>
                    <option value="cancelled">Cancelado</option>
                    <option value="refunded">Reembolsado</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="method-filter" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                    Método
                  </label>
                  <select
                    id="method-filter"
                    value={filterMethod}
                    onChange={(e) => setFilterMethod(e.target.value)}
                    className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                  >
                    <option value="all">Todos</option>
                    <option value="pix">Pix</option>
                    <option value="cash">Dinheiro</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="start-date" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                    Data Inicial
                  </label>
                  <input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="end-date" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                    Data Final
                  </label>
                  <input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Configuração de Valores por Concurso */}
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm mb-6">
              <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Configuração de Valores por Concurso</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E5E5E5]">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Concurso</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Valor de Participação</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contests.map((contest) => (
                      <tr key={contest.id} className="border-b border-[#E5E5E5] hover:bg-[#F9F9F9]">
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            <div className="font-semibold text-[#1F1F1F]">{contest.name}</div>
                            {/* MODIFIQUEI AQUI - Exibir código do concurso */}
                            {contest.contest_code && (
                              <span className="text-xs text-[#1F1F1F]/60 font-mono">
                                Código: {contest.contest_code}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                            contest.status === 'active' ? 'bg-[#1E7F43] text-white' :
                            contest.status === 'finished' ? 'bg-gray-500 text-white' :
                            contest.status === 'draft' ? 'bg-[#F4C430] text-[#1F1F1F]' :
                            'bg-red-500 text-white'
                          }`}>
                            {contest.status === 'active' ? 'Ativo' :
                             contest.status === 'finished' ? 'Finalizado' :
                             contest.status === 'draft' ? 'Rascunho' : 'Cancelado'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {editingContestId === contest.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                className="w-32 px-3 py-1 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E7F43]"
                              />
                              <button
                                onClick={() => handleSaveValue(contest.id)}
                                disabled={savingValue}
                                className="px-3 py-1 bg-[#1E7F43] text-white rounded-lg hover:bg-[#3CCB7F] transition-colors disabled:opacity-50"
                              >
                                {savingValue ? 'Salvando...' : 'Salvar'}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="px-3 py-1 bg-gray-300 text-[#1F1F1F] rounded-lg hover:bg-gray-400 transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <span className="text-[#1F1F1F] font-semibold">
                              {contest.participation_value ? formatCurrency(contest.participation_value) : 'Não definido'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {editingContestId !== contest.id && (
                            <button
                              onClick={() => handleEditValue(contest)}
                              className="px-4 py-2 bg-[#1E7F43] text-white rounded-lg hover:bg-[#3CCB7F] transition-colors text-sm font-semibold"
                            >
                              Editar Valor
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Histórico Financeiro */}
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm mb-6">
              <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Histórico Financeiro</h2>
              {payments.length === 0 ? (
                <div className="text-center py-12 text-[#1F1F1F]/70">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-[#1F1F1F]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>Nenhum pagamento encontrado com os filtros selecionados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E5E5E5]">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Data</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Concurso</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Ticket</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Valor</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Método</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b border-[#E5E5E5] hover:bg-[#F9F9F9]">
                          <td className="py-3 px-4 text-sm text-[#1F1F1F]">
                            {formatDate(payment.created_at)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-semibold text-[#1F1F1F]">
                              {payment.contest?.name || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {payment.participation?.ticket_code ? (
                              <span className="px-2 py-1 bg-[#1E7F43] text-white rounded-lg font-mono text-xs font-bold">
                                {payment.participation.ticket_code}
                              </span>
                            ) : (
                              <span className="text-sm text-[#1F1F1F]/50">N/A</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-bold text-[#1E7F43]">
                              {formatCurrency(payment.amount)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${getMethodBadgeClass(payment.payment_method)}`}>
                              {payment.payment_method === 'pix' ? 'Pix' :
                               payment.payment_method === 'cash' ? 'Dinheiro' :
                               payment.payment_method === 'manual' ? 'Manual' : 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${getStatusBadgeClass(payment.status)}`}>
                              {payment.status === 'paid' ? 'Pago' :
                               payment.status === 'pending' ? 'Pendente' :
                               payment.status === 'cancelled' ? 'Cancelado' :
                               payment.status === 'refunded' ? 'Reembolsado' : payment.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Gestão de Descontos e Promoções (MODIFIQUEI AQUI) */}
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#1F1F1F]">Gestão de Descontos e Promoções</h2>
                <button
                  onClick={() => handleOpenDiscountModal()}
                  className="px-4 py-2 bg-[#1E7F43] text-white rounded-lg hover:bg-[#3CCB7F] transition-colors font-semibold flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Novo Desconto
                </button>
              </div>

              {discounts.length === 0 ? (
                <div className="text-center py-12 text-[#1F1F1F]/70">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-[#1F1F1F]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                  <p>Nenhum desconto cadastrado</p>
                  <p className="text-sm mt-2">Clique em "Novo Desconto" para criar sua primeira promoção</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E5E5E5]">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Código</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Nome</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Tipo</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Valor</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Concurso</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Validade</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Usos</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discounts.map((discount) => {
                        const statusBadge = getDiscountStatusBadge(discount)
                        return (
                          <tr key={discount.id} className="border-b border-[#E5E5E5] hover:bg-[#F9F9F9]">
                            <td className="py-3 px-4">
                              <span className="px-2 py-1 bg-[#1E7F43] text-white rounded-lg font-mono text-xs font-bold">
                                {discount.code}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-[#1F1F1F]">{discount.name}</div>
                              {discount.description && (
                                <div className="text-xs text-[#1F1F1F]/70 mt-1">{discount.description}</div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-[#1F1F1F]">
                                {discount.discount_type === 'percentage' ? 'Percentual' : 'Valor Fixo'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm font-bold text-[#1E7F43]">
                                {discount.discount_type === 'percentage' 
                                  ? `${discount.discount_value}%`
                                  : formatCurrency(discount.discount_value)}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-[#1F1F1F]">
                                {discount.contest_id 
                                  ? contests.find(c => c.id === discount.contest_id)?.name || 'N/A'
                                  : 'Global'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-xs text-[#1F1F1F]">
                                <div>{formatDate(discount.start_date).split(',')[0]}</div>
                                <div className="text-[#1F1F1F]/70">até {formatDate(discount.end_date).split(',')[0]}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-[#1F1F1F]">
                                {discount.current_uses} / {discount.max_uses || '∞'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${statusBadge.class}`}>
                                {statusBadge.text}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenDiscountModal(discount)}
                                  className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs font-semibold"
                                  title="Editar"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleToggleDiscountStatus(discount)}
                                  className={`px-3 py-1 rounded-lg transition-colors text-xs font-semibold ${
                                    discount.is_active
                                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                                      : 'bg-[#1E7F43] text-white hover:bg-[#3CCB7F]'
                                  }`}
                                  title={discount.is_active ? 'Desativar' : 'Ativar'}
                                >
                                  {discount.is_active ? 'Desativar' : 'Ativar'}
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(discount.id)}
                                  className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs font-semibold"
                                  title="Excluir"
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal de Criar/Editar Desconto (MODIFIQUEI AQUI) */}
            {showDiscountModal && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]">
                <div className="bg-white rounded-[2rem] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-[scaleIn_0.3s_ease-out] overflow-hidden">
                  {/* Header do Modal */}
                  <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E5E5] bg-gradient-to-r from-[#F9F9F9] to-white rounded-t-[2rem]">
                    <h3 className="text-2xl font-extrabold text-[#1F1F1F]">
                      {editingDiscount ? 'Editar Desconto' : 'Novo Desconto'}
                    </h3>
                    <button
                      onClick={handleCloseDiscountModal}
                      className="p-2 text-[#1F1F1F]/60 hover:text-[#1F1F1F] hover:bg-[#F9F9F9] rounded-lg transition-all duration-200"
                      title="Fechar"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Conteúdo do Modal com Scroll */}
                  <div className="overflow-y-auto flex-1 px-6 py-6 custom-scrollbar">
                    <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="discount-code" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                          Código do Cupom *
                        </label>
                        <input
                          id="discount-code"
                          type="text"
                          value={discountForm.code}
                          onChange={(e) => setDiscountForm({ ...discountForm, code: e.target.value.toUpperCase() })}
                          placeholder="Ex: PROMO2025"
                          className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                          disabled={!!editingDiscount}
                        />
                        <p className="text-xs text-[#1F1F1F]/70 mt-1">Código único do cupom (não pode ser alterado)</p>
                      </div>

                      <div>
                        <label htmlFor="discount-name" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                          Nome da Promoção *
                        </label>
                        <input
                          id="discount-name"
                          type="text"
                          value={discountForm.name}
                          onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })}
                          placeholder="Ex: Promoção de Verão"
                          className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="discount-description" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                        Descrição
                      </label>
                      <textarea
                        id="discount-description"
                        value={discountForm.description}
                        onChange={(e) => setDiscountForm({ ...discountForm, description: e.target.value })}
                        placeholder="Descreva a promoção..."
                        rows={3}
                        className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="discount-type" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                          Tipo de Desconto *
                        </label>
                        <select
                          id="discount-type"
                          value={discountForm.discount_type}
                          onChange={(e) => setDiscountForm({ ...discountForm, discount_type: e.target.value as DiscountType })}
                          className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                        >
                          <option value="percentage">Percentual (%)</option>
                          <option value="fixed">Valor Fixo (R$)</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="discount-value" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                          Valor do Desconto *
                        </label>
                        <input
                          id="discount-value"
                          type="number"
                          value={discountForm.discount_value}
                          onChange={(e) => setDiscountForm({ ...discountForm, discount_value: parseFloat(e.target.value) || 0 })}
                          placeholder={discountForm.discount_type === 'percentage' ? 'Ex: 10' : 'Ex: 5.00'}
                          step={discountForm.discount_type === 'percentage' ? '1' : '0.01'}
                          min="0"
                          max={discountForm.discount_type === 'percentage' ? '100' : undefined}
                          className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                        />
                        <p className="text-xs text-[#1F1F1F]/70 mt-1">
                          {discountForm.discount_type === 'percentage' 
                            ? 'Valor entre 0 e 100%' 
                            : 'Valor em reais (R$)'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="discount-contest" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                        Aplicar a Concurso
                      </label>
                      <select
                        id="discount-contest"
                        value={discountForm.contest_id || 'all'}
                        onChange={(e) => setDiscountForm({ ...discountForm, contest_id: e.target.value === 'all' ? null : e.target.value })}
                        className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                      >
                        <option value="all">Todos os Concursos (Global)</option>
                        {contests.map((contest) => (
                          <option key={contest.id} value={contest.id}>
                            {contest.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="discount-start-date" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                          Data de Início *
                        </label>
                        <input
                          id="discount-start-date"
                          type="date"
                          value={discountForm.start_date}
                          onChange={(e) => setDiscountForm({ ...discountForm, start_date: e.target.value })}
                          className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label htmlFor="discount-end-date" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                          Data de Término *
                        </label>
                        <input
                          id="discount-end-date"
                          type="date"
                          value={discountForm.end_date}
                          onChange={(e) => setDiscountForm({ ...discountForm, end_date: e.target.value })}
                          className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="discount-max-uses" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                        Limite de Usos
                      </label>
                      <input
                        id="discount-max-uses"
                        type="number"
                        value={discountForm.max_uses || ''}
                        onChange={(e) => setDiscountForm({ ...discountForm, max_uses: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Deixe em branco para ilimitado"
                        min="1"
                        className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                      />
                      <p className="text-xs text-[#1F1F1F]/70 mt-1">Número máximo de vezes que o desconto pode ser usado</p>
                    </div>
                    </div>
                  </div>

                  {/* Footer do Modal */}
                  <div className="px-6 py-5 border-t border-[#E5E5E5] bg-gradient-to-r from-white to-[#F9F9F9] flex items-center justify-end gap-4 rounded-b-[2rem]">
                    <button
                      onClick={handleCloseDiscountModal}
                      className="px-6 py-3 bg-gray-200 text-[#1F1F1F] rounded-xl hover:bg-gray-300 transition-all duration-200 font-bold shadow-sm hover:shadow-md"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveDiscount}
                      disabled={savingDiscount}
                      className="px-8 py-3 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white rounded-xl hover:from-[#3CCB7F] hover:to-[#1E7F43] transition-all duration-300 font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                    >
                      {savingDiscount ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Salvando...
                        </>
                      ) : (
                        <>
                          {editingDiscount ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Atualizar
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Criar Desconto
                            </>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Confirmação de Exclusão (MODIFIQUEI AQUI) */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]">
                <div className="bg-white rounded-[2rem] shadow-2xl p-6 max-w-md w-full animate-[scaleIn_0.3s_ease-out]">
                  <h3 className="text-xl font-bold text-[#1F1F1F] mb-4">Confirmar Exclusão</h3>
                  <p className="text-[#1F1F1F]/70 mb-6">
                    Tem certeza que deseja excluir este desconto? Esta ação não pode ser desfeita.
                  </p>
                  <div className="flex items-center justify-end gap-4">
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="px-6 py-2 bg-gray-300 text-[#1F1F1F] rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleDeleteDiscount(showDeleteConfirm)}
                      className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

        <Footer />
      </div>
    </>
  )
}
