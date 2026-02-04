/**
 * Admin Draws - Gestão de Sorteios
 * FASE 4: Sorteios e Rateio
 * 
 * Gestão de sorteios múltiplos com datas/horários e resultados
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { listAllContests } from '../../services/contestsService'
import { listAllDraws, createDraw, updateDraw, deleteDraw, CreateDrawInput, UpdateDrawInput } from '../../services/drawsService'
import { Contest, Draw } from '../../types'

export default function AdminDraws() {
  const navigate = useNavigate()
  const [contests, setContests] = useState<Contest[]>([])
  const [draws, setDraws] = useState<Draw[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estados para filtros
  const [filterContestId, setFilterContestId] = useState<string>('all')
  const [filterOnlyOngoing, setFilterOnlyOngoing] = useState<boolean>(false)
  
  // Estados para modal de criar/editar sorteio
  const [showDrawModal, setShowDrawModal] = useState(false)
  const [editingDraw, setEditingDraw] = useState<Draw | null>(null)
  const [drawForm, setDrawForm] = useState<CreateDrawInput>({
    contest_id: '',
    numbers: [],
    draw_date: '',
    numbers_count: undefined, // Quantidade customizada de números (opcional)
  })
  const [useCustomNumbersCount, setUseCustomNumbersCount] = useState(false)
  const [savingDraw, setSavingDraw] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  
  // Estado removido - quantidade será sempre baseada no concurso selecionado

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadDraws()
  }, [filterContestId, filterOnlyOngoing])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const contestsData = await listAllContests()
      setContests(contestsData)
      await loadDraws()
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const loadDraws = async () => {
    try {
      let drawsData = await listAllDraws(filterContestId !== 'all' ? filterContestId : undefined)

      // Filtrar por concursos em andamento (ativos ou finalizados, excluindo rascunhos e cancelados)
      // Nota: o trigger auto_finish_contest_on_first_draw muda o status para 'finished' ao criar o primeiro sorteio,
      // então concursos com sorteios terão status 'finished', não 'active'
      if (filterOnlyOngoing) {
        const ongoingContestIds = contests
          .filter(c => c.status === 'active' || c.status === 'finished')
          .map(c => c.id)
        drawsData = drawsData.filter(draw => ongoingContestIds.includes(draw.contest_id))
      }

      setDraws(drawsData)
    } catch (err) {
      console.error('Erro ao carregar sorteios:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar sorteios')
    }
  }

  const handleOpenDrawModal = (draw?: Draw) => {
    if (draw) {
      setEditingDraw(draw)
      // Converter data ISO para formato datetime-local
      const date = new Date(draw.draw_date)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const dateTimeLocal = `${year}-${month}-${day}T${hours}:${minutes}`

      setDrawForm({
        contest_id: draw.contest_id,
        numbers: [...draw.numbers],
        draw_date: dateTimeLocal,
        numbers_count: draw.numbers_count,
      })
      // Se o sorteio tem uma quantidade customizada, ativar o toggle
      setUseCustomNumbersCount(draw.numbers_count !== undefined && draw.numbers_count !== null)
    } else {
      setEditingDraw(null)
      setDrawForm({
        contest_id: filterContestId !== 'all' ? filterContestId : '',
        numbers: [],
        draw_date: '',
        numbers_count: undefined,
      })
      setUseCustomNumbersCount(false)
    }
    setShowDrawModal(true)
  }

  const handleCloseDrawModal = () => {
    setShowDrawModal(false)
    setEditingDraw(null)
    setDrawForm({
      contest_id: '',
      numbers: [],
      draw_date: '',
      numbers_count: undefined,
    })
    setUseCustomNumbersCount(false)
  }

  const handleGenerateRandomNumbers = () => {
    const contest = contests.find(c => c.id === drawForm.contest_id)
    if (!contest) {
      showErrorModal(
        'Concurso não selecionado',
        'Por favor, selecione um concurso antes de gerar números aleatórios.',
        'contest'
      )
      return
    }

    const min = contest.min_number || 0
    const max = contest.max_number || 99
    // Usa quantidade customizada se definida, senão usa a do concurso
    const count = (useCustomNumbersCount && drawForm.numbers_count)
      ? drawForm.numbers_count
      : (contest.numbers_per_participation || 6)

    const generated: number[] = []
    while (generated.length < count) {
      const num = Math.floor(Math.random() * (max - min + 1)) + min
      if (!generated.includes(num)) {
        generated.push(num)
      }
    }
    generated.sort((a, b) => a - b)
    setDrawForm({ ...drawForm, numbers: generated })
  }

  const handleAddNumber = (num: number) => {
    const contest = contests.find(c => c.id === drawForm.contest_id)
    if (!contest) {
      showErrorModal(
        'Concurso não selecionado',
        'Por favor, selecione um concurso antes de adicionar números.',
        'contest'
      )
      return
    }

    if (drawForm.numbers.includes(num)) {
      showErrorModal(
        'Número duplicado',
        'Este número já foi adicionado à seleção.',
        'numbers'
      )
      return
    }

    // Usa quantidade customizada se definida, senão usa a do concurso
    const maxNumbers = (useCustomNumbersCount && drawForm.numbers_count)
      ? drawForm.numbers_count
      : (contest.numbers_per_participation || 6)
    if (drawForm.numbers.length >= maxNumbers) {
      showErrorModal(
        'Limite atingido',
        `Você já selecionou o máximo de ${maxNumbers} números permitidos${useCustomNumbersCount ? ' para este sorteio' : ' para este concurso'}.`,
        'numbers'
      )
      return
    }

    setDrawForm({ ...drawForm, numbers: [...drawForm.numbers, num].sort((a, b) => a - b) })
  }

  const handleRemoveNumber = (num: number) => {
    setDrawForm({ ...drawForm, numbers: drawForm.numbers.filter(n => n !== num) })
  }

  const handleClearAllNumbers = () => {
    setDrawForm({ ...drawForm, numbers: [] })
  }

  // MODIFIQUEI AQUI - Função auxiliar para mostrar modais de erro sem fechar o formulário
  type ErrorIconType = 'warning' | 'calendar' | 'numbers' | 'contest' | 'error'
  
  const showErrorModal = (title: string, message: string, iconType: ErrorIconType = 'warning') => {
    // Definir ícone e cor baseado no tipo
    let iconSvg = ''
    let iconBgClass = 'bg-orange-500'
    
    switch (iconType) {
      case 'calendar':
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        `
        iconBgClass = 'bg-blue-500'
        break
      case 'numbers':
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        `
        iconBgClass = 'bg-purple-500'
        break
      case 'contest':
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        `
        iconBgClass = 'bg-indigo-500'
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
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[60]'
    modal.innerHTML = `
      <div class="bg-white rounded-2xl p-8 max-w-md mx-4 animate-[scaleIn_0.3s_ease-out]">
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

  const handleSaveDraw = async () => {
    try {
      setSavingDraw(true)
      setError(null)

      if (!drawForm.contest_id) {
        setSavingDraw(false)
        showErrorModal(
          'Concurso não selecionado',
          'Por favor, selecione um concurso antes de criar o sorteio.',
          'contest'
        )
        return
      }

      if (!drawForm.numbers || drawForm.numbers.length === 0) {
        setSavingDraw(false)
        showErrorModal(
          'Números não selecionados',
          'Por favor, adicione pelo menos um número sorteado antes de continuar.',
          'numbers'
        )
        return
      }

      const contest = contests.find(c => c.id === drawForm.contest_id)
      if (contest) {
        // Usa quantidade customizada se definida, senão usa a do concurso
        const expectedCount = (useCustomNumbersCount && drawForm.numbers_count)
          ? drawForm.numbers_count
          : (contest.numbers_per_participation || 6)
        if (drawForm.numbers.length !== expectedCount) {
          if (drawForm.numbers.length < expectedCount) {
            // Pop-up bonito informando quantos números faltam
            setSavingDraw(false)
            const missing = expectedCount - drawForm.numbers.length
            showErrorModal(
              'Números Insuficientes',
              `Este sorteio requer <strong>${expectedCount} números</strong>.<br /><br />Você selecionou <strong>${drawForm.numbers.length} números</strong>.<br /><span class="text-orange-600 font-semibold">Faltam ${missing} número${missing > 1 ? 's' : ''}.</span>`,
              'numbers'
            )
            return // Não permite salvar
          } else {
            // Se tiver mais números do que o esperado, pergunta se deseja continuar
            const confirm = window.confirm(
              `Este sorteio espera ${expectedCount} números. ` +
              `Você adicionou ${drawForm.numbers.length}. Deseja continuar mesmo assim?`
            )
            if (!confirm) return
          }
        }
      }

      if (!drawForm.draw_date) {
        setSavingDraw(false)
        showErrorModal(
          'Data não informada',
          'Por favor, informe a data e hora do sorteio antes de continuar.',
          'calendar'
        )
        return
      }

      const input: CreateDrawInput | UpdateDrawInput = {
        ...drawForm,
        draw_date: new Date(drawForm.draw_date).toISOString(),
        // Só incluir numbers_count se o toggle estiver ativo e houver um valor
        numbers_count: useCustomNumbersCount ? drawForm.numbers_count : undefined,
      }

      if (editingDraw) {
        await updateDraw(editingDraw.id, input as UpdateDrawInput)
      } else {
        const createInput = input as CreateDrawInput
        const createdDraw = await createDraw(createInput)
        console.log('[AdminDraws] Sorteio criado:', createdDraw.id)
        
        // MODIFIQUEI AQUI - Aguardar um pouco para garantir que o trigger SQL e a atualização do status sejam propagados
        await new Promise(resolve => setTimeout(resolve, 800))
        
        // MODIFIQUEI AQUI - Recarregar concursos após criar sorteio para atualizar status
        // Forçar recarregamento completo dos dados
        setLoading(true)
        try {
          const contestsData = await listAllContests()
          console.log('[AdminDraws] Concursos recarregados após criar sorteio. Total:', contestsData.length)
          
          // Verificar se o status foi atualizado
          const updatedContest = contestsData.find(c => c.id === createInput.contest_id)
          if (updatedContest) {
            console.log(`[AdminDraws] Status do concurso ${createInput.contest_id} após criar sorteio:`, updatedContest.status)
            if (updatedContest.status !== 'finished') {
              console.warn(`[AdminDraws] ATENÇÃO: Status do concurso não foi atualizado para 'finished'. Status atual: ${updatedContest.status}`)
            }
          }
          
          setContests(contestsData)
        } catch (err) {
          console.error('[AdminDraws] Erro ao recarregar concursos:', err)
        } finally {
          setLoading(false)
        }
      }

      await loadDraws()
      handleCloseDrawModal()
      
      // Mostrar mensagem de sucesso
      const successMessage = editingDraw 
        ? 'Sorteio atualizado com sucesso!' 
        : 'Sorteio criado com sucesso!'
      
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
      console.error('Erro ao salvar sorteio:', err)
      setSavingDraw(false)
      showErrorModal(
        'Erro ao salvar',
        err instanceof Error ? err.message : 'Erro ao salvar sorteio',
        'error'
      )
    } finally {
      setSavingDraw(false)
    }
  }

  const handleDeleteDraw = async (id: string) => {
    try {
      await deleteDraw(id)
      await loadDraws()
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
            <h3 class="text-xl font-bold text-[#1F1F1F] mb-2">Sorteio excluído!</h3>
            <p class="text-[#1F1F1F]/70 mb-6">O sorteio foi removido com sucesso</p>
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
      console.error('Erro ao deletar sorteio:', err)
      setShowDeleteConfirm(null)
      showErrorModal(
        'Erro ao excluir',
        err instanceof Error ? err.message : 'Erro ao deletar sorteio',
        'error'
      )
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDateOnly = (dateString: string) => {
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
              Sorteios
            </h1>
          </div>
          
          <div className="text-center">
            <p className="text-[#1F1F1F]/70">
              Gerencie sorteios múltiplos com datas/horários e resultados
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
            {/* Filtros e Estatísticas */}
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div className="flex-1">
                  <label htmlFor="contest-filter" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                    Filtrar por Concurso
                  </label>
                  <select
                    id="contest-filter"
                    value={filterContestId}
                    onChange={(e) => setFilterContestId(e.target.value)}
                    className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                  >
                    <option value="all">Todos os Concursos</option>
                    {contests
                      .filter(contest => !filterOnlyOngoing || (contest.status === 'active' || contest.status === 'finished'))
                      .map((contest) => (
                      <option key={contest.id} value={contest.id}>
                        {contest.name}{contest.contest_code ? ` (${contest.contest_code})` : ''}{contest.status !== 'active' ? ` [${contest.status === 'finished' ? 'Finalizado' : contest.status === 'draft' ? 'Rascunho' : contest.status}]` : ''}
                      </option>
                    ))}
                  </select>
                  {/* Filtro de concursos em andamento */}
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="ongoing-filter"
                      checked={filterOnlyOngoing}
                      onChange={(e) => {
                        setFilterOnlyOngoing(e.target.checked)
                        // Se ativar o filtro e o concurso selecionado for rascunho ou cancelado, resetar para "todos"
                        if (e.target.checked && filterContestId !== 'all') {
                          const selectedContest = contests.find(c => c.id === filterContestId)
                          if (selectedContest && selectedContest.status !== 'active' && selectedContest.status !== 'finished') {
                            setFilterContestId('all')
                          }
                        }
                      }}
                      className="w-4 h-4 text-[#1E7F43] bg-white border-2 border-[#E5E5E5] rounded focus:ring-[#1E7F43] focus:ring-2 cursor-pointer"
                    />
                    <label htmlFor="ongoing-filter" className="text-sm text-[#1F1F1F]/70 cursor-pointer select-none">
                      Mostrar apenas concursos em andamento
                    </label>
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => handleOpenDrawModal()}
                    className="px-6 py-2 bg-[#1E7F43] text-white rounded-lg hover:bg-[#3CCB7F] transition-colors font-semibold flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Novo Sorteio
                  </button>
                </div>
              </div>

              {/* Estatísticas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-[#E5E5E5]">
                <div className="bg-[#F9F9F9] rounded-xl p-4">
                  <div className="text-sm font-semibold text-[#1F1F1F]/70 mb-1">Total de Sorteios</div>
                  <div className="text-2xl font-bold text-[#1E7F43]">{draws.length}</div>
                </div>
                <div className="bg-[#F9F9F9] rounded-xl p-4">
                  <div className="text-sm font-semibold text-[#1F1F1F]/70 mb-1">Concursos com Sorteios</div>
                  <div className="text-2xl font-bold text-[#3CCB7F]">
                    {new Set(draws.map(d => d.contest_id)).size}
                  </div>
                </div>
                <div className="bg-[#F9F9F9] rounded-xl p-4">
                  <div className="text-sm font-semibold text-[#1F1F1F]/70 mb-1">Último Sorteio</div>
                  <div className="text-sm font-bold text-[#1F1F1F]">
                    {draws.length > 0 ? formatDateOnly(draws[0].draw_date) : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de Sorteios */}
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
              <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Histórico de Sorteios</h2>

              {draws.length === 0 ? (
                <div className="text-center py-12 text-[#1F1F1F]/70">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-[#1F1F1F]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p>Nenhum sorteio encontrado</p>
                  <p className="text-sm mt-2">Clique em "Novo Sorteio" para criar seu primeiro sorteio</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E5E5E5]">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Código</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Concurso</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Data/Hora</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Números Sorteados</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#1F1F1F]">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draws.map((draw) => {
                        const contest = contests.find(c => c.id === draw.contest_id)
                        return (
                          <tr key={draw.id} className="border-b border-[#E5E5E5] hover:bg-[#F9F9F9]">
                            <td className="py-3 px-4">
                              {draw.code ? (
                                <span className="px-2 py-1 bg-[#1E7F43] text-white rounded-lg font-mono text-xs font-bold">
                                  {draw.code}
                                </span>
                              ) : (
                                <span className="text-sm text-[#1F1F1F]/50">N/A</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-[#1F1F1F]">
                                  {contest?.name || 'N/A'}
                                </span>
                                {/* MODIFIQUEI AQUI - Exibir código do concurso */}
                                {contest?.contest_code && (
                                  <span className="text-xs text-[#1F1F1F]/60 font-mono">
                                    Código: {contest.contest_code}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-[#1F1F1F]">
                                {formatDate(draw.draw_date)}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-2 items-center">
                                {draw.numbers.map((num, idx) => (
                                  <span
                                    key={idx}
                                    className="px-3 py-1 bg-[#F4C430] text-[#1F1F1F] rounded-lg font-bold text-sm"
                                  >
                                    {String(num).padStart(2, '0')}
                                  </span>
                                ))}
                                {draw.numbers_count && (
                                  <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold" title={`Quantidade customizada: ${draw.numbers_count} números`}>
                                    {draw.numbers_count}n
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenDrawModal(draw)}
                                  className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs font-semibold"
                                  title="Editar"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(draw.id)}
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

            {/* Modal de Criar/Editar Sorteio */}
            {showDrawModal && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]">
                <div className="bg-white rounded-[2rem] shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col animate-[scaleIn_0.3s_ease-out] overflow-hidden">
                  {/* Header do Modal */}
                  <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E5E5] bg-gradient-to-r from-[#F9F9F9] to-white rounded-t-[2rem]">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#1E7F43]/10 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-extrabold text-[#1F1F1F]">
                        {editingDraw ? 'Editar Sorteio' : 'Novo Sorteio'}
                      </h3>
                    </div>
                    <button
                      onClick={handleCloseDrawModal}
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
                    <div className="space-y-6">
                      <div className="bg-[#F9F9F9] rounded-xl p-4 border border-[#E5E5E5]">
                        <label htmlFor="draw-contest" className="block text-sm font-bold text-[#1F1F1F] mb-3 flex items-center gap-2">
                          <span className="text-[#1E7F43]">*</span>
                          Concurso
                        </label>
                        <select
                          id="draw-contest"
                          value={drawForm.contest_id}
                          onChange={(e) => setDrawForm({ ...drawForm, contest_id: e.target.value, numbers: [] })}
                          className="w-full px-4 py-3 border-2 border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-[#1E7F43] transition-all bg-white font-medium text-[#1F1F1F]"
                          disabled={!!editingDraw}
                        >
                          <option value="">Selecione um concurso</option>
                          {contests.map((contest) => (
                            <option key={contest.id} value={contest.id}>
                              {contest.name} ({contest.numbers_per_participation} números){contest.contest_code ? ` - ${contest.contest_code}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                    {drawForm.contest_id && (
                      <>
                        {/* Quantidade de números customizada (opcional) */}
                        <div className="bg-[#F9F9F9] rounded-xl p-4 border border-[#E5E5E5]">
                          <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-bold text-[#1F1F1F] flex items-center gap-2">
                              Quantidade de Números
                            </label>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#1F1F1F]/60">
                                Padrão: {contests.find(c => c.id === drawForm.contest_id)?.numbers_per_participation || 6}
                              </span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={useCustomNumbersCount}
                                  onChange={(e) => {
                                    setUseCustomNumbersCount(e.target.checked)
                                    if (!e.target.checked) {
                                      // Se desativar, limpar a quantidade customizada e os números
                                      setDrawForm({ ...drawForm, numbers_count: undefined, numbers: [] })
                                    } else {
                                      // Se ativar, definir uma quantidade inicial igual à do concurso
                                      const contest = contests.find(c => c.id === drawForm.contest_id)
                                      setDrawForm({
                                        ...drawForm,
                                        numbers_count: contest?.numbers_per_participation || 6,
                                        numbers: [], // Limpar números ao mudar quantidade
                                      })
                                    }
                                  }}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#1E7F43]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E7F43]"></div>
                                <span className="ml-2 text-xs font-medium text-[#1F1F1F]/70">Customizar</span>
                              </label>
                            </div>
                          </div>
                          {useCustomNumbersCount && (
                            <div className="mt-3">
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={drawForm.numbers_count || ''}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value, 10)
                                  if (!isNaN(value) && value >= 1 && value <= 20) {
                                    // Se mudar a quantidade, limpar os números selecionados
                                    setDrawForm({ ...drawForm, numbers_count: value, numbers: [] })
                                  } else if (e.target.value === '') {
                                    setDrawForm({ ...drawForm, numbers_count: undefined, numbers: [] })
                                  }
                                }}
                                placeholder="Ex: 1 (bolão), 6 (mega)"
                                className="w-full px-4 py-3 border-2 border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-[#1E7F43] transition-all bg-white font-medium text-[#1F1F1F]"
                              />
                              <p className="text-xs text-[#1F1F1F]/60 mt-2">
                                Defina uma quantidade diferente da configuração padrão do concurso.
                                <br />
                                <strong>Exemplo:</strong> Bolão com 1 dezena por sorteio, Mega com 6 números.
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="bg-[#F9F9F9] rounded-xl p-4 border border-[#E5E5E5]">
                          <label htmlFor="draw-date" className="block text-sm font-bold text-[#1F1F1F] mb-3 flex items-center gap-2">
                            <span className="text-[#1E7F43]">*</span>
                            Data e Hora do Sorteio
                          </label>
                          <input
                            id="draw-date"
                            type="datetime-local"
                            value={drawForm.draw_date}
                            onChange={(e) => setDrawForm({ ...drawForm, draw_date: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-[#1E7F43] transition-all bg-white font-medium text-[#1F1F1F]"
                          />
                        </div>

                        <div className="border-t border-[#E5E5E5] pt-4">
                          {(() => {
                            const contest = contests.find(c => c.id === drawForm.contest_id)
                            // Usa quantidade customizada se definida, senão usa a do concurso
                            const requiredCount = (useCustomNumbersCount && drawForm.numbers_count)
                              ? drawForm.numbers_count
                              : (contest?.numbers_per_participation || 6)
                            const selectedCount = drawForm.numbers.length
                            const isComplete = selectedCount === requiredCount

                            return (
                              <div className="mb-4">
                                <div className="flex items-center justify-between mb-4">
                                  <div>
                                    <h4 className="text-lg font-bold text-[#1F1F1F]">Números Sorteados</h4>
                                    <p className="text-sm text-[#1F1F1F]/70 mt-1">
                                      {isComplete ? (
                                        <span className="text-[#1E7F43] font-semibold">
                                          ✓ {selectedCount} de {requiredCount} números selecionados
                                          {useCustomNumbersCount && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Customizado</span>}
                                        </span>
                                      ) : (
                                        <span className={selectedCount < requiredCount ? 'text-orange-600 font-semibold' : 'text-[#1F1F1F]/70'}>
                                          {selectedCount} de {requiredCount} números selecionados
                                          {selectedCount < requiredCount && ` (faltam ${requiredCount - selectedCount})`}
                                          {useCustomNumbersCount && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Customizado</span>}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <button
                                    onClick={handleGenerateRandomNumbers}
                                    className="px-4 py-2 bg-[#3CCB7F] text-white rounded-lg hover:bg-[#1E7F43] transition-colors text-sm font-semibold flex items-center gap-2"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Gerar Aleatórios ({requiredCount} números)
                                  </button>
                                </div>

                                {/* Barra de progresso visual */}
                                <div className="mb-4">
                                  <div className="w-full bg-[#E5E5E5] rounded-full h-3">
                                    <div
                                      className={`h-3 rounded-full transition-all duration-300 ${
                                        isComplete ? 'bg-[#1E7F43]' : selectedCount < requiredCount ? 'bg-orange-500' : 'bg-blue-500'
                                      }`}
                                      style={{ width: `${Math.min((selectedCount / requiredCount) * 100, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })()}

                          {/* Números selecionados */}
                          {drawForm.numbers.length > 0 && (
                            <div className="mb-5 p-4 bg-white rounded-xl border-2 border-[#F4C430]/30">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-bold text-[#1F1F1F] flex items-center gap-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Números Selecionados:
                                </p>
                                <button
                                  onClick={handleClearAllNumbers}
                                  className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-lg transform hover:scale-105"
                                  title="Limpar todos os números selecionados"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Limpar
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {drawForm.numbers.map((num, idx) => (
                                  <span
                                    key={idx}
                                    className="px-4 py-2 bg-gradient-to-br from-[#F4C430] to-[#F4C430]/80 text-[#1F1F1F] rounded-xl font-extrabold text-sm flex items-center gap-2 shadow-md border-2 border-[#F4C430]/50"
                                  >
                                    {String(num).padStart(2, '0')}
                                    <button
                                      onClick={() => handleRemoveNumber(num)}
                                      className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full p-0.5 transition-all"
                                      title="Remover este número"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Grade de números */}
                          {(() => {
                            const contest = contests.find(c => c.id === drawForm.contest_id)
                            const min = contest?.min_number || 0
                            const max = contest?.max_number || 99
                            const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i)
                            // Usa quantidade customizada se definida, senão usa a do concurso
                            const requiredCount = (useCustomNumbersCount && drawForm.numbers_count)
                              ? drawForm.numbers_count
                              : (contest?.numbers_per_participation || 6)
                            const isLimitReached = drawForm.numbers.length >= requiredCount
                            
                            return (
                              <div>
                                <p className="text-sm font-bold text-[#1F1F1F] mb-3 flex items-center gap-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                  </svg>
                                  Selecione os números (Faixa: {String(min).padStart(2, '0')} - {String(max).padStart(2, '0')})
                                  {isLimitReached && (
                                    <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold">
                                      Limite: {requiredCount}
                                    </span>
                                  )}
                                </p>
                                <div className="grid grid-cols-10 gap-2 max-h-64 overflow-y-auto p-3 border-2 border-[#E5E5E5] rounded-xl bg-white custom-scrollbar">
                                  {numbers.map((num) => {
                                    const isSelected = drawForm.numbers.includes(num)
                                    const isDisabled = isSelected || isLimitReached
                                    
                                    return (
                                      <button
                                        key={num}
                                        onClick={() => handleAddNumber(num)}
                                        disabled={isDisabled}
                                        className={`px-3 py-2.5 rounded-xl font-extrabold text-sm transition-all duration-200 ${
                                          isSelected
                                            ? 'bg-gradient-to-br from-[#1E7F43] to-[#3CCB7F] text-white cursor-not-allowed shadow-lg scale-105'
                                            : isLimitReached
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                                            : 'bg-[#F9F9F9] text-[#1F1F1F] hover:bg-gradient-to-br hover:from-[#F4C430] hover:to-[#F4C430]/80 hover:text-[#1F1F1F] hover:shadow-md hover:scale-105 border-2 border-transparent hover:border-[#F4C430]/50'
                                        }`}
                                        title={isLimitReached && !isSelected ? `Limite de ${requiredCount} números atingido` : ''}
                                      >
                                        {String(num).padStart(2, '0')}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      </>
                    )}
                    </div>
                  </div>

                  {/* Footer do Modal */}
                  <div className="px-6 py-5 border-t border-[#E5E5E5] bg-gradient-to-r from-white to-[#F9F9F9] flex items-center justify-end gap-4 rounded-b-[2rem]">
                    <button
                      onClick={handleCloseDrawModal}
                      className="px-6 py-3 bg-gray-200 text-[#1F1F1F] rounded-xl hover:bg-gray-300 transition-all duration-200 font-bold shadow-sm hover:shadow-md"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveDraw}
                      disabled={savingDraw}
                      className="px-8 py-3 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white rounded-xl hover:from-[#3CCB7F] hover:to-[#1E7F43] transition-all duration-300 font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                    >
                      {savingDraw ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Salvando...
                        </>
                      ) : (
                        <>
                          {editingDraw ? (
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
                              Criar Sorteio
                            </>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full animate-[scaleIn_0.3s_ease-out]">
                  <h3 className="text-xl font-bold text-[#1F1F1F] mb-4">Confirmar Exclusão</h3>
                  <p className="text-[#1F1F1F]/70 mb-6">
                    Tem certeza que deseja excluir este sorteio? Esta ação não pode ser desfeita.
                    <br />
                    <span className="text-sm font-semibold text-red-600">
                      ⚠️ Atenção: Sorteios são eventos históricos e geralmente não devem ser deletados.
                    </span>
                  </p>
                  <div className="flex items-center justify-end gap-4">
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="px-6 py-2 bg-gray-300 text-[#1F1F1F] rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleDeleteDraw(showDeleteConfirm)}
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
  )
}
