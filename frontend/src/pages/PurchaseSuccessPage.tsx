/**
 * Página de Sucesso de Compra
 *
 * Exibe a confirmação após participação criada com sucesso, tanto para
 * pagamento em dinheiro quanto para Pix. Mesmo layout das mensagens de
 * sucesso em CheckoutPage e CartPage.
 *
 * Estado esperado via useLocation().state:
 * - paymentMethod: 'cash' | 'pix'
 * - ticketCodes: string[]
 * - contestId?: string (para "Voltar para o Concurso" no checkout único)
 * - fromCart?: boolean (true = botão "Ver Concursos" em vez de "Voltar para o Concurso")
 */
import { useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'

interface PurchaseSuccessState {
  paymentMethod: 'cash' | 'pix'
  ticketCodes: string[]
  contestId?: string
  fromCart?: boolean
}

export default function PurchaseSuccessPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const data = state as PurchaseSuccessState | null

  useEffect(() => {
    if (!data?.paymentMethod || !Array.isArray(data?.ticketCodes) || data.ticketCodes.length === 0) {
      navigate('/contests', { replace: true })
    }
  }, [data, navigate])

  if (!data?.paymentMethod || !Array.isArray(data?.ticketCodes) || data.ticketCodes.length === 0) {
    return null
  }

  const { paymentMethod, ticketCodes, contestId, fromCart } = data
  const isMultiple = ticketCodes.length > 1

  // 🐛 DEBUG TEMPORÁRIO - remover depois de testar
  console.log('PurchaseSuccessPage - ticketCodes recebidos:', ticketCodes)

  const title = isMultiple ? 'Participações Criadas com Sucesso!' : 'Participação Criada com Sucesso!'
  const ticketLabel = isMultiple ? 'Códigos dos Tickets:' : 'Código do Ticket:'
  const primaryButtonLabel = fromCart ? 'Ver Concursos' : 'Voltar para o Concurso'
  const primaryButtonTo = fromCart ? '/contests' : contestId ? `/contests/${contestId}` : '/contests'

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5]">
          <div className="text-center space-y-4">
            {/* Ícone de sucesso */}
            {paymentMethod === 'cash' ? (
              <div className="text-6xl mb-4">✅</div>
            ) : (
              <div className="w-16 h-16 mx-auto rounded-xl bg-[#1E7F43] flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}

            <h2 className="text-2xl font-bold text-[#1F1F1F] mb-2">{title}</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-md mx-auto">
              <p className="text-blue-800 text-sm mb-2">
                <strong>{ticketLabel}</strong>
              </p>
              <div className="space-y-1 mb-3">
                {ticketCodes.map((code, idx) => (
                  <p key={idx} className="font-mono font-bold text-lg text-blue-900">
                    {code}
                  </p>
                ))}
              </div>
              <p className="text-blue-700 text-sm">
                {paymentMethod === 'cash' ? (
                  <>
                    Sua{isMultiple ? 's' : ''} participação{isMultiple ? 'ões' : ''} está{' '}
                    <strong>pendente</strong>. Um administrador registrará o pagamento em dinheiro e
                    ativará sua{isMultiple ? 's' : ''} participação{isMultiple ? 'ões' : ''}.
                  </>
                ) : (
                  <>
                    Seu pagamento Pix foi confirmado e sua{isMultiple ? 's' : ''} participação
                    {isMultiple ? 'ões estão' : ' está'} ativa{isMultiple ? 's' : ''}!
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link
                to={primaryButtonTo}
                className="w-full sm:w-auto text-center px-6 py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors min-h-[44px] flex items-center justify-center touch-manipulation"
              >
                {primaryButtonLabel}
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
      </main>

      <Footer />
    </div>
  )
}
