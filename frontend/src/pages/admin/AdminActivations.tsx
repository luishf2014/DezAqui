/**
 * Admin Activations - Ativação de Participações
 * 
 * Ativar participações manual/offline + pendências Pix
 */
import Header from '../../components/Header'
import Footer from '../../components/Footer'

export default function AdminActivations() {
  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F1F1F] mb-2">
            Ativações
          </h1>
          <p className="text-[#1F1F1F]/70">
            Ativar participações manual/offline + pendências Pix
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-[#1F1F1F]/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Módulo em Desenvolvimento</h2>
          <p className="text-[#1F1F1F]/70 mb-4">
            Esta funcionalidade será implementada em breve
          </p>
          <div className="text-left max-w-2xl mx-auto mt-6 p-4 bg-[#F9F9F9] rounded-xl">
            <h3 className="font-semibold text-[#1F1F1F] mb-2">Funcionalidades planejadas:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-[#1F1F1F]/70">
              <li>Ativar participações manualmente (offline)</li>
              <li>Gerenciar pendências de pagamento Pix</li>
              <li>Ativação automática via webhook Pix</li>
              <li>Histórico de ativações</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
