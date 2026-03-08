/**
 * Página de Checkout
 * FASE 3: Pagamentos e Ativação
 * 
 * Exibe informações da participação e opções de pagamento (Pix ou Dinheiro)
 */
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { getContestById } from '../services/contestsService'
import { createParticipation } from '../services/participationsService'
import { createPixPayment } from '../services/mercadopagoService'
import { checkPixPaymentStatus } from '../services/paymentsService'
import { getDiscountByCode, calculateDiscountedPrice, incrementDiscountUses } from '../services/discountsService'
import { Contest, Participation, Discount } from '../types'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/Header'
import Footer from '../components/Footer'

interface LocationState {
  selectedNumbers: number[]
}


// MODIFIQUEI AQUI - Última compra (localStorage) - atualiza SOMENTE quando finaliza com sucesso
const LAST_PURCHASE_KEY = 'dezaqui_last_purchase_v1'

function saveLastPurchase(params: { contestId: string; selections: number[][] }) {
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

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, loading: authLoading } = useAuth()
  const [contest, setContest] = useState<Contest | null>(null)
  const [participation, setParticipation] = useState<Participation | null>(null)
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cash' | null>(null)
  const [pixQrCode, setPixQrCode] = useState<string>('')
  const [pixPayload, setPixPayload] = useState<string>('')
  const [pixExpirationDate, setPixExpirationDate] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pixPaymentId, setPixPaymentId] = useState<string>('') // ID Asaas para polling
  const [pixConfirmed, setPixConfirmed] = useState<{ ticketCodes: string[]; contestId?: string } | null>(null)
  const participationCreatedRef = useRef(false) // MODIFIQUEI AQUI - Flag para evitar criação duplicada
  const isCreatingRef = useRef(false) // MODIFIQUEI AQUI - Flag para evitar race condition

  // MODIFIQUEI AQUI - Estados para desconto
  const [discountCode, setDiscountCode] = useState<string>('')
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null)
  const [validatingDiscount, setValidatingDiscount] = useState(false)
  const [discountError, setDiscountError] = useState<string | null>(null)

  useEffect(() => {
    // MODIFIQUEI AQUI - Verificar se há números selecionados (location.state ou sessionStorage)
    let state = location.state as LocationState

    // Se não há números no location.state, tentar restaurar do sessionStorage
    if (!state?.selectedNumbers || state.selectedNumbers.length === 0) {
      try {
        const savedData = sessionStorage.getItem('dezaqui_checkout')
        if (savedData) {
          const parsed = JSON.parse(savedData)
          // Verificar se os dados são do mesmo concurso e não são muito antigos (1 hora)
          const oneHourAgo = Date.now() - (60 * 60 * 1000)
          if (parsed.contestId === id && parsed.timestamp > oneHourAgo && parsed.selectedNumbers?.length > 0) {
            state = { selectedNumbers: parsed.selectedNumbers }
            console.log('[CheckoutPage] Estado restaurado do sessionStorage:', parsed.selectedNumbers)
          }
        }
      } catch (err) {
        console.error('[CheckoutPage] Erro ao restaurar sessionStorage:', err)
      }
    }

    if (!state?.selectedNumbers || state.selectedNumbers.length === 0) {
      // Se não há números, redirecionar para página de seleção
      if (id) {
        navigate(`/contests/${id}/join`)
      } else {
        navigate('/contests')
      }
      return
    }

    // MODIFIQUEI AQUI - Garantir que os números são números válidos
    // Primeiro, normalizar os números (converter strings para números)
    const normalizedNumbers = state.selectedNumbers.map(n => {
      if (typeof n === 'number') return n
      if (typeof n === 'string') {
        const parsed = parseInt(n, 10)
        return Number.isNaN(parsed) ? null : parsed
      }
      const num = Number(n)
      return Number.isNaN(num) ? null : num
    })

    // Filtrar apenas números válidos (inteiros, não null, >= 0)
    const validNumbers = normalizedNumbers.filter((n): n is number =>
      n !== null && Number.isInteger(n) && n >= 0
    ).sort((a, b) => a - b) // MODIFIQUEI AQUI - Ordenar números

    if (validNumbers.length !== state.selectedNumbers.length) {
      console.error('[CheckoutPage] Erro ao processar números:', state.selectedNumbers)
      console.error('[CheckoutPage] Números normalizados:', normalizedNumbers)
      console.error('[CheckoutPage] Números válidos:', validNumbers)
      setError('Números inválidos. Por favor, selecione novamente.')
      return
    }

    setSelectedNumbers(validNumbers)
  }, [location.state, id, navigate])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      if (!id || !user || selectedNumbers.length === 0) {
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Carregar concurso
        const contestData = await getContestById(id)
        if (cancelled) return

        if (!contestData) {
          setError('Concurso não encontrado')
          return
        }

        if (contestData.status !== 'active') {
          setError('Este concurso não está ativo para participação')
          return
        }

        // Validar se os números estão dentro do intervalo do concurso
        const invalidNumbers = selectedNumbers.filter(n =>
          n < contestData.min_number || n > contestData.max_number
        )
        if (invalidNumbers.length > 0) {
          setError(
            `Números fora do intervalo permitido (${contestData.min_number} - ${contestData.max_number}): ${invalidNumbers.join(', ')}`
          )
          return
        }

        setContest(contestData)
        // NÃO criar participação aqui - será criada apenas quando o usuário clicar em "Pagar"
      } catch (err) {
        if (cancelled) return
        console.error('Erro ao carregar dados:', err)
        setError(err instanceof Error ? err.message : 'Erro ao carregar concurso')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    if (!authLoading && user && selectedNumbers.length > 0) {
      loadData()
    }

    return () => {
      cancelled = true
    }
  }, [id, user, authLoading, selectedNumbers])

  // Polling para verificar confirmação do Pix
  useEffect(() => {
    if (!pixPaymentId || pixConfirmed || !id) return

    const checkStatus = async () => {
      const result = await checkPixPaymentStatus(pixPaymentId)
      if (result.paid && result.ticketCodes.length > 0) {
        setPixConfirmed({
          ticketCodes: result.ticketCodes,
          contestId: result.contestId,
        })
        // Redirecionar imediatamente para página de sucesso
        navigate('/compra/sucesso', {
          replace: true,
          state: {
            paymentMethod: 'pix',
            ticketCodes: result.ticketCodes,
            contestId: result.contestId || id,
            fromCart: false,
          },
        })
      }
    }

    const interval = setInterval(checkStatus, 3000)
    checkStatus()

    return () => clearInterval(interval)
  }, [pixPaymentId, pixConfirmed, id, navigate])

  // Redirecionar para página de sucesso ao invés de mostrar inline
  useEffect(() => {
    if (!success || !id) return

    if (paymentMethod === 'cash' && participation?.ticket_code) {
      navigate('/compra/sucesso', {
        replace: true,
        state: {
          paymentMethod: 'cash',
          ticketCodes: [participation.ticket_code],
          contestId: id,
          fromCart: false,
        },
      })
    } else if (paymentMethod === 'pix' && pixConfirmed?.ticketCodes?.length) {
      navigate('/compra/sucesso', {
        replace: true,
        state: {
          paymentMethod: 'pix',
          ticketCodes: pixConfirmed.ticketCodes,
          contestId: pixConfirmed.contestId || id,
          fromCart: false,
        },
      })
    }
  }, [success, paymentMethod, participation?.ticket_code, pixConfirmed, id, navigate])

  const handlePaymentMethodSelect = (method: 'pix' | 'cash') => {
    setPaymentMethod(method)
    setError(null)
  }

  // MODIFIQUEI AQUI - Calcular valor final com desconto
  const getFinalAmount = (): number => {
    const baseAmount = contest?.participation_value || 0
    if (appliedDiscount) {
      return calculateDiscountedPrice(baseAmount, appliedDiscount)
    }
    return baseAmount
  }

  // MODIFIQUEI AQUI - Calcular valor do desconto
  const getDiscountAmount = (): number => {
    const baseAmount = contest?.participation_value || 0
    const finalAmount = getFinalAmount()
    return baseAmount - finalAmount
  }

  const handleCashPayment = async () => {
    if (!contest || !profile || selectedNumbers.length === 0) return

    // Evitar múltiplas chamadas simultâneas
    if (processing || participationCreatedRef.current) return

    try {
      setProcessing(true)
      setError(null)

      // MODIFIQUEI AQUI - Valor final travado no checkout
      const finalAmount = getFinalAmount()

      // Criar participação antes de processar pagamento em dinheiro
      let participationData = participation

      if (!participationData) {
        console.log('[CheckoutPage] Criando participação para pagamento em dinheiro...')
        participationCreatedRef.current = true

        participationData = await createParticipation({
          contestId: contest.id,
          numbers: selectedNumbers,
          amount: finalAmount, // MODIFIQUEI AQUI - trava valor na participation
        })

        setParticipation(participationData)
      }

      // Incrementar uso do desconto se aplicado
      if (appliedDiscount) {
        try {
          await incrementDiscountUses(appliedDiscount.id)
        } catch (err) {
          console.error('Erro ao incrementar uso do desconto:', err)
          // Não falhar o processo se houver erro ao incrementar desconto
        }
      }

      // Pagamento em dinheiro não cria pagamento automaticamente
      // Apenas confirma que a participação foi criada e ficará pendente até o admin ativar

      // MODIFIQUEI AQUI - Salvar última compra SOMENTE após finalizar com sucesso
      saveLastPurchase({ contestId: contest.id, selections: [selectedNumbers] })

      // MODIFIQUEI AQUI - Removido duplicado (estava salvando duas vezes)
      // saveLastPurchase({ contestId: contest.id, selections: [selectedNumbers] })

      // Limpar sessionStorage após sucesso
      sessionStorage.removeItem('dezaqui_checkout')

      setSuccess(true)
    } catch (err) {
      console.error('Erro ao processar pagamento em dinheiro:', err)
      setError(err instanceof Error ? err.message : 'Erro ao processar participação')

      // Se falhou após criar participação, resetar flag
      if (participationCreatedRef.current) {
        participationCreatedRef.current = false
        setParticipation(null)
      }
    } finally {
      setProcessing(false)
    }
  }

  // MODIFIQUEI AQUI - Função para validar e aplicar desconto
  const handleApplyDiscount = async () => {
    if (!discountCode.trim() || !contest) return

    try {
      setValidatingDiscount(true)
      setDiscountError(null)

      const discount = await getDiscountByCode(discountCode.trim())

      if (!discount) {
        setDiscountError('Código de desconto não encontrado')
        setAppliedDiscount(null)
        return
      }

      // Validar se está ativo
      if (!discount.is_active) {
        setDiscountError('Este desconto não está ativo')
        setAppliedDiscount(null)
        return
      }

      // Validar datas
      const now = new Date()
      const startDate = new Date(discount.start_date)
      const endDate = new Date(discount.end_date)

      if (now < startDate) {
        setDiscountError('Este desconto ainda não está válido')
        setAppliedDiscount(null)
        return
      }

      if (now > endDate) {
        setDiscountError('Este desconto expirou')
        setAppliedDiscount(null)
        return
      }

      // Validar limite de usos
      if (discount.max_uses && discount.current_uses >= discount.max_uses) {
        setDiscountError('Este desconto atingiu o limite de usos')
        setAppliedDiscount(null)
        return
      }

      // Validar se é específico do concurso ou global
      if (discount.contest_id && discount.contest_id !== contest.id) {
        setDiscountError('Este desconto não é válido para este concurso')
        setAppliedDiscount(null)
        return
      }

      // Desconto válido
      setAppliedDiscount(discount)
      setDiscountError(null)
    } catch (err) {
      console.error('Erro ao validar desconto:', err)
      setDiscountError(err instanceof Error ? err.message : 'Erro ao validar desconto')
      setAppliedDiscount(null)
    } finally {
      setValidatingDiscount(false)
    }
  }

  // MODIFIQUEI AQUI - Função para remover desconto
  const handleRemoveDiscount = () => {
    setAppliedDiscount(null)
    setDiscountCode('')
    setDiscountError(null)
  }

  const handlePixPayment = async () => {
    if (!contest || !profile || selectedNumbers.length === 0) return

    if (processing) return

    const finalAmount = getFinalAmount()
    const cpfDigits = String(profile?.cpf || '').replace(/\D/g, '')

    if (cpfDigits.length !== 11) {
      setError('Para pagar via Pix, é necessário cadastrar seu CPF. Acesse "Minha Conta" nas configurações do seu perfil para adicionar o CPF, ou escolha pagamento em Dinheiro.')
      return
    }

    if (finalAmount <= 0) {
      setError('O valor do pedido deve ser maior que zero.')
      return
    }

    try {
      setProcessing(true)
      setError(null)

      // Pix: NÃO criar participação antes do pagamento - será criada pelo webhook quando o Pix for confirmado
      const pixData = await createPixPayment({
        contestId: contest.id,
        selectedNumbers: selectedNumbers,
        participationId: '',
        ticketCode: '',
        amount: finalAmount,
        description: 'Pedido de Compra',
        customerName: profile.name || 'Cliente',
        customerEmail: profile.email || undefined,
        customerPhone: profile.phone || undefined,
        customerCpfCnpj: cpfDigits,
        discountCode: appliedDiscount?.code || undefined,
      })

      // 5. Se chegou aqui, tudo deu certo - exibir QR Code
      setPixPaymentId(pixData.id)
      setPixQrCode(pixData.qrCode.encodedImage)
      setPixPayload(pixData.qrCode.payload)
      setPixExpirationDate(pixData.qrCode.expirationDate)

      // 6. Incrementar uso do desconto se aplicado
      if (appliedDiscount) {
        try {
          await incrementDiscountUses(appliedDiscount.id)
        } catch (err) {
          console.error('Erro ao incrementar uso do desconto:', err)
        }
      }

      // Limpar sessionStorage após sucesso
      sessionStorage.removeItem('dezaqui_checkout')

      setSuccess(true)
    } catch (err) {
      console.error('Erro ao processar pagamento Pix:', err)
      setError(err instanceof Error ? err.message : 'Erro ao gerar QR Code Pix')
    } finally {
      setProcessing(false)
    }
  }

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

  const copyPixPayload = () => {
    if (pixPayload) {
      navigator.clipboard.writeText(pixPayload)
      // Mostrar feedback visual
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto"></div>
            <p className="mt-4 text-[#1F1F1F]/70">
              {authLoading ? 'Verificando autenticação...' : 'Processando participação...'}
            </p>
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
              className="inline-flex items-center gap-2 text-[#1E7F43] hover:text-[#3CCB7F] font-semibold transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Voltar para concursos
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (!user || !contest || loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1 px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto mb-4"></div>
            <p className="text-[#1F1F1F]/70">
              {!user ? 'Verificando autenticação...' : !contest ? 'Carregando concurso...' : 'Carregando...'}
            </p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  const participationValue = contest.participation_value || 0

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Cabeçalho */}
        <div className="mb-6">
          <nav className="flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-2 mb-4">
            <Link
              to={`/contests/${id}/join`}
              className="inline-flex items-center gap-2 text-[#1E7F43] hover:text-[#3CCB7F] font-semibold transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Voltar para seleção de números</span>
              <span className="sm:hidden">Voltar para números</span>
            </Link>
          </nav>

          <h1 className="text-3xl font-extrabold text-[#1F1F1F] mb-2">
            Finalizar Participação
          </h1>
          <p className="text-[#1F1F1F]/70">
            Revise as informações e escolha a forma de pagamento
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && paymentMethod === 'cash' && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-blue-800 text-sm font-semibold mb-2">
              ✓ Participação criada com sucesso!
            </p>
            <p className="text-blue-700 text-sm">
              Sua participação ficará <strong>pendente</strong> até que um administrador registre o pagamento em dinheiro e ative sua participação.
              Você pode acompanhar o status em "Meus Tickets".
            </p>
          </div>
        )}

        {/* Informações da Participação */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-[#E5E5E5]">
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Informações da Participação</h2>

          <div className="space-y-4">
            {/* Concurso */}
            <div>
              <span className="text-sm text-[#1F1F1F]/60">Concurso:</span>
              <p className="font-semibold text-[#1F1F1F]">{contest.name}</p>
              {/* MODIFIQUEI AQUI - Exibir código do concurso */}
              {contest.contest_code && (
                <p className="text-xs text-[#1F1F1F]/70 mt-1 font-mono">
                  Código do Concurso: {contest.contest_code}
                </p>
              )}
            </div>

            {/* Números Selecionados */}
            <div>
              <span className="text-sm text-[#1F1F1F]/60">Números Selecionados:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedNumbers.sort((a, b) => a - b).map((num) => (
                  <span
                    key={num}
                    className="px-3 py-1 bg-[#1E7F43] text-white rounded-lg font-bold text-sm"
                  >
                    {num.toString().padStart(2, '0')}
                  </span>
                ))}
              </div>
            </div>

            {/* Código do Ticket */}
            {participation?.ticket_code && (
              <div>
                <span className="text-sm text-[#1F1F1F]/60">Código do Ticket:</span>
                <p className="font-mono font-semibold text-[#1F1F1F] text-lg">
                  {participation.ticket_code}
                </p>
              </div>
            )}

            {/* Data e Hora */}
            {participation?.created_at && (
              <div>
                <span className="text-sm text-[#1F1F1F]/60">Data e Hora:</span>
                <p className="font-semibold text-[#1F1F1F]">
                  {formatDateTime(participation.created_at)}
                </p>
              </div>
            )}

            {/* MODIFIQUEI AQUI - Seção de Desconto */}
            {!success && (
              <div className="pt-4 border-t border-[#E5E5E5]">
                <label className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                  Código de Desconto (Opcional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => {
                      setDiscountCode(e.target.value.toUpperCase())
                      setDiscountError(null)
                      if (appliedDiscount) {
                        setAppliedDiscount(null)
                      }
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && discountCode.trim()) {
                        handleApplyDiscount()
                      }
                    }}
                    placeholder="Digite o código do cupom"
                    className="flex-1 px-4 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E7F43]"
                    disabled={validatingDiscount || processing}
                  />
                  {!appliedDiscount ? (
                    <button
                      onClick={handleApplyDiscount}
                      disabled={validatingDiscount || processing || !discountCode.trim()}
                      className="px-6 py-2 bg-[#1E7F43] text-white rounded-lg font-semibold hover:bg-[#3CCB7F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {validatingDiscount ? 'Validando...' : 'Aplicar'}
                    </button>
                  ) : (
                    <button
                      onClick={handleRemoveDiscount}
                      disabled={processing}
                      className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      Remover
                    </button>
                  )}
                </div>
                {discountError && (
                  <p className="text-sm text-red-600 mt-2">{discountError}</p>
                )}
                {appliedDiscount && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-green-800">
                          ✓ Desconto aplicado: {appliedDiscount.name}
                        </p>
                        {appliedDiscount.description && (
                          <p className="text-xs text-green-700 mt-1">{appliedDiscount.description}</p>
                        )}
                      </div>
                      <span className="text-lg font-bold text-green-700">
                        {appliedDiscount.discount_type === 'percentage'
                          ? `${appliedDiscount.discount_value}%`
                          : formatCurrency(appliedDiscount.discount_value)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODIFIQUEI AQUI - Valor com desconto aplicado */}
            <div className="pt-4 border-t border-[#E5E5E5]">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-[#1F1F1F]">Valor:</span>
                  <span className="text-xl font-bold text-[#1F1F1F]">
                    {formatCurrency(participationValue)}
                  </span>
                </div>
                {appliedDiscount && getDiscountAmount() > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#1F1F1F]/70">Desconto ({appliedDiscount.code}):</span>
                    <span className="text-sm font-semibold text-red-600">
                      -{formatCurrency(getDiscountAmount())}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-[#E5E5E5]">
                  <span className="text-lg font-semibold text-[#1F1F1F]">Valor Total:</span>
                  <span className="text-2xl font-extrabold text-[#1E7F43]">
                    {formatCurrency(getFinalAmount())}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seleção de Método de Pagamento */}
        {!success && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-[#E5E5E5]">
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Escolha a Forma de Pagamento</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Opção Pix */}
              <button
                onClick={() => handlePaymentMethodSelect('pix')}
                disabled={processing}
                className={`p-6 rounded-xl border-2 transition-all ${
                  paymentMethod === 'pix'
                    ? 'border-[#1E7F43] bg-[#1E7F43]/5'
                    : 'border-[#E5E5E5] hover:border-[#1E7F43] bg-white'
                } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">💳</div>
                  <h3 className="text-lg font-bold text-[#1F1F1F] mb-1">Pix</h3>
                  <p className="text-sm text-[#1F1F1F]/60">
                    Pagamento instantâneo e ativação automática
                  </p>
                </div>
              </button>

              {/* Opção Dinheiro */}
              <button
                onClick={() => handlePaymentMethodSelect('cash')}
                disabled={processing}
                className={`p-6 rounded-xl border-2 transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-[#1E7F43] bg-[#1E7F43]/5'
                    : 'border-[#E5E5E5] hover:border-[#1E7F43] bg-white'
                } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">💵</div>
                  <h3 className="text-lg font-bold text-[#1F1F1F] mb-1">Dinheiro</h3>
                  <p className="text-sm text-[#1F1F1F]/60">
                    Pagamento presencial - ativação manual pelo administrador
                  </p>
                </div>
              </button>
            </div>

            {/* Botão de Confirmação */}
            {paymentMethod && (
              <div className="mt-6 pt-6 border-t border-[#E5E5E5]">
                <button
                  onClick={() => {
                    if (paymentMethod === 'pix') {
                      handlePixPayment()
                    } else {
                      handleCashPayment()
                    }
                  }}
                  disabled={processing}
                  className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-colors ${
                    processing
                      ? 'bg-[#E5E5E5] text-[#1F1F1F]/60 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white hover:from-[#3CCB7F] hover:to-[#1E7F43]'
                  }`}
                >
                  {processing
                    ? 'Processando...'
                    : paymentMethod === 'pix'
                    ? 'Gerar QR Code Pix'
                    : 'Confirmar Participação'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Redirecionando para página de sucesso (cash ou pix confirmado) */}
        {success &&
          ((paymentMethod === 'cash' && participation?.ticket_code) ||
            (paymentMethod === 'pix' && pixConfirmed?.ticketCodes?.length)) && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5]">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto mb-4"></div>
              <p className="text-[#1F1F1F]/70">Redirecionando para página de sucesso...</p>
            </div>
          </div>
        )}

        {/* QR Code Pix - exibido enquanto aguarda confirmação */}
        {success && paymentMethod === 'pix' && pixQrCode && !pixConfirmed && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5]">
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Pagamento via Pix</h2>

            <div className="text-center space-y-4">
              {/* QR Code */}
              <div className="flex justify-center">
                <img
                  src={`data:image/png;base64,${pixQrCode}`}
                  alt="QR Code Pix"
                  className="w-[300px] h-[300px] object-contain border-2 border-[#E5E5E5] rounded-xl p-3 bg-white"
                />
              </div>

              {/* Código Pix Copia e Cola */}
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

              {/* Informações */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800">
                  <strong>Valor:</strong> {formatCurrency(getFinalAmount())}
                  {appliedDiscount && getDiscountAmount() > 0 && (
                    <span className="ml-2 text-xs">
                      (desconto de {formatCurrency(getDiscountAmount())} aplicado)
                    </span>
                  )}
                </p>
                {pixExpirationDate && (
                  <p className="text-sm text-blue-800 mt-1">
                    <strong>Válido até:</strong> {formatDateTime(pixExpirationDate)}
                  </p>
                )}
                <p className="text-sm text-blue-800 mt-2">
                  Após a confirmação do pagamento Pix, seus tickets aparecerão automaticamente em <strong>Meus Tickets</strong>.
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  Após o pagamento, suas participações serão ativadas automaticamente.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to={`/contests/${id}`}
                  className="w-full sm:w-auto text-center px-6 py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors min-h-[44px] flex items-center justify-center gap-2 touch-manipulation"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar para o Concurso
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
        )}
      </main>

      <Footer />
    </div>
  )
}