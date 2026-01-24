/**
 * Admin Participants - Gestão de Participantes
 * 
 * Listar participantes, filtrar e ver participações
 */
import Header from '../../components/Header'
import Footer from '../../components/Footer'

export default function AdminParticipants() {
  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F1F1F] mb-2">
            Participantes
          </h1>
          <p className="text-[#1F1F1F]/70">
            Listar participantes, filtrar e ver participações
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-[#1F1F1F]/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Módulo em Desenvolvimento</h2>
          <p className="text-[#1F1F1F]/70 mb-4">
            Esta funcionalidade será implementada em breve
          </p>
          <div className="text-left max-w-2xl mx-auto mt-6 p-4 bg-[#F9F9F9] rounded-xl">
            <h3 className="font-semibold text-[#1F1F1F] mb-2">Funcionalidades planejadas:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-[#1F1F1F]/70">
              <li>Listar todos os participantes do sistema</li>
              <li>Filtrar participantes por concurso, status, etc.</li>
              <li>Visualizar detalhes de cada participação</li>
              <li>Histórico de participações por usuário</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
