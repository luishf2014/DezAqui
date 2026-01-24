/**
 * Admin Reports - Relatórios e Análises
 * 
 * Arrecadação, rateio e exportações
 */
import Header from '../../components/Header'
import Footer from '../../components/Footer'

export default function AdminReports() {
  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F1F1F] mb-2">
            Relatórios
          </h1>
          <p className="text-[#1F1F1F]/70">
            Arrecadação, rateio e exportações
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-[#1F1F1F]/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Módulo em Desenvolvimento</h2>
          <p className="text-[#1F1F1F]/70 mb-4">
            Esta funcionalidade será implementada em breve
          </p>
          <div className="text-left max-w-2xl mx-auto mt-6 p-4 bg-[#F9F9F9] rounded-xl">
            <h3 className="font-semibold text-[#1F1F1F] mb-2">Funcionalidades planejadas:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-[#1F1F1F]/70">
              <li>Relatórios de arrecadação por período</li>
              <li>Cálculo e visualização de rateio</li>
              <li>Exportação de dados (CSV, PDF, Excel)</li>
              <li>Gráficos e análises estatísticas</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
