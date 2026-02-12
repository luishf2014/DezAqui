/**
 * Admin Reports - Relatórios e Análises
 * FASE 4: Sorteios e Rateio
 * 
 * Geração de relatórios por concurso e sorteio
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { listAllContests } from '../../services/contestsService'
import { listDrawsByContestId } from '../../services/drawsService'
import { getReportData, getRevenueByPeriod, ReportData } from '../../services/reportsService'
import { getDrawPayoutSummary, getPayoutsByDraw } from '../../services/payoutsService'
import { Contest, Draw } from '../../types'
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportUtils'
import { getAllHitNumbers } from '../../utils/rankingHelpers'

export default function AdminReports() {
  const navigate = useNavigate()
  const [contests, setContests] = useState<Contest[]>([])
  const [selectedContestId, setSelectedContestId] = useState<string>('')
  const [draws, setDraws] = useState<Draw[]>([])
  const [selectedDrawId, setSelectedDrawId] = useState<string>('')
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // MODIFIQUEI AQUI - Estados para filtros e visualizações
  const [reportType, setReportType] = useState<'full' | 'revenue'>('full')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [payoutSummary, setPayoutSummary] = useState<any>(null)
  const [payouts, setPayouts] = useState<Record<string, any>>({})

  useEffect(() => {
    loadContests()
  }, [])

  useEffect(() => {
    if (selectedContestId) {
      loadDraws(selectedContestId)
    } else {
      setDraws([])
      setSelectedDrawId('')
    }
  }, [selectedContestId])

  const loadContests = async () => {
    try {
      setLoading(true)
      const data = await listAllContests()
      setContests(data)
    } catch (err) {
      console.error('Erro ao carregar concursos:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar concursos')
    } finally {
      setLoading(false)
    }
  }

  const loadDraws = async (contestId: string) => {
    try {
      const data = await listDrawsByContestId(contestId)
      setDraws(data)
      // Se houver sorteios, selecionar o mais recente por padrão
      if (data.length > 0) {
        setSelectedDrawId(data[0].id)
      } else {
        setSelectedDrawId('')
      }
    } catch (err) {
      console.error('Erro ao carregar sorteios:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar sorteios')
    }
  }

  // MODIFIQUEI AQUI - Função auxiliar para mostrar modais de erro com ícones
  type ErrorIconType = 'warning' | 'contest' | 'error'
  
  const showErrorModal = (title: string, message: string, iconType: ErrorIconType = 'warning') => {
    let iconSvg = ''
    let iconBgClass = 'bg-orange-500'
    
    switch (iconType) {
      case 'contest':
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        `
        iconBgClass = 'bg-indigo-500'
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

  const handleGenerateReport = async () => {
    if (!selectedContestId) {
      showErrorModal(
        'Concurso não selecionado',
        'Por favor, selecione um concurso antes de gerar o relatório.',
        'contest'
      )
      return
    }

    setGeneratingReport(true)
    setError(null)
    try {
      let data = await getReportData(selectedContestId, selectedDrawId || undefined)
      // Para relatório de Arrecadação com filtro de datas, buscar arrecadação por período
      if (reportType === 'revenue' && (startDate || endDate)) {
        const revenueByPeriod = await getRevenueByPeriod(
          selectedContestId,
          startDate || undefined,
          endDate || undefined
        )
        data = { ...data, revenueByPeriod }
      }
      setReportData(data)
      
      // MODIFIQUEI AQUI - Buscar payouts reais do sorteio selecionado (seguindo regra do RankingPage)
      if (data.draws.length > 0) {
        const drawIdToUse = selectedDrawId || data.draws[0].id
        try {
          const [summary, drawPayouts] = await Promise.all([
            getDrawPayoutSummary(drawIdToUse),
            getPayoutsByDraw(drawIdToUse),
          ])
          
          setPayoutSummary(summary)
          
          // Criar mapa de participação -> payout
          const payoutsMap: Record<string, any> = {}
          drawPayouts.forEach((p) => {
            payoutsMap[p.participation_id] = p
          })
          setPayouts(payoutsMap)
        } catch (err) {
          console.error('Erro ao carregar payouts:', err)
          setPayoutSummary(null)
          setPayouts({})
        }
      } else {
        setPayoutSummary(null)
        setPayouts({})
      }
    } catch (err) {
      console.error('Erro ao gerar relatório:', err)
      setError(err instanceof Error ? err.message : 'Erro ao gerar relatório')
    } finally {
      setGeneratingReport(false)
    }
  }

  // Funções de exportação - passam reportType para gerar arquivo adequado
  const handleExportCSV = () => {
    if (!reportData) return
    exportToCSV(reportData, reportType)
  }

  const handleExportExcel = () => {
    if (!reportData) return
    exportToExcel(reportData, reportType)
  }

  const handleExportPDF = async () => {
    if (!reportData) return
    
    // MODIFIQUEI AQUI - Passar payouts reais para o PDF (seguindo regra do RankingPage)
    const drawIdToUse = selectedDrawId || (reportData.draws.length > 0 ? reportData.draws[0].id : null)
    let payoutsToExport: Record<string, any> = {}
    let payoutSummaryToExport: any = null
    
    if (drawIdToUse) {
      try {
        const [summary, drawPayouts] = await Promise.all([
          getDrawPayoutSummary(drawIdToUse),
          getPayoutsByDraw(drawIdToUse),
        ])
        
        payoutSummaryToExport = summary
        
        // Criar mapa de participação -> payout
        drawPayouts.forEach((p) => {
          payoutsToExport[p.participation_id] = p
        })
      } catch (err) {
        console.error('Erro ao carregar payouts para PDF:', err)
      }
    }
    
    exportToPDF(reportData, payoutSummaryToExport, payoutsToExport, reportType)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
              Relatórios
            </h1>
          </div>
          
          <div className="text-center">
            <p className="text-[#1F1F1F]/70">
              Gere relatórios de conferência, intermediários e finais por concurso e sorteio
            </p>
          </div>
        </div>

        {/* Seleção de Concurso e Sorteio */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm mb-6">
          {/* MODIFIQUEI AQUI - Tipo de relatório */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-[#1F1F1F] mb-2">
              Tipo de Relatório
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setReportType('full')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  reportType === 'full'
                    ? 'bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white'
                    : 'bg-[#F9F9F9] text-[#1F1F1F] hover:bg-[#E5E5E5]'
                }`}
              >
                Completo
              </button>
              <button
                onClick={() => setReportType('revenue')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  reportType === 'revenue'
                    ? 'bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white'
                    : 'bg-[#F9F9F9] text-[#1F1F1F] hover:bg-[#E5E5E5]'
                }`}
              >
                Arrecadação
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="contest-select" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                Selecionar Concurso
              </label>
              <select
                id="contest-select"
                value={selectedContestId}
                onChange={(e) => setSelectedContestId(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent disabled:opacity-50"
              >
                <option value="">Selecione um concurso</option>
                {contests.map((contest) => (
                  <option key={contest.id} value={contest.id}>
                    {contest.name} ({contest.status}){contest.contest_code ? ` - ${contest.contest_code}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="draw-select" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                Selecionar Sorteio (Opcional)
              </label>
              <select
                id="draw-select"
                value={selectedDrawId}
                onChange={(e) => setSelectedDrawId(e.target.value)}
                disabled={!selectedContestId || draws.length === 0}
                className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent disabled:opacity-50"
              >
                <option value="">Todos os sorteios (mais recente)</option>
                {draws.map((draw) => (
                  <option key={draw.id} value={draw.id}>
                    {draw.code || `Sorteio ${formatDate(draw.draw_date)}`}
                  </option>
                ))}
              </select>
              {selectedContestId && draws.length === 0 && (
                <p className="text-xs text-[#1F1F1F]/60 mt-1">
                  Este concurso ainda não possui sorteios realizados
                </p>
              )}
            </div>
          </div>

          {/* MODIFIQUEI AQUI - Filtros de período (para relatório de arrecadação) */}
          {reportType === 'revenue' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="start-date" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                  Data Inicial (Opcional)
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="end-date" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                  Data Final (Opcional)
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleGenerateReport}
            disabled={!selectedContestId || generatingReport}
            className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generatingReport ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Gerando Relatório...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Gerar Relatório
              </>
            )}
          </button>
        </div>

        {/* Erro */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Relatório Gerado */}
        {reportData && (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            {/* Cabeçalho do Relatório */}
            <div className="p-6 border-b border-[#E5E5E5]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#1F1F1F] mb-1">
                    {reportData.contest.name}
                  </h2>
                  {/* MODIFIQUEI AQUI - Exibir código do concurso */}
                  {reportData.contest.contest_code && (
                    <p className="text-xs text-[#1F1F1F]/70 mb-1 font-mono">
                      Código do Concurso: {reportData.contest.contest_code}
                    </p>
                  )}
                  {reportData.draw && (
                    <p className="text-xs text-[#1F1F1F]/60 font-mono mb-1">
                      Código do Sorteio: {reportData.draw.code || `Sorteio ${formatDate(reportData.draw.draw_date)}`}
                    </p>
                  )}
                  <p className="text-xs text-[#1F1F1F]/60 mt-1">
                    Relatório gerado em: {formatDate(new Date().toISOString())}
                  </p>
                </div>
                {/* MODIFIQUEI AQUI - Botões de exportação */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleExportPDF}
                    className="px-4 py-2 bg-[#F4C430] text-[#1F1F1F] rounded-xl font-semibold hover:bg-[#F4C430]/90 hover:shadow-lg transition-all flex items-center gap-2 text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    PDF
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-2 bg-[#3CCB7F] text-white rounded-xl font-semibold hover:bg-[#3CCB7F]/90 hover:shadow-lg transition-all flex items-center gap-2 text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    CSV
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="px-4 py-2 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#1E7F43]/90 hover:shadow-lg transition-all flex items-center gap-2 text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Excel
                  </button>
                </div>
              </div>

              {/* Resumo Executivo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-[#F9F9F9] rounded-xl p-4">
                  <p className="text-xs text-[#1F1F1F]/70 mb-1">Participantes</p>
                  <p className="text-2xl font-bold text-[#1E7F43]">{reportData.totalParticipants}</p>
                </div>
                <div className="bg-[#F9F9F9] rounded-xl p-4">
                  <p className="text-xs text-[#1F1F1F]/70 mb-1">Participações</p>
                  <p className="text-2xl font-bold text-[#3CCB7F]">{reportData.totalParticipations}</p>
                </div>
                <div className="bg-[#F9F9F9] rounded-xl p-4">
                  <p className="text-xs text-[#1F1F1F]/70 mb-1">Arrecadado</p>
                  <p className="text-2xl font-bold text-[#F4C430]">
                    R$ {reportData.totalRevenue.toFixed(2).replace('.', ',')}
                  </p>
                </div>
                <div className="bg-[#F9F9F9] rounded-xl p-4">
                  <p className="text-xs text-[#1F1F1F]/70 mb-1">Sorteios</p>
                  <p className="text-2xl font-bold text-[#1E7F43]">{reportData.draws.length}</p>
                </div>
              </div>

              {/* Resumo Financeiro (TOP, 2º, Menor, Taxa Admin com %) - apenas no Arrecadação */}
              {reportType === 'revenue' && (() => {
                const contest = reportData.contest as { admin_fee_pct?: number; first_place_pct?: number; second_place_pct?: number; lowest_place_pct?: number }
                const adminPct = Number(contest?.admin_fee_pct) || 18
                const topPct = Number(contest?.first_place_pct) || 65
                const secondPct = Number(contest?.second_place_pct) || 10
                const lowestPct = Number(contest?.lowest_place_pct) || 7
                const total = reportData.totalRevenue || 0
                const adminAmount = (total * adminPct) / 100
                const totalTop = (total * topPct) / 100
                const totalSecond = (total * secondPct) / 100
                const totalLowest = (total * lowestPct) / 100
                const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                return (
                  <div className="p-6 border-t border-[#E5E5E5]">
                    <h3 className="text-lg font-bold text-[#1F1F1F] mb-4">Resumo Financeiro</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[#F9F9F9] rounded-xl p-4 border border-[#E5E5E5]">
                        <p className="text-xs text-[#1F1F1F]/70 mb-1">TOP 🥇</p>
                        <p className="text-xl font-bold text-[#1F1F1F]">R$ {fmt(totalTop)}</p>
                        <p className="text-xs text-[#1F1F1F]/60 mt-1">{topPct}%</p>
                      </div>
                      <div className="bg-[#F9F9F9] rounded-xl p-4 border border-[#E5E5E5]">
                        <p className="text-xs text-[#1F1F1F]/70 mb-1">2º 🥈</p>
                        <p className="text-xl font-bold text-[#1F1F1F]">R$ {fmt(totalSecond)}</p>
                        <p className="text-xs text-[#1F1F1F]/60 mt-1">{secondPct}%</p>
                      </div>
                      <div className="bg-[#F9F9F9] rounded-xl p-4 border border-[#E5E5E5]">
                        <p className="text-xs text-[#1F1F1F]/70 mb-1">Menor 🥉</p>
                        <p className="text-xl font-bold text-[#1F1F1F]">R$ {fmt(totalLowest)}</p>
                        <p className="text-xs text-[#1F1F1F]/60 mt-1">{lowestPct}%</p>
                      </div>
                      <div className="bg-[#F9F9F9] rounded-xl p-4 border-2 border-[#1E7F43]">
                        <p className="text-xs text-[#1F1F1F]/70 mb-1">Taxa Admin 📋</p>
                        <p className="text-xl font-bold text-[#1E7F43]">R$ {fmt(adminAmount)}</p>
                        <p className="text-xs text-[#1F1F1F]/60 mt-1">{adminPct}%</p>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Resultado / Números sorteados - só no Completo e quando houver ganhador TOP */}
              {reportType === 'full' && (() => {
                const topWinningIds = Object.entries(payouts)
                  .filter(([, p]) => p && p.amount_won > 0 && p.category === 'TOP')
                  .map(([pid]) => pid)
                const topWinningParticipations = reportData.participations.filter(p => topWinningIds.includes(p.id))
                const uniqueWinningSets = Array.from(
                  new Map(
                    topWinningParticipations.map(p => {
                      const nums = [...(p.numbers || [])].sort((a, b) => a - b)
                      return [nums.join(','), nums]
                    })
                  ).values()
                )
                if (uniqueWinningSets.length === 0) return null
                return (
                  <div className="p-6 border-t border-[#E5E5E5]">
                    <h3 className="text-lg font-bold text-[#1F1F1F] mb-2">RESULTADO / NÚMEROS SORTEADO</h3>
                    <div className="space-y-3">
                      {uniqueWinningSets.map((nums, idx) => (
                        <div key={idx} className="flex flex-wrap gap-3">
                          {nums.map(num => (
                            <span
                              key={num}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#1E7F43] text-white font-bold text-sm"
                            >
                              {num.toString().padStart(2, '0')}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Lista de Participantes - só no Completo */}
            {reportType === 'full' && (
            <div className="p-6">
              <h3 className="text-xl font-bold text-[#1F1F1F] mb-4">
                Lista de Participantes ({reportData.participations.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E5E5]">
                      <th className="text-left py-3 px-4 font-semibold text-[#1F1F1F]">Nome</th>
                      <th className="text-left py-3 px-4 font-semibold text-[#1F1F1F]">Email</th>
                      <th className="text-left py-3 px-4 font-semibold text-[#1F1F1F]">Código/Ticket</th>
                      <th className="text-left py-3 px-4 font-semibold text-[#1F1F1F]">Números</th>
                      <th className="text-left py-3 px-4 font-semibold text-[#1F1F1F]">Pontuação</th>
                      <th className="text-left py-3 px-4 font-semibold text-[#1F1F1F]">Valor Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.participations.map((participation) => (
                      <tr key={participation.id} className="border-b border-[#E5E5E5]/50 hover:bg-[#F9F9F9]">
                        <td className="py-3 px-4">{participation.user?.name || 'N/A'}</td>
                        <td className="py-3 px-4 text-[#1F1F1F]/70">{participation.user?.email || 'N/A'}</td>
                        <td className="py-3 px-4">
                          {participation.ticket_code ? (
                            <span className="font-mono text-xs bg-[#1E7F43]/10 text-[#1E7F43] px-2 py-1 rounded">
                              {participation.ticket_code}
                            </span>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              const drawsSorted = [...(reportData?.draws || [])].sort(
                                (a, b) => new Date(a.draw_date).getTime() - new Date(b.draw_date).getTime()
                              )
                              const drawsToUse = selectedDrawId
                                ? (() => {
                                    const idx = drawsSorted.findIndex(d => d.id === selectedDrawId)
                                    return idx >= 0 ? drawsSorted.slice(0, idx + 1) : drawsSorted
                                  })()
                                : drawsSorted
                              const hitNumbers = getAllHitNumbers(
                                participation.numbers || [],
                                drawsToUse,
                                participation.created_at
                              )
                              return (participation.numbers || []).sort((a, b) => a - b).map((num, idx) => {
                                const isHit = hitNumbers.includes(num)
                                return (
                                  <span
                                    key={idx}
                                    className={`px-2 py-1 rounded text-xs font-bold ${
                                      isHit ? 'bg-[#1E7F43] text-white' : 'bg-[#E5E5E5] text-[#1F1F1F]'
                                    }`}
                                  >
                                    {num.toString().padStart(2, '0')}
                                    {isHit && ' ✓'}
                                  </span>
                                )
                              })
                            })()}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#1E7F43]">{participation.current_score}</span>
                        </td>
                        <td className="py-3 px-4">
                          {participation.payment ? (
                            <span className="text-[#3CCB7F] font-semibold">
                              R$ {participation.payment.amount.toFixed(2).replace('.', ',')}
                            </span>
                          ) : (
                            <span className="text-[#1F1F1F]/40">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* Arrecadação por Período - mesmo design do Completo */}
            {reportData.revenueByPeriod && reportData.revenueByPeriod.length > 0 && (
              <div className="p-6 border-t border-[#E5E5E5]">
                <h3 className="text-xl font-bold text-[#1F1F1F] mb-4">
                  Arrecadação por Período{startDate || endDate ? ' (Período selecionado)' : ' (Últimos 30 dias)'}
                </h3>
                <div className="bg-[#F9F9F9] rounded-xl p-4">
                  <div className="space-y-2">
                    {reportData.revenueByPeriod.map((period, idx) => {
                      const maxRevenue = Math.max(...reportData.revenueByPeriod!.map(p => p.revenue))
                      const percentage = maxRevenue > 0 ? (period.revenue / maxRevenue) * 100 : 0
                      return (
                        <div key={idx} className="flex items-center gap-4">
                          <div className="w-24 text-xs text-[#1F1F1F]/70">
                            {new Date(period.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-[#1F1F1F]/70">
                                {period.participations} participação(ões)
                              </span>
                              <span className="text-sm font-semibold text-[#1E7F43]">
                                R$ {period.revenue.toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                            <div className="h-4 bg-[#E5E5E5] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#1E7F43] to-[#3CCB7F] rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Histórico de Sorteios - só no Completo */}
            {reportType === 'full' && reportData.draws.length > 0 && (
              <div className="p-6 border-t border-[#E5E5E5]">
                <h3 className="text-xl font-bold text-[#1F1F1F] mb-4">
                  Histórico de Sorteios ({reportData.draws.length})
                </h3>
                <div className="space-y-3">
                  {reportData.draws.map((draw) => (
                    <div key={draw.id} className="bg-[#F9F9F9] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-[#1F1F1F]">
                            {draw.code || `Sorteio ${formatDate(draw.draw_date)}`}
                          </p>
                          <p className="text-xs text-[#1F1F1F]/70">
                            {formatDate(draw.draw_date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {draw.numbers.map((num, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-[#1E7F43] text-white rounded-lg font-bold text-sm"
                          >
                            {num.toString().padStart(2, '0')}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instruções */}
        {!reportData && (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-[#1F1F1F]/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Selecione um Concurso</h2>
            <p className="text-[#1F1F1F]/70">
              Escolha um concurso acima para gerar o relatório de participantes e sorteios
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
