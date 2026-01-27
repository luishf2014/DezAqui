/**
 * Admin Activations - Ativação de Participações
 * FASE 3: Pagamentos e Ativação
 * 
 * Ativar participações manual/offline + pendências Pix
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { listPendingParticipations, activateParticipation } from '../../services/participationsService'
import { Participation, Contest } from '../../types'
import { listAllContests } from '../../services/contestsService'
import { createCashPayment, getPaymentsByParticipation } from '../../services/paymentsService'
import { Payment } from '../../types'

interface ParticipationWithDetails extends Participation {
  contest: Contest | null
  user: { id: string; name: string; email: string } | null
  payment?: Payment | null // MODIFIQUEI AQUI - Pagamento associado à participação
}

export default function AdminActivations() {
  const navigate = useNavigate()
  const [participations, setParticipations] = useState<ParticipationWithDetails[]>([])
  const [contests, setContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [filterContestId, setFilterContestId] = useState<string>('all')
  const [searchTicketCode, setSearchTicketCode] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  // MODIFIQUEI AQUI - Estados para modal de registro de pagamento
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedParticipation, setSelectedParticipation] = useState<ParticipationWithDetails | null>(null)
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [paymentNotes, setPaymentNotes] = useState<string>('')
  const [registeringPayment, setRegisteringPayment] = useState(false)
  // MODIFIQUEI AQUI - Estado para modal de sucesso
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successData, setSuccessData] = useState<{ userName: string; amount: number; ticketCode?: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [participationsData, contestsData] = await Promise.all([
        listPendingParticipations(),
        listAllContests(),
      ])
      
      // MODIFIQUEI AQUI - Carregar pagamentos para cada participação
      const participationsWithPayments = await Promise.all(
        participationsData.map(async (participation) => {
          try {
            const payments = await getPaymentsByParticipation(participation.id)
            const paidPayment = payments.find(p => p.status === 'paid')
            return {
              ...participation,
              payment: paidPayment || null,
            }
          } catch (err) {
            console.warn(`Erro ao carregar pagamento para participação ${participation.id}:`, err)
            return {
              ...participation,
              payment: null,
            }
          }
        })
      )
      
      setParticipations(participationsWithPayments)
      setContests(contestsData)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar participações pendentes')
    } finally {
      setLoading(false)
    }
  }

  // MODIFIQUEI AQUI - Abrir modal para registrar pagamento em dinheiro
  const handleRegisterPayment = (participation: ParticipationWithDetails) => {
    setSelectedParticipation(participation)
    // Preencher valor padrão se o concurso tiver participation_value
    const defaultAmount = participation.contest?.participation_value || ''
    setPaymentAmount(defaultAmount.toString())
    setPaymentNotes('')
    setShowPaymentModal(true)
  }

  // MODIFIQUEI AQUI - Função auxiliar para mostrar modais de erro com ícones
  type ErrorIconType = 'warning' | 'error' | 'money'
  
  const showErrorModal = (title: string, message: string, iconType: ErrorIconType = 'warning') => {
    let iconSvg = ''
    let iconBgClass = 'bg-orange-500'
    
    switch (iconType) {
      case 'money':
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        `
        iconBgClass = 'bg-green-500'
        break
      case 'error':
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        `
        iconBgClass = 'bg-red-500'
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
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal()
      }
    })
  }

  // MODIFIQUEI AQUI - Registrar pagamento em dinheiro e ativar automaticamente
  const handleSubmitPayment = async () => {
    if (!selectedParticipation) return

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      showErrorModal(
        'Valor inválido',
        'Por favor, informe um valor válido maior que zero.',
        'money'
      )
      return
    }

    setRegisteringPayment(true)
    try {
      // Registrar pagamento
      await createCashPayment({
        participationId: selectedParticipation.id,
        amount: amount,
        notes: paymentNotes.trim() || undefined,
      })
      
      // MODIFIQUEI AQUI - Ativar participação automaticamente após registrar pagamento
      await activateParticipation(selectedParticipation.id)
      
      // MODIFIQUEI AQUI - Preparar dados para modal de sucesso
      setSuccessData({
        userName: selectedParticipation.user?.name || 'Usuário',
        amount: amount,
        ticketCode: selectedParticipation.ticket_code,
      })
      
      // Fechar modal de pagamento e recarregar dados
      setShowPaymentModal(false)
      setSelectedParticipation(null)
      setPaymentAmount('')
      setPaymentNotes('')
      await loadData()
      
      // MODIFIQUEI AQUI - Mostrar modal de sucesso
      setShowSuccessModal(true)
    } catch (err) {
      console.error('Erro ao registrar pagamento e ativar participação:', err)
      setRegisteringPayment(false)
      showErrorModal(
        'Erro ao processar',
        err instanceof Error ? err.message : 'Erro ao processar. Tente novamente.',
        'error'
      )
    } finally {
      setRegisteringPayment(false)
    }
  }

  // MODIFIQUEI AQUI - Ativar participação (apenas quando já tem pagamento registrado)
  const handleActivate = async (participationId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja ativar a participação de "${userName}"?\n\nEsta ação marcará a participação como ativa.`)) {
      return
    }

    setActivatingId(participationId)
    try {
      await activateParticipation(participationId)
      await loadData()
    } catch (err) {
      console.error('Erro ao ativar participação:', err)
      setActivatingId(null)
      showErrorModal(
        'Erro ao ativar',
        err instanceof Error ? err.message : 'Erro ao ativar participação. Tente novamente.',
        'error'
      )
    } finally {
      setActivatingId(null)
    }
  }

  const filteredParticipations = (filterContestId === 'all'
    ? participations
    : participations.filter(p => p.contest_id === filterContestId)
  ).filter(p => {
    // MODIFIQUEI AQUI - Filtrar por código/ticket se houver busca
    if (!searchTicketCode.trim()) return true
    const code = p.ticket_code || ''
    return code.toLowerCase().includes(searchTicketCode.toLowerCase().trim())
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatNumbers = (numbers: number[]) => {
    return numbers.map(n => n.toString().padStart(2, '0')).join(', ')
  }

  return (
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
              Ativações
            </h1>
          </div>
          
          <div className="text-center">
            
            <p className="text-[#1F1F1F]/70">
              Ativar participações manualmente ou gerenciar pendências de pagamento Pix
            </p>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Total Pendentes</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-[#F4C430]">{loading ? '...' : participations.length}</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Filtradas</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-[#1E7F43]">{loading ? '...' : filteredParticipations.length}</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#1F1F1F]/70">Concursos</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#3CCB7F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-[#3CCB7F]">{loading ? '...' : contests.length}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6 bg-white rounded-2xl border border-[#E5E5E5] p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contest-filter" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                Filtrar por Concurso
              </label>
              <select
                id="contest-filter"
                value={filterContestId}
                onChange={(e) => setFilterContestId(e.target.value)}
                className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
              >
                <option value="all">Todos os Concursos ({participations.length})</option>
                {contests.map((contest) => (
                  <option key={contest.id} value={contest.id}>
                    {contest.name} ({participations.filter(p => p.contest_id === contest.id).length})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ticket-search" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                Buscar por Código/Ticket
              </label>
              <input
                id="ticket-search"
                type="text"
                value={searchTicketCode}
                onChange={(e) => setSearchTicketCode(e.target.value)}
                placeholder="Ex: TKT-20250124-A1B2C3"
                className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Lista de Participações */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43]"></div>
            <p className="mt-4 text-[#1F1F1F]/70">Carregando participações pendentes...</p>
          </div>
        ) : filteredParticipations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-[#1F1F1F]/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Nenhuma Participação Pendente</h2>
            <p className="text-[#1F1F1F]/70 mb-4">
              {filterContestId === 'all'
                ? 'Não há participações aguardando ativação no momento.'
                : 'Não há participações pendentes para este concurso.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredParticipations.map((participation) => (
              <div
                key={participation.id}
                className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* Informações do Usuário e Concurso */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-[#1F1F1F]">
                            {participation.user?.name || 'Usuário não encontrado'}
                          </h3>
                          {participation.ticket_code && (
                            <span className="px-3 py-1 bg-[#1E7F43] text-white rounded-lg font-mono text-xs font-bold">
                              {participation.ticket_code}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#1F1F1F]/70 mb-2">
                          {participation.user?.email || 'Email não disponível'}
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#F4C430]/20 text-[#F4C430] whitespace-nowrap">
                        Pendente
                      </span>
                    </div>

                    {participation.contest && (
                      <div className="mb-4 p-4 bg-[#F9F9F9] rounded-xl">
                        <h4 className="font-semibold text-[#1F1F1F] mb-2">{participation.contest.name}</h4>
                        {participation.contest.description && (
                          <p className="text-sm text-[#1F1F1F]/70 mb-2 line-clamp-2">
                            {participation.contest.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 text-xs text-[#1F1F1F]/70">
                          <span>
                            Números: {participation.contest.min_number} - {participation.contest.max_number}
                          </span>
                          <span>
                            Por participação: {participation.contest.numbers_per_participation} números
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Números Escolhidos */}
                    <div className="mb-4">
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
                      <p className="text-xs text-[#1F1F1F]/70 mt-2">
                        {formatNumbers(participation.numbers)}
                      </p>
                    </div>

                    {/* Data de Criação */}
                    <p className="text-xs text-[#1F1F1F]/70">
                      Criada em: {formatDate(participation.created_at)}
                    </p>

                    {/* MODIFIQUEI AQUI - Informação de pagamento */}
                    {participation.payment && (
                      <div className="mt-4 p-3 bg-[#3CCB7F]/10 rounded-xl border border-[#3CCB7F]/20">
                        <div className="flex items-center gap-2 mb-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#3CCB7F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-semibold text-[#3CCB7F]">Pagamento Registrado</span>
                        </div>
                        <p className="text-xs text-[#1F1F1F]/70">
                          Valor: R$ {participation.payment.amount.toFixed(2).replace('.', ',')} | 
                          Método: {participation.payment.payment_method === 'cash' ? 'Dinheiro' : participation.payment.payment_method}
                          {participation.payment.paid_at && ` | Pago em: ${formatDate(participation.payment.paid_at)}`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-2 lg:min-w-[200px]">
                    {/* MODIFIQUEI AQUI - Botão para registrar pagamento em dinheiro (ativa automaticamente) */}
                    {!participation.payment && (
                      <button
                        onClick={() => handleRegisterPayment(participation)}
                        className="px-6 py-3 bg-[#F4C430] text-[#1F1F1F] rounded-xl font-semibold hover:bg-[#F4C430]/90 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Registrar Pagamento em Dinheiro
                      </button>
                    )}
                    
                    {/* MODIFIQUEI AQUI - Botão de ativar só aparece quando já tem pagamento registrado */}
                    {participation.payment && (
                      <button
                        onClick={() => handleActivate(participation.id, participation.user?.name || 'Usuário')}
                        disabled={activatingId === participation.id}
                        className="px-6 py-3 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {activatingId === participation.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Ativando...
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Ativar Participação
                          </>
                        )}
                      </button>
                    )}
                    {participation.contest && (
                      <button
                        onClick={() => navigate(`/contests/${participation.contest_id}`)}
                        className="px-6 py-3 bg-white border-2 border-[#1E7F43] text-[#1E7F43] rounded-xl font-semibold hover:bg-[#F9F9F9] transition-all flex items-center justify-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Ver Concurso
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODIFIQUEI AQUI - Modal para registrar pagamento em dinheiro */}
      {showPaymentModal && selectedParticipation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1F1F1F]">Registrar Pagamento em Dinheiro</h2>
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setSelectedParticipation(null)
                  setPaymentAmount('')
                  setPaymentNotes('')
                }}
                className="text-[#1F1F1F]/60 hover:text-[#1F1F1F] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-[#F9F9F9] rounded-xl">
                <p className="text-sm text-[#1F1F1F]/70 mb-2">Participante:</p>
                <p className="font-semibold text-[#1F1F1F]">{selectedParticipation.user?.name || 'Usuário não encontrado'}</p>
                {selectedParticipation.ticket_code && (
                  <p className="text-xs text-[#1F1F1F]/60 mt-1">Código: {selectedParticipation.ticket_code}</p>
                )}
              </div>

              <div>
                <label htmlFor="payment-amount" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                  Valor Recebido (R$)
                </label>
                <input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                  required
                />
                {selectedParticipation.contest?.participation_value && (
                  <p className="text-xs text-[#1F1F1F]/60 mt-1">
                    Valor sugerido: R$ {selectedParticipation.contest.participation_value.toFixed(2).replace('.', ',')}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="payment-notes" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  id="payment-notes"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Ex: Pagamento recebido em dinheiro no balcão..."
                  rows={3}
                  className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowPaymentModal(false)
                    setSelectedParticipation(null)
                    setPaymentAmount('')
                    setPaymentNotes('')
                  }}
                  disabled={registeringPayment}
                  className="flex-1 px-6 py-3 bg-white border-2 border-[#E5E5E5] text-[#1F1F1F] rounded-xl font-semibold hover:bg-[#F9F9F9] transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitPayment}
                  disabled={registeringPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {registeringPayment ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Registrando...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Registrar Pagamento
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODIFIQUEI AQUI - Modal de sucesso após registro de pagamento */}
      {showSuccessModal && successData && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowSuccessModal(false)
            setSuccessData(null)
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform transition-all duration-300 animate-[slideDown_0.3s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ícone de sucesso animado */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] rounded-full flex items-center justify-center animate-[scaleIn_0.4s_ease-out]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="absolute inset-0 bg-[#3CCB7F] rounded-full opacity-20 animate-ping"></div>
              </div>
            </div>

            {/* Título */}
            <h2 className="text-2xl font-bold text-[#1F1F1F] text-center mb-2">
              Sucesso!
            </h2>
            <p className="text-[#1F1F1F]/70 text-center mb-6">
              Pagamento registrado e participação ativada com sucesso
            </p>

            {/* Informações do pagamento */}
            <div className="bg-[#F9F9F9] rounded-xl p-4 mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#1F1F1F]/70">Participante:</span>
                <span className="font-semibold text-[#1F1F1F]">{successData.userName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#1F1F1F]/70">Valor recebido:</span>
                <span className="font-bold text-[#1E7F43] text-lg">
                  R$ {successData.amount.toFixed(2).replace('.', ',')}
                </span>
              </div>
              {successData.ticketCode && (
                <div className="flex items-center justify-between pt-2 border-t border-[#E5E5E5]">
                  <span className="text-sm text-[#1F1F1F]/70">Código/Ticket:</span>
                  <span className="px-3 py-1 bg-[#1E7F43] text-white rounded-lg font-mono text-xs font-bold">
                    {successData.ticketCode}
                  </span>
                </div>
              )}
            </div>

            {/* Botão de fechar */}
            <button
              onClick={() => {
                setShowSuccessModal(false)
                setSuccessData(null)
              }}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Fechar
            </button>
          </div>
        </div>
      )}

      <Footer />

      {/* MODIFIQUEI AQUI - Animações CSS para o modal de sucesso */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-30px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-\\[slideDown_0\\.3s_ease-out\\] {
          animation: slideDown 0.3s ease-out;
        }
        
        .animate-\\[scaleIn_0\\.4s_ease-out\\] {
          animation: scaleIn 0.4s ease-out;
        }
      `}</style>
    </div>
  )
}
