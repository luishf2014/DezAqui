/**
 * Página do Carrinho de Apostas
 *
 * Exibe todos os itens no carrinho e permite finalizar a compra
 */
import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { createParticipation } from '../services/participationsService'
import { createPixPayment } from '../services/asaasService'
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

export default function CartPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { items, removeItem, clearCart, getItemCount, getTotalPrice } = useCart()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pixQrCode, setPixQrCode] = useState<string>('')
  const [pixPayload, setPixPayload] = useState<string>('')
  const [pixExpirationDate, setPixExpirationDate] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cash' | null>(null)
  const [createdTicketCodes, setCreatedTicketCodes] = useState<string[]>([])
  const [paidAmount, setPaidAmount] = useState<number>(0) // Valor pago (salvo antes de limpar carrinho)
  const processingRef = useRef(false)

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
    if (paymentMethod === 'pix' && (!profile.cpf || profile.cpf.length !== 11)) {
      setError('Para pagar via Pix, é necessário cadastrar seu CPF. Acesse "Minha Conta" nas configurações do seu perfil para adicionar o CPF, ou escolha pagamento em Dinheiro.')
      return
    }

    try {
      processingRef.current = true
      setProcessing(true)
      setError(null)

      // Criar todas as participações
      const participations = []
      const ticketCodes: string[] = []

      for (const item of items) {
        // MODIFIQUEI AQUI - Garantir amount válido ao criar participação (createParticipation agora valida isso)
        const amount = Number(item.price)
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('Valor inválido para criar participação')
        }

        const participation = await createParticipation({
          contestId: item.contestId,
          numbers: item.selectedNumbers,
          amount, // MODIFIQUEI AQUI - passa valor da participação
        })
        participations.push(participation)
        if (participation.ticket_code) {
          ticketCodes.push(participation.ticket_code)
        }
      }

      setCreatedTicketCodes(ticketCodes)

      // Salvar valor total ANTES de limpar o carrinho
      const totalAmount = getTotalPrice()
      setPaidAmount(totalAmount)

      if (paymentMethod === 'pix') {
        // Para Pix, criar um único pagamento com o valor total
        // Usamos a primeira participação como referência
        const firstParticipation = participations[0]

        const pixData = await createPixPayment({
          participationId: firstParticipation.id,
          ticketCode: ticketCodes.join(', '),
          amount: totalAmount,
          description: 'Pedido de Compra',
          customerName: profile.name || 'Cliente',
          customerEmail: profile.email || undefined,
          customerPhone: profile.phone || undefined,
          customerCpfCnpj: profile.cpf,
        })

        setPixQrCode(pixData.qrCode.encodedImage)
        setPixPayload(pixData.qrCode.payload)
        setPixExpirationDate(pixData.qrCode.expirationDate)
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

  // Tela de sucesso após checkout
  if (success) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          {paymentMethod === 'pix' && pixQrCode ? (
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5]">
              <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Pagamento via Pix</h2>

              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${pixQrCode}`}
                    alt="QR Code Pix"
                    className="border-2 border-[#E5E5E5] rounded-xl p-4 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                    Codigo Pix (Copia e Cola):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={pixPayload}
                      className="flex-1 px-4 py-2 border border-[#E5E5E5] rounded-lg font-mono text-sm bg-[#F9F9F9]"
                    />
                    <button
                      id="copy-pix-btn"
                      onClick={copyPixPayload}
                      className="px-6 py-2 bg-[#1E7F43] text-white rounded-lg font-semibold hover:bg-[#3CCB7F] transition-colors"
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
                    <strong>Tickets:</strong> {createdTicketCodes.join(', ')}
                  </p>
                  {pixExpirationDate && (
                    <p className="text-sm text-blue-800 mt-1">
                      <strong>Valido ate:</strong> {formatDateTime(pixExpirationDate)}
                    </p>
                  )}
                  <p className="text-sm text-blue-800 mt-2">
                    Apos o pagamento, suas participacoes serao ativadas automaticamente.
                  </p>
                </div>

                <div className="flex gap-3 justify-center">
                  <Link
                    to="/contests"
                    className="px-6 py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors"
                  >
                    Ver Concursos
                  </Link>
                  <Link
                    to="/my-tickets"
                    className="px-6 py-3 bg-white border-2 border-[#1E7F43] text-[#1E7F43] rounded-xl font-semibold hover:bg-[#1E7F43]/5 transition-colors"
                  >
                    Ver Meus Tickets
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5]">
              <div className="text-center space-y-4">
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-[#1F1F1F] mb-2">
                  Participacoes Criadas com Sucesso!
                </h2>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-md mx-auto">
                  <p className="text-blue-800 text-sm mb-2">
                    <strong>Codigos dos Tickets:</strong>
                  </p>
                  <div className="space-y-1">
                    {createdTicketCodes.map((code, idx) => (
                      <p key={idx} className="font-mono font-bold text-lg text-blue-900">
                        {code}
                      </p>
                    ))}
                  </div>
                  <p className="text-blue-700 text-sm mt-3">
                    Suas participacoes estao <strong>pendentes</strong>. Um administrador registrara o pagamento em dinheiro e ativara suas participacoes.
                  </p>
                </div>
                <div className="flex gap-3 justify-center pt-4">
                  <Link
                    to="/contests"
                    className="px-6 py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors"
                  >
                    Ver Concursos
                  </Link>
                  <Link
                    to="/my-tickets"
                    className="px-6 py-3 bg-white border-2 border-[#1E7F43] text-[#1E7F43] rounded-xl font-semibold hover:bg-[#1E7F43]/5 transition-colors"
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

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Cabecalho */}
        <div className="mb-6">
          <Link
            to="/contests"
            className="text-[#1E7F43] hover:text-[#3CCB7F] font-semibold flex items-center gap-2 mb-4 transition-colors"
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
              <p className="text-[#1F1F1F]/70">
                {getItemCount()} {getItemCount() === 1 ? 'item' : 'itens'} no carrinho
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {items.length === 0 ? (
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
