/**
 * Página inicial da aplicação
 * FASE 1: Apenas estrutura base
 */
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />
      <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8 flex-1 max-w-4xl">
        <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-4 sm:p-6 md:p-8 shadow-xl">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F1F1F] mb-3 sm:mb-4">
            Gestão Numérica - Concursos
          </h1>
          <p className="text-[#1F1F1F]/70 mb-4 sm:mb-6 text-sm sm:text-base">
            Plataforma configurável de gestão de concursos numéricos
          </p>
          <div className="rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-[#F9F9F9] p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-[#1F1F1F] mb-2">Status do Sistema</h2>
            <p className="text-xs sm:text-sm text-[#1F1F1F]/70">
              FASE 1 - Fundação do Sistema: Estrutura base configurada
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
