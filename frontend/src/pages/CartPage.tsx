/**
 * Página do Carrinho de Apostas
 *
 * Exibe todos os itens no carrinho e permite finalizar a compra
 */
import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { createParticipation } from '../services/participationsService'
import { createPixPayment } from '../services/mercadopagoService'
import { checkPixPaymentStatus } from '../services/paymentsService'
import { listActiveContests } from '../services/contestsService'
import { Contest } from '../types'
import Header from '../components/Header'
import Footer from '../components/Footer'

// MODIFIQUEI AQUI - Última compra (localStorage)
const LAST_PURCHASE_KEY = 'dezaqui_last_purchase_v1'

// MODIFIQUEI AQUI - helper para salvar última compra como múltiplas linhas (opção A)
function saveLastPurchaseFromCart(params: {
  contestId: string
  selections: number[][]
}) {
  const payload = {
    contestId: String(params.contestId),
    selections: (params.selections || [])
      .filter((arr) => Array.isArray(arr))
      .map((arr) =>
        arr
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n >= 0)
          .sort((a, b) => a - b)
      )
      .filter((arr) => arr.length > 0),
    timestamp: Date.now(),
  }

  try {
    localStorage.setItem(LAST_PURCHASE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }

  return payload
}

// MODIFIQUEI AQUI - helper para ler última compra
function getLastPurchase(): { contestId: string; selections: number[][]; timestamp?: number } | null {
  try {
    const raw = localStorage.getItem(LAST_PURCHASE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || !parsed.contestId || !Array.isArray(parsed.selections)) return null

    const selections = parsed.selections
      .filter((arr: any) => Array.isArray(arr))
      .map((arr: any) =>
        arr
          .map((n: any) => Number(n))
          .filter((n: number) => Number.isInteger(n) && n >= 0)
          .sort((a: number, b: number) => a - b)
      )
      .filter((arr: number[]) => arr.length > 0)

    if (selections.length === 0) return null

    return {
      contestId: String(parsed.contestId),
      selections,
      timestamp: parsed.timestamp ? Number(parsed.timestamp) : undefined,
    }
  } catch {
    return null
  }
}

export default function CartPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { items, removeItem, clearCart, getItemCount, getTotalPrice, addItem, reloadCart } = useCart()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pixQrCode, setPixQrCode] = useState<string>('')
  const [pixPayload, setPixPayload] = useState<string>('')
  const [pixExpirationDate, setPixExpirationDate] = useState<string>('')
  const [pixPaymentId, setPixPaymentId] = useState<string>('')
  const [pixConfirmed, setPixConfirmed] = useState<{ ticketCodes: string[] } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cash' | null>(null)
  const [createdTicketCodes, setCreatedTicketCodes] = useState<string[]>([])
  const [paidAmount, setPaidAmount] = useState<number>(0) // Valor pago (salvo antes de limpar carrinho)
  const [pixCartItemsForDisplay, setPixCartItemsForDisplay] = useState<Array<{ contestName: string; contestCode?: string; selectedNumbers: number[]; price: number }>>([]) // Itens salvos para exibir no box quando Pix
  const processingRef = useRef(false)

  // MODIFIQUEI AQUI - Estados para o box de última compra
  const [lastPurchase, setLastPurchase] = useState<{ contestId: string; selections: number[][]; timestamp?: number } | null>(null)
  const [activeContests, setActiveContests] = useState<Contest[]>([])
  const [selectedLastPurchaseIndices, setSelectedLastPurchaseIndices] = useState<number[]>([])
  const [selectedActiveContestIds, setSelectedActiveContestIds] = useState<string[]>([])
  const [applyingLastPurchase, setApplyingLastPurchase] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessagesList, setErrorMessagesList] = useState<string[]>([])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // MODIFIQUEI AQUI - Carregar última compra e concursos ativos
  useEffect(() => {
    async function loadData() {
      // Carregar última compra
      const last = getLastPurchase()
      setLastPurchase(last)

      // Carregar concursos ativos
      try {
        const contests = await listActiveContests()
        setActiveContests(contests)

        // Se houver apenas um concurso ativo, selecionar automaticamente
        if (contests.length === 1) {
          setSelectedActiveContestIds([contests[0].id])
        }
      } catch (err) {
        console.error('[CartPage] Erro ao carregar concursos ativos:', err)
      }
    }

    loadData()
  }, [])

  // Polling para verificar confirmação do Pix
  useEffect(() => {
    if (!pixPaymentId || pixConfirmed) return

    const checkStatus = async () => {
      const result = await checkPixPaymentStatus(pixPaymentId)
      if (result.paid && result.ticketCodes.length > 0) {
        setPixConfirmed({ ticketCodes: result.ticketCodes })
        // Redirecionar imediatamente para página de sucesso
        navigate('/compra/sucesso', {
          replace: true,
          state: {
            paymentMethod: 'pix',
            ticketCodes: result.ticketCodes,
            fromCart: true,
          },
        })
      }
    }

    const interval = setInterval(checkStatus, 3000)
    checkStatus()

    return () => clearInterval(interval)
  }, [pixPaymentId, pixConfirmed, navigate])

  // Redirecionar para página de sucesso ao invés de mostrar inline
  useEffect(() => {
    if (!success) return

    if (paymentMethod === 'pix' && pixConfirmed?.ticketCodes?.length) {
      navigate('/compra/sucesso', {
        replace: true,
        state: {
          paymentMethod: 'pix',
          ticketCodes: pixConfirmed.ticketCodes,
          fromCart: true,
        },
      })
    } else if (paymentMethod === 'cash' && createdTicketCodes.length > 0) {
      navigate('/compra/sucesso', {
        replace: true,
        state: {
          paymentMethod: 'cash',
          ticketCodes: createdTicketCodes,
          fromCart: true,
        },
      })
    }
  }, [success, paymentMethod, pixConfirmed, createdTicketCodes, navigate])

  // MODIFIQUEI AQUI - Recarregar carrinho do localStorage quando o usuário fizer login
  useEffect(() => {
    if (user) {
      // Quando o usuário faz login, sempre recarregar o carrinho do localStorage
      // Isso garante que os itens persistidos sejam exibidos
      const timer = setTimeout(() => {
        reloadCart()
        console.log('[CartPage] Carrinho recarregado após login')
      }, 100) // Pequeno delay para garantir que o contexto está pronto

      return () => clearTimeout(timer)
    }
  }, [user, reloadCart])

  // MODIFIQUEI AQUI - Toggle seleção de números da última compra
  const toggleLastPurchaseSelection = (index: number) => {
    setSelectedLastPurchaseIndices((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    )
  }

  // MODIFIQUEI AQUI - Toggle seleção de concurso
  const toggleContestSelection = (contestId: string) => {
    setSelectedActiveContestIds((prev) =>
      prev.includes(contestId)
        ? prev.filter((id) => id !== contestId)
        : [...prev, contestId]
    )
  }

  // MODIFIQUEI AQUI - Selecionar todos os números
  const selectAllNumbers = () => {
    if (!lastPurchase) return
    setSelectedLastPurchaseIndices(lastPurchase.selections.map((_, index) => index))
  }

  // MODIFIQUEI AQUI - Desmarcar todos os números
  const deselectAllNumbers = () => {
    setSelectedLastPurchaseIndices([])
  }

  // MODIFIQUEI AQUI - Selecionar todos os concursos
  const selectAllContests = () => {
    setSelectedActiveContestIds(activeContests.map((c) => c.id))
  }

  // MODIFIQUEI AQUI - Desmarcar todos os concursos
  const deselectAllContests = () => {
    setSelectedActiveContestIds([])
  }

  // MODIFIQUEI AQUI - Aplicar números da última compra nos concursos ativos selecionados
  const handleApplyLastPurchase = () => {
    if (!lastPurchase || selectedLastPurchaseIndices.length === 0 || selectedActiveContestIds.length === 0) {
      setError('Por favor, selecione pelo menos um conjunto de números e um concurso')
      return
    }

    try {
      setApplyingLastPurchase(true)
      setError(null)

      let successCount = 0
      let errorMessages: string[] = []

      // Para cada combinação de números selecionados e concursos selecionados
      for (const numberIndex of selectedLastPurchaseIndices) {
        const selectedNumbers = lastPurchase.selections[numberIndex]
        if (!selectedNumbers || selectedNumbers.length === 0) continue

        for (const contestId of selectedActiveContestIds) {
          const contest = activeContests.find((c) => c.id === contestId)
          if (!contest) {
            errorMessages.push(`Concurso não encontrado`)
            continue
          }

          // Validar se os números são compatíveis com o concurso
          if (selectedNumbers.length !== contest.numbers_per_participation) {
            errorMessages.push(`${contest.name}: requer ${contest.numbers_per_participation} números`)
            continue
          }

          const invalidNumbers = selectedNumbers.filter(
            (n) => n < contest.min_number || n > contest.max_number
          )
          if (invalidNumbers.length > 0) {
            errorMessages.push(`${contest.name}: números fora do intervalo (${contest.min_number} - ${contest.max_number})`)
            continue
          }

          // Adicionar ao carrinho
          addItem(contest, selectedNumbers)
          successCount++
        }
      }

      if (errorMessages.length > 0) {
        setErrorMessagesList(errorMessages)
        setShowErrorModal(true)
      }

      // Feedback de sucesso
      setTimeout(() => {
        setApplyingLastPurchase(false)
        if (successCount > 0) {
          setSelectedLastPurchaseIndices([])
          setSelectedActiveContestIds([])
        }
      }, 1000)
    } catch (err) {
      console.error('[CartPage] Erro ao aplicar última compra:', err)
      const errorMsg = err instanceof Error ? err.message : 'Erro ao aplicar números'
      setErrorMessagesList([errorMsg])
      setShowErrorModal(true)
      setApplyingLastPurchase(false)
    }
  }

  const handleRemoveItem = (itemId: string) => {
    if (processing) return
    removeItem(itemId)
  }

  const handleClearCart = () => {
    if (processing) return
    if (window.confirm('Tem certeza que deseja limpar todo o carrinho?')) {
      clearCart()
    }
  }

  const handlePaymentMethodSelect = (method: 'pix' | 'cash') => {
    setPaymentMethod(method)
    setError(null)
  }

  const handleCheckout = async () => {
    if (!user || !profile || items.length === 0 || processingRef.current) return

    // Validar CPF para pagamento via Pix
    const cpfDigits = String(profile?.cpf || '').replace(/\D/g, '')
    if (paymentMethod === 'pix' && cpfDigits.length !== 11) {
      setError('Para pagar via Pix, é necessário cadastrar seu CPF. Acesse "Minha Conta" nas configurações do seu perfil para adicionar o CPF, ou escolha pagamento em Dinheiro.')
      return
    }

    try {
      processingRef.current = true
      setProcessing(true)
      setError(null)

      const firstItem = items[0]
      const cartContestId = firstItem?.contestId ? String(firstItem.contestId) : ''
      if (!cartContestId) {
        throw new Error('contestId é obrigatório para finalizar a compra')
      }

      if (paymentMethod === 'pix') {
        // Pix: NÃO criar participação aqui - ticket só é criado pelo webhook APÓS confirmação do pagamento
        const totalAmount = getTotalPrice()
        setPaidAmount(totalAmount)
        setCreatedTicketCodes([])

        const cartItems: Array<{ contestId: string; selectedNumbers: number[]; amount: number }> = items.map((item) => {
          if (!item?.contestId) throw new Error('contestId é obrigatório')
          const amount = Number(item.price)
          if (!Number.isFinite(amount) || amount <= 0) throw new Error('Valor inválido')
          return {
            contestId: item.contestId,
            selectedNumbers: item.selectedNumbers,
            amount,
          }
        })

        const pixData = await createPixPayment({
          contestId: cartContestId,
          selectedNumbers: firstItem.selectedNumbers,
          participationId: '',
          ticketCode: '',
          amount: totalAmount,
          description: 'Pedido de Compra',
          customerName: profile.name || 'Cliente',
          customerEmail: profile.email || undefined,
          customerPhone: profile.phone || undefined,
          customerCpfCnpj: cpfDigits,
          cartItems,
        })

        setPixPaymentId(pixData.id)
        setPixQrCode(pixData.qrCode.encodedImage)
        setPixPayload(pixData.qrCode.payload)
        setPixExpirationDate(pixData.qrCode.expirationDate)
      } else {
        // Dinheiro: criar participações (fluxo antigo)
        const participations = []
        const ticketCodes: string[] = []

        for (const item of items) {
          if (!item?.contestId) {
            throw new Error('contestId é obrigatório para criar participação')
          }
          const amount = Number(item.price)
          if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error('Valor inválido para criar participação')
          }

          const participation = await createParticipation({
            contestId: item.contestId,
            numbers: item.selectedNumbers,
            amount,
          })
          participations.push(participation)
          if (participation.ticket_code) {
            ticketCodes.push(participation.ticket_code)
          }
        }

        setCreatedTicketCodes(ticketCodes)
        setPaidAmount(getTotalPrice())
      }

      // MODIFIQUEI AQUI - Atualizar Última Compra SOMENTE após finalizar a compra com sucesso (opção A)
      // Se o carrinho tiver itens de múltiplos concursos, salvamos o concurso do último item.
      const lastItem = items[items.length - 1]
      if (lastItem?.contestId) {
        const contestId = lastItem.contestId
        const selections = items
          .filter((it) => it.contestId === contestId)
          .map((it) => it.selectedNumbers)
        saveLastPurchaseFromCart({ contestId, selections })
      }

      // Salvar itens para exibir no box "Informações da Participação" quando Pix (antes de limpar)
      if (paymentMethod === 'pix') {
        setPixCartItemsForDisplay(
          items.map((it) => ({
            contestName: it.contestName,
            contestCode: it.contestCode,
            selectedNumbers: it.selectedNumbers,
            price: it.price,
          }))
        )
      }

      // Limpar carrinho após sucesso
      clearCart()
      setSuccess(true)
    } catch (err) {
      console.error('Erro ao processar checkout:', err)
      setError(err instanceof Error ? err.message : 'Erro ao processar pagamento')
    } finally {
      setProcessing(false)
      processingRef.current = false
    }
  }

  const copyPixPayload = () => {
    if (pixPayload) {
      navigator.clipboard.writeText(pixPayload)
      const btn = document.getElementById('copy-pix-btn')
      if (btn) {
        const originalText = btn.textContent
        btn.textContent = 'Copiado!'
        setTimeout(() => {
          btn.textContent = originalText
        }, 2000)
      }
    }
  }

  // Tela de sucesso após checkout - redireciona para /compra/sucesso (ou mostra QR Pix enquanto aguarda)
  if (success) {
    const shouldRedirect =
      (paymentMethod === 'pix' && pixConfirmed?.ticketCodes?.length) ||
      (paymentMethod === 'cash' && createdTicketCodes.length > 0)

    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          {shouldRedirect ? (
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5]">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto mb-4"></div>
                <p className="text-[#1F1F1F]/70">Redirecionando para página de sucesso...</p>
              </div>
            </div>
          ) : paymentMethod === 'pix' && pixQrCode ? (
            <>
              {/* Informações da Participação - visível ao lado do QR Pix */}
              {pixCartItemsForDisplay.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-[#E5E5E5]">
                  <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Informações da Participação</h2>
                  <div className="space-y-4">
                    {pixCartItemsForDisplay.map((item, idx) => (
                      <div key={idx} className={idx > 0 ? 'pt-4 border-t border-[#E5E5E5]' : ''}>
                        <div>
                          <span className="text-sm text-[#1F1F1F]/60">Concurso:</span>
                          <p className="font-semibold text-[#1F1F1F]">{item.contestName}</p>
                          {item.contestCode && (
                            <p className="text-xs text-[#1F1F1F]/70 mt-1 font-mono">
                              Código do Concurso: {item.contestCode}
                            </p>
                          )}
                        </div>
                        <div className="mt-3">
                          <span className="text-sm text-[#1F1F1F]/60">Números Selecionados:</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {[...item.selectedNumbers].sort((a, b) => a - b).map((num) => (
                              <span
                                key={num}
                                className="px-3 py-1 bg-[#1E7F43] text-white rounded-lg font-bold text-sm"
                              >
                                {num.toString().padStart(2, '0')}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-3 mt-3 border-t border-[#E5E5E5]">
                          <span className="text-[#1F1F1F]/70">Valor:</span>
                          <span className="font-semibold text-[#1F1F1F]">{formatCurrency(item.price)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-4 border-t-2 border-[#E5E5E5]">
                      <span className="text-lg font-semibold text-[#1F1F1F]">Valor Total:</span>
                      <span className="text-2xl font-extrabold text-[#1E7F43]">{formatCurrency(paidAmount)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5]">
                <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Pagamento via Pix</h2>

                <div className="text-center space-y-4">
                {/* QR Code - container fixo para anular max-width:100% do Tailwind preflight */}
                <div className="flex justify-center">
                  <div className="w-[300px] h-[300px] shrink-0 border-2 border-[#E5E5E5] rounded-xl p-3 bg-white flex items-center justify-center">
                    <img
                      src={`data:image/png;base64,${pixQrCode}`}
                      alt="QR Code Pix"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                    Código Pix (Copia e Cola):
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      readOnly
                      value={pixPayload}
                      className="flex-1 min-w-0 px-4 py-2.5 sm:py-2 border border-[#E5E5E5] rounded-lg font-mono text-xs sm:text-sm bg-[#F9F9F9]"
                    />
                    <button
                      id="copy-pix-btn"
                      onClick={copyPixPayload}
                      className="shrink-0 px-6 py-3 sm:py-2 bg-[#1E7F43] text-white rounded-lg font-semibold hover:bg-[#3CCB7F] transition-colors min-h-[44px] touch-manipulation"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Valor Total:</strong> {formatCurrency(paidAmount)}
                  </p>
                  <p className="text-sm text-blue-800 mt-1">
                    Após a confirmação do pagamento Pix, seus tickets aparecerão automaticamente em <strong>Meus Tickets</strong>.
                  </p>
                  {pixExpirationDate && (
                    <p className="text-sm text-blue-800 mt-1">
                      <strong>Válido até:</strong> {formatDateTime(pixExpirationDate)}
                    </p>
                  )}
                  <p className="text-sm text-blue-800 mt-2">
                    Após o pagamento, suas participações serão ativadas automaticamente.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    to="/contests"
                    className="w-full sm:w-auto text-center px-6 py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors min-h-[44px] flex items-center justify-center touch-manipulation"
                  >
                    Ver Concursos
                  </Link>
                  <Link
                    to="/my-tickets"
                    className="w-full sm:w-auto text-center px-6 py-3 bg-white border-2 border-[#1E7F43] text-[#1E7F43] rounded-xl font-semibold hover:bg-[#1E7F43]/5 transition-colors min-h-[44px] flex items-center justify-center touch-manipulation"
                  >
                    Ver Meus Tickets
                  </Link>
                </div>
              </div>
            </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5]">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto mb-4"></div>
                <p className="text-[#1F1F1F]/70">Redirecionando para página de sucesso...</p>
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Cabecalho */}
        <div className="mb-6">
          <Link
            to="/contests"
            className="inline-flex items-center gap-2 text-[#1E7F43] hover:text-[#3CCB7F] font-semibold mb-4 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Continuar Comprando
          </Link>

          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <div>
              <h1 className="text-3xl font-extrabold text-[#1F1F1F]">
                Meu Carrinho
              </h1>
              {/* MODIFIQUEI AQUI - Só mostrar contador quando estiver logado e tiver itens */}
              {user && items.length > 0 && (
                <p className="text-[#1F1F1F]/70">
                  {getItemCount()} {getItemCount() === 1 ? 'item' : 'itens'} no carrinho
                </p>
              )}
            </div>
          </div>
        </div>

        {error && !showErrorModal && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* MODIFIQUEI AQUI - Modal de erro bonito */}
        {showErrorModal && errorMessagesList.length > 0 && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowErrorModal(false)
              setErrorMessagesList([])
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col transform transition-all" onClick={(e) => e.stopPropagation()}>
              {/* Cabeçalho do Modal */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-white">Não foi possível adicionar alguns itens</h2>
                </div>
                <button
                  onClick={() => {
                    setShowErrorModal(false)
                    setErrorMessagesList([])
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Conteúdo do Modal */}
              <div className="p-6 overflow-y-auto flex-1">
                <p className="text-[#1F1F1F] mb-4 font-medium">
                  Os seguintes itens não puderam ser adicionados ao carrinho:
                </p>
                <div className="space-y-3">
                  {errorMessagesList.map((errorMsg, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v6m0 0v.01M12 15h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-red-700 text-sm flex-1 font-medium">{errorMsg}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div className="px-6 py-4 bg-[#F9F9F9] border-t border-[#E5E5E5] flex justify-end">
                <button
                  onClick={() => {
                    setShowErrorModal(false)
                    setErrorMessagesList([])
                  }}
                  className="px-6 py-2 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors shadow-md hover:shadow-lg"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODIFIQUEI AQUI - Se não estiver logado, sempre mostrar carrinho vazio */}
        {!user ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-[#E5E5E5] text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-[#1F1F1F]/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Carrinho Vazio</h2>
            <p className="text-[#1F1F1F]/70 mb-4">
              Voce ainda nao adicionou nenhuma aposta ao carrinho.
            </p>
            <Link
              to="/contests"
              className="inline-block px-6 py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors"
            >
              Ver Concursos Disponiveis
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-[#E5E5E5] text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-[#1F1F1F]/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Carrinho Vazio</h2>
            <p className="text-[#1F1F1F]/70 mb-4">
              Voce ainda nao adicionou nenhuma aposta ao carrinho.
            </p>
            <Link
              to="/contests"
              className="inline-block px-6 py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors"
            >
              Ver Concursos Disponiveis
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de Itens */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-[#1F1F1F] text-lg">{item.contestName}</h3>
                      {item.contestCode && (
                        <p className="text-xs text-[#1F1F1F]/60 font-mono">
                          Codigo: {item.contestCode}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={processing}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Remover item"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="mb-4">
                    <span className="text-sm text-[#1F1F1F]/60">Numeros Selecionados:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {item.selectedNumbers.map((num) => (
                        <span
                          key={num}
                          className="px-3 py-1 bg-[#1E7F43] text-white rounded-lg font-bold text-sm"
                        >
                          {num.toString().padStart(2, '0')}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-[#E5E5E5]">
                    <span className="text-sm text-[#1F1F1F]/60">Valor:</span>
                    <span className="text-xl font-bold text-[#1E7F43]">
                      {formatCurrency(item.price)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Botao Limpar Carrinho */}
              <button
                onClick={handleClearCart}
                disabled={processing}
                className="w-full py-3 text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
              >
                Limpar Carrinho
              </button>
            </div>

            {/* Resumo e Checkout */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5] sticky top-24">
                <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Resumo do Pedido</h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-[#1F1F1F]/70">Quantidade de apostas:</span>
                    <span className="font-semibold">{getItemCount()}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-[#E5E5E5]">
                    <span className="text-lg font-semibold text-[#1F1F1F]">Total:</span>
                    <span className="text-2xl font-extrabold text-[#1E7F43]">
                      {formatCurrency(getTotalPrice())}
                    </span>
                  </div>
                </div>

                {/* Selecao de Metodo de Pagamento */}
                <div className="space-y-3 mb-6">
                  <p className="text-sm font-semibold text-[#1F1F1F]">Forma de Pagamento:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handlePaymentMethodSelect('pix')}
                      disabled={processing}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        paymentMethod === 'pix'
                          ? 'border-[#1E7F43] bg-[#1E7F43]/5'
                          : 'border-[#E5E5E5] hover:border-[#1E7F43]'
                      } ${processing ? 'opacity-50' : ''}`}
                    >
                      <div className="text-2xl mb-1">💳</div>
                      <span className="text-sm font-semibold">Pix</span>
                    </button>
                    <button
                      onClick={() => handlePaymentMethodSelect('cash')}
                      disabled={processing}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        paymentMethod === 'cash'
                          ? 'border-[#1E7F43] bg-[#1E7F43]/5'
                          : 'border-[#E5E5E5] hover:border-[#1E7F43]'
                      } ${processing ? 'opacity-50' : ''}`}
                    >
                      <div className="text-2xl mb-1">💵</div>
                      <span className="text-sm font-semibold">Dinheiro</span>
                    </button>
                  </div>
                </div>

                {/* Botao de Finalizar */}
                <button
                  onClick={handleCheckout}
                  disabled={processing || !paymentMethod || !user}
                  className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-colors ${
                    processing || !paymentMethod || !user
                      ? 'bg-[#E5E5E5] text-[#1F1F1F]/60 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white hover:from-[#3CCB7F] hover:to-[#1E7F43]'
                  }`}
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processando...
                    </span>
                  ) : !user ? (
                    'Faca login para continuar'
                  ) : !paymentMethod ? (
                    'Selecione a forma de pagamento'
                  ) : (
                    'Finalizar Compra'
                  )}
                </button>

                {!user && (
                  <Link
                    to="/login"
                    className="block text-center mt-3 text-[#1E7F43] font-semibold hover:underline"
                  >
                    Fazer Login
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}