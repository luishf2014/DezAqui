/**
 * Utilitários para exportação de dados
 * FASE 4: Sorteios e Rateio
 *
 * Funções para exportar relatórios em diferentes formatos
 */
import { ReportData } from '../services/reportsService'
import { getPrizePoolTotalForContest, getExtraPrizeDisplayAmount } from './contestPrizePool'
// @ts-ignore - html2pdf.js não tem tipos TypeScript
import html2pdf from 'html2pdf.js'
import * as XLSX from 'xlsx'

type ExportReportType = 'full' | 'revenue'

/** Download via Blob (Safari iOS e outros browsers; revoga URL após o clique). */
function downloadBlobToFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.position = 'fixed'
  link.style.left = '-9999px'
  link.setAttribute('aria-hidden', 'true')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 150)
}

/**
 * Exporta relatório para CSV
 * Quando reportType é 'revenue', exporta só Arrecadação por Período
 */
export function exportToCSV(reportData: ReportData, reportType: ExportReportType = 'full'): void {
  const baseName = `relatorio_${reportData.contest.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`

  if (reportType === 'revenue') {
    const rows: string[] = ['Data,Arrecadado (R$),Participações']
    ;(reportData.revenueByPeriod || []).forEach((p) => {
      rows.push(`${p.date},${p.revenue.toFixed(2).replace('.', ',')},${p.participations}`)
    })
    const csvContent = rows.join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    downloadBlobToFile(blob, `${baseName}_arrecadacao.csv`)
    return
  }

  const rows: string[] = ['Nome,Email,Código/Ticket,Números,Pontuação,Valor Pago,Status']
  reportData.participations.forEach((p) => {
    const numbers = (p.numbers || []).map((n) => n.toString().padStart(2, '0')).join(';')
    const value = p.payment ? p.payment.amount.toFixed(2) : '0.00'
    rows.push(
      `"${p.user?.name || 'N/A'}","${p.user?.email || 'N/A'}","${p.ticket_code || 'N/A'}","${numbers}",${p.current_score || 0},${value},"${p.status || 'N/A'}"`
    )
  })
  const csvContent = rows.join('\n')
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlobToFile(blob, `${baseName}.csv`)
}

/**
 * Exporta relatório para Excel (XLSX real)
 * Quando reportType é 'revenue', exporta só Arrecadação por Período
 */
export function exportToExcel(reportData: ReportData, reportType: ExportReportType = 'full'): void {
  try {
    const baseName = `relatorio_${reportData.contest.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`

    if (reportType === 'revenue') {
      const rows = (reportData.revenueByPeriod || []).map((p) => ({
        Data: p.date,
        'Arrecadado (R$)': Number(p.revenue),
        Participações: p.participations,
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      ;(ws as { '!cols'?: { wch: number }[] })['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 14 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Arrecadação')
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      downloadBlobToFile(blob, `${baseName}_arrecadacao.xlsx`)
      return
    }

    const rows = reportData.participations.map((p) => {
      const numbers = (p.numbers || []).map((n) => n.toString().padStart(2, '0')).join(' ')
      const value = p.payment ? Number(p.payment.amount) : 0
      return {
        Nome: p.user?.name || 'N/A',
        Email: p.user?.email || 'N/A',
        'Código/Ticket': p.ticket_code || 'N/A',
        'Números Escolhidos': numbers,
        Pontuação: Number(p.current_score || 0),
        'Valor Pago': value,
        Status: p.status || 'N/A',
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    ;(ws as { '!cols'?: { wch: number }[] })['!cols'] = [
      { wch: 22 },
      { wch: 28 },
      { wch: 18 },
      { wch: 44 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    downloadBlobToFile(blob, `${baseName}.xlsx`)
  } catch {
    exportToCSV(reportData, reportType)
  }
}

/**
 * Gera conteúdo HTML para PDF
 * Quando reportType é 'revenue', gera só Arrecadação (header, resumo financeiro, arrecadação por período)
 */
export function generateReportHTML(
  reportData: ReportData,
  payoutSummary?: any,
  payouts?: Record<string, any>,
  reportType: ExportReportType = 'full'
): string {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // MODIFIQUEI AQUI - Números dos ganhadores TOP (igual RankingsPage) - só quando houver ganhador
  const topWinningParticipationIds = Object.entries(payouts || {})
    .filter(([, p]: [string, any]) => p && p.amount_won > 0 && p.category === 'TOP')
    .map(([pid]) => pid)
  const topWinningParticipations = reportData.participations.filter((p) =>
    topWinningParticipationIds.includes(p.id)
  )
  const uniqueWinningSets = Array.from(
    new Map(
      topWinningParticipations.map((p) => {
        const nums = [...(p.numbers || [])].sort((a, b) => a - b)
        return [nums.join(','), nums] as [string, number[]]
      })
    ).values()
  )

  // Para acertos na tabela: números únicos sorteados em todos os draws
  const allDrawnNumbers: number[] = []
  reportData.draws.forEach((draw) => {
    allDrawnNumbers.push(...draw.numbers)
  })
  const uniqueDrawnNumbers = Array.from(new Set(allDrawnNumbers)).sort((a, b) => a - b)

  const isHit = (number: number): boolean => {
    return uniqueDrawnNumbers.includes(number)
  }

  // MODIFIQUEI AQUI - Calcular acertos para uma participação
  const getHits = (numbers: number[]): number => {
    return numbers.filter((n) => isHit(n)).length
  }

  // MODIFIQUEI AQUI - Medalha por categoria do payout (TOP/SECOND/LOWEST)
  const getMedalByCategory = (category?: string): string => {
    if (!category) return ''
    if (category === 'TOP') return '🥇'
    if (category === 'SECOND') return '🥈'
    if (category === 'LOWEST') return '🥉'
    return ''
  }

  // ============================
  // MODIFIQUEI AQUI - Helpers financeiros
  // ============================
  const money = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const toNumber = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  // MODIFIQUEI AQUI - Buscar percentuais diretamente do concurso (fonte da verdade)
  const contest = reportData.contest as any
  const adminPercent = toNumber(contest?.admin_fee_pct) || 18
  const topPercent = toNumber(contest?.first_place_pct) || 65
  const secondPercent = toNumber(contest?.second_place_pct) || 10
  const lowestPercent = toNumber(contest?.lowest_place_pct) || 7

  // MODIFIQUEI AQUI - Arrecadação = só pagamentos; premiação total = pool dos % (pode incluir extra)
  const arrecadacaoPagamentos = toNumber((reportData as any)?.totalRevenue || 0)
  const premiacaoTotalBase = getPrizePoolTotalForContest(arrecadacaoPagamentos, reportData.contest)
  const valorAdicionalExtra = getExtraPrizeDisplayAmount(reportData.contest)

  // Percentuais aplicados sobre premiação total (igual rateioCalculator / reprocessService)
  const adminAmount = (premiacaoTotalBase * adminPercent) / 100
  const totalTop = (premiacaoTotalBase * topPercent) / 100
  const totalSecond = (premiacaoTotalBase * secondPercent) / 100
  const totalLowest = (premiacaoTotalBase * lowestPercent) / 100

  const linhaBreakdownFin =
    valorAdicionalExtra > 0
      ? `<p style="font-size: 11px; color: #555; margin: 0 0 8px 0;">Arrecadação (pagamentos): R$ ${money(arrecadacaoPagamentos)} · Valor adicional: R$ ${money(valorAdicionalExtra)} · <strong>Premiação total (base dos %): R$ ${money(premiacaoTotalBase)}</strong></p><p style="font-size: 10px; color: #666; margin: 0 0 12px 0;">Percentuais calculados sobre a premiação total (arrecadação + adicional).</p>`
      : `<p style="font-size: 11px; color: #555; margin: 0 0 12px 0;">Arrecadação (pagamentos): R$ ${money(arrecadacaoPagamentos)} · <strong>Premiação total (base dos %): R$ ${money(premiacaoTotalBase)}</strong> <span style="color:#888;">(sem valor adicional fixo)</span></p>`

  // Completo: TOP/2º/MENOR sem % e sem Admin | Arrecadação: TOP/2º/MENOR/ADMIN com %
  const financeHtmlFull = `
<div class="finance-mini">
  <h3>Resumo Financeiro</h3>
  ${linhaBreakdownFin}
  <div class="finance-grid" style="grid-template-columns: 1fr 1fr 1fr;">
    <div class="finance-card">
      <div class="finance-label">TOP (🥇)</div>
      <div class="finance-value">R$ ${money(totalTop)}</div>
    </div>
    <div class="finance-card">
      <div class="finance-label">2º (🥈)</div>
      <div class="finance-value">R$ ${money(totalSecond)}</div>
    </div>
    <div class="finance-card">
      <div class="finance-label">Menor (🥉)</div>
      <div class="finance-value">R$ ${money(totalLowest)}</div>
    </div>
  </div>
</div>
`
  const financeHtmlRevenue = `
<div class="finance-mini">
  <h3>Resumo Financeiro</h3>
  ${linhaBreakdownFin}
  <div class="finance-grid">
    <div class="finance-card">
      <div class="finance-label">TOP (🥇)</div>
      <div class="finance-value">R$ ${money(totalTop)}</div>
      <div style="font-size: 10px; color: #666; margin-top: 4px;">${topPercent}%</div>
    </div>
    <div class="finance-card">
      <div class="finance-label">2º (🥈)</div>
      <div class="finance-value">R$ ${money(totalSecond)}</div>
      <div style="font-size: 10px; color: #666; margin-top: 4px;">${secondPercent}%</div>
    </div>
    <div class="finance-card">
      <div class="finance-label">Menor (🥉)</div>
      <div class="finance-value">R$ ${money(totalLowest)}</div>
      <div style="font-size: 10px; color: #666; margin-top: 4px;">${lowestPercent}%</div>
    </div>
    <div class="finance-card">
      <div class="finance-label">Taxa Admin (📋)</div>
      <div class="finance-value">R$ ${money(adminAmount)}</div>
      <div style="font-size: 10px; color: #666; margin-top: 4px;">${adminPercent}%</div>
    </div>
  </div>
</div>
`

  // ============================
  // HTML BASE
  // ============================
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatório - ${reportData.contest.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        /* MODIFIQUEI AQUI - Forçar layout em A4 e preservar cores/gradientes */
        html, body { width: 210mm; }
        @page { size: A4; margin: 10mm; }
        * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 30px 40px;
          color: #1F1F1F;
          line-height: 1.6;
          background: #ffffff;
        }

        /* Container fixo */
        #pdf-root {
          width: 190mm;
          margin: 0 auto;
          background: #ffffff;
        }

        /* Cabeçalho */
        .header {
          text-align: center;
          margin-bottom: 35px;
          padding-bottom: 25px;
          border-bottom: 4px solid #1E7F43;
        }
        .header h1 {
          color: #1E7F43;
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }
        .header .header-code {
          color: #888;
          font-size: 11px;
          font-family: monospace;
          margin-bottom: 4px;
        }
        .header .subtitle {
          color: #666;
          font-size: 14px;
          margin-bottom: 12px;
        }
        .header .date {
          color: #888;
          font-size: 12px;
        }

        /* Resumo financeiro */
        .finance-mini {
          background: #F8F9FA;
          border: 2px solid #1E7F43;
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 22px;
        }
        .finance-mini h3 {
          margin: 0 0 10px 0;
          font-size: 14px;
          font-weight: 800;
          color: #1E7F43;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .finance-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 10px;
        }
        .finance-card {
          background: #fff;
          border: 1px solid #E5E5E5;
          border-radius: 8px;
          padding: 10px 12px;
        }
        .finance-label {
          font-size: 11px;
          color: #666;
          font-weight: 800;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .finance-value {
          font-size: 14px;
          font-weight: 900;
          color: #1F1F1F;
        }

        /* Aviso de pagamento */
        .warning-box {
          background: #FFF3CD;
          border: 2px solid #FFC107;
          border-radius: 8px;
          padding: 15px 20px;
          margin-bottom: 30px;
          text-align: center;
        }
        .warning-box p {
          color: #856404;
          font-weight: 600;
          font-size: 13px;
          margin: 0;
        }

        /* Seção Resultados */
        .results-section {
          background: #F8F9FA;
          border: 2px solid #1E7F43;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 35px;
        }
        .results-section h2 {
          color: #1E7F43;
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 15px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .results-numbers {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .result-number {
          background: #1E7F43;
          color: white;
          padding: 8px 14px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 16px;
          min-width: 45px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .no-results {
          color: #666;
          font-style: italic;
          font-size: 14px;
        }

        /* Centralização */
        .result-number,
        .number-item {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1 !important;
          padding: 0 !important;
          vertical-align: middle;
        }
        .result-number { height: 38px; }
        .number-item { height: 18px; min-width: 24px; }

        /* Tabela */
        .table-section {
          margin-bottom: 35px;
        }
        .table-section h2 {
          color: #1E7F43;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 18px;
          padding-bottom: 10px;
          border-bottom: 2px solid #E5E5E5;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        th {
          background: #1E7F43;
          color: white;
          padding: 14px 12px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        th:first-child { border-top-left-radius: 8px; }
        th:last-child { border-top-right-radius: 8px; }
        td {
          padding: 12px;
          border-bottom: 1px solid #E5E5E5;
          font-size: 11px;
          vertical-align: middle;
        }
        tr:hover { background: #F9F9F9; }

        /* Números inline */
        .numbers-inline {
          display: inline-block;
          white-space: nowrap;
          font-family: 'Courier New', monospace;
          font-size: 10px;
          line-height: 1.8;
        }
        .number-item {
          margin-right: 6px;
          background: #E5E5E5;
          color: #1F1F1F;
          border-radius: 4px;
          font-weight: 600;
          font-size: 10px;
        }
        .number-item.hit {
          background: #1E7F43;
          color: white;
          font-weight: 700;
          border: 2px solid #0F5F2F;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.3);
        }

        .hits-count {
          margin-left: 8px;
          padding: 2px 8px;
          background: #E8F5E9;
          color: #1E7F43;
          border-radius: 4px;
          font-weight: 600;
          font-size: 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .hits-medal {
          font-size: 20px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        /* Prêmios */
        .prizes-section {
          background: #F8F9FA;
          border-radius: 10px;
          padding: 25px;
          margin-bottom: 30px;
          border: 2px solid #1E7F43;
        }
        .prizes-section h2 {
          color: #1E7F43;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 20px;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .prize-category {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          border-left: 5px solid #1E7F43;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .prize-category h3 {
          color: #1E7F43;
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .category-summary {
          color: #1F1F1F;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 2px solid #E5E5E5;
        }
        .winner-item {
          padding: 10px 0;
          border-bottom: 1px solid #F0F0F0;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .winner-ticket {
          color: #1E7F43;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          font-weight: 600;
          min-width: 120px;
        }
        .winner-separator { color: #999; font-weight: 300; }
        .winner-name { color: #1F1F1F; font-size: 12px; flex: 1; }

        .final-banner {
          background: linear-gradient(135deg, #1E7F43 0%, #3CCB7F 100%);
          color: white;
          text-align: center;
          padding: 20px;
          border-radius: 10px;
          margin-bottom: 30px;
          box-shadow: 0 4px 12px rgba(30,127,67,0.3);
        }
        .final-banner h2 {
          font-size: 24px;
          font-weight: 700;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        /* MODIFIQUEI AQUI - Controle de quebra de página */
        .page-break-before {
          page-break-before: always;
          break-before: page;
        }

        .no-break {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        /* Evitar quebra no meio da tabela */
        tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        /* Manter cabeçalho da tabela junto com o corpo */
        thead {
          display: table-header-group;
        }

        /* Evitar órfãos e viúvas */
        p, h1, h2, h3, h4 {
          orphans: 3;
          widows: 3;
        }

        /* Evitar quebra após títulos */
        h1, h2, h3, h4 {
          page-break-after: avoid;
          break-after: avoid;
        }

        /* Seções que não devem quebrar */
        .finance-mini,
        .warning-box,
        .results-section,
        .prize-category,
        .final-banner,
        .draws-history-card {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        /* Histórico de Sorteios - estilo como nas imagens */
        .draws-history-section {
          background: #fff;
          border: 2px solid #E5E5E5;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 30px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .draws-history-section h2 {
          color: #1E7F43;
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .draws-history-card {
          background: #fff;
          border: 1px solid #E5E5E5;
          border-radius: 10px;
          padding: 14px 18px;
          margin-bottom: 12px;
        }
        .draws-history-card:last-child {
          margin-bottom: 0;
        }
        .draws-history-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 10px;
        }
        .draws-history-badge {
          background: #F4C430;
          color: #1F1F1F;
          font-weight: 800;
          font-size: 13px;
          padding: 4px 12px;
          border-radius: 8px;
          flex-shrink: 0;
        }
        .draws-history-dates .draw-date {
          font-weight: 700;
          font-size: 14px;
          color: #1F1F1F;
          margin-bottom: 2px;
        }
        .draws-history-dates .draw-created {
          font-size: 11px;
          color: #888;
        }
        .draws-history-numbers-label {
          font-size: 11px;
          font-weight: 700;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .draws-history-numbers {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .draws-history-number-pill {
          background: #F4C430;
          color: #1F1F1F;
          font-weight: 700;
          font-size: 14px;
          padding: 6px 14px;
          border-radius: 8px;
          min-width: 40px;
          text-align: center;
        }

        @media print {
          .no-print { display: none; }
          body { padding: 20px; }

          /* Forçar quebra de página antes da tabela se necessário */
          .table-section {
            page-break-before: auto;
          }

          /* Evitar quebra no meio de cards */
          .finance-card {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div id="pdf-root">

      <div class="header">
        <h1>${reportData.contest.name}</h1>
        ${(reportData.contest as any).contest_code ? `<div class="header-code">Código do Concurso: ${(reportData.contest as any).contest_code}</div>` : ''}
        ${reportData.draw ? `<div class="header-code">Código do Sorteio: ${reportData.draw.code || `Sorteio ${formatDate(reportData.draw.draw_date)}`}</div>` : ''}
        <div class="subtitle">Data de Início: ${formatDate(reportData.contest.start_date)}</div>
        <div class="date">Relatório gerado em: ${formatDateTime(new Date().toISOString())}</div>
      </div>
  `

  // resumo financeiro - Completo: 3 cards sem % | Arrecadação: 4 cards com % e Taxa Admin
  html += reportType === 'revenue' ? financeHtmlRevenue : financeHtmlFull

  // Relatório de Arrecadação: só header, resumo e arrecadação por período
  if (reportType === 'revenue') {
    if (reportData.revenueByPeriod && reportData.revenueByPeriod.length > 0) {
      const maxRevenue = Math.max(...reportData.revenueByPeriod.map((p) => p.revenue))
      html += `
      <div class="results-section" style="margin-bottom: 25px;">
        <h2>Arrecadação por Período</h2>
        <div style="background: #fff; border-radius: 8px; padding: 16px;">
          ${reportData.revenueByPeriod
            .map(
              (p) =>
                `<div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
              <div style="width: 80px; font-size: 11px; color: #666;">${new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px;">
                  <span style="color: #666;">${p.participations} participação(ões)</span>
                  <span style="font-weight: 600; color: #1E7F43;">R$ ${p.revenue.toFixed(2).replace('.', ',')}</span>
                </div>
                <div style="height: 12px; background: #E5E5E5; border-radius: 6px; overflow: hidden;">
                  <div style="height: 100%; background: linear-gradient(90deg, #1E7F43, #3CCB7F); border-radius: 6px; width: ${maxRevenue > 0 ? (p.revenue / maxRevenue) * 100 : 0}%;"></div>
                </div>
              </div>
            </div>`
            )
            .join('')}
        </div>
      </div>
      `
    }
    html += `</div></body></html>`
    return html
  }

  // aviso - só no completo
  html += `
      <div class="warning-box">
        <p>⚠️ Atenção - O jogo que não estiver pago não terá direito de receber os prêmios.</p>
      </div>
  `

  // resultados - só mostra quando houver ganhador TOP (igual RankingsPage)
  if (uniqueWinningSets.length > 0) {
    html += `
      <div class="results-section">
        <h2>RESULTADO / NÚMEROS SORTEADO</h2>
        <div class="results-numbers">
          ${uniqueWinningSets
            .map(
              (nums) =>
                `<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">${nums
                  .map((n) => `<span class="result-number">${n.toString().padStart(2, '0')}</span>`)
                  .join('')}</div>`
            )
            .join('')}
        </div>
      </div>
    `
  }

  // Resumo final / ganhadores
  const isFinalReport = reportData.reportType === 'final' || reportData.contest.status === 'finished'
  if (isFinalReport && payoutSummary && payoutSummary.maxScore > 0) {
    const hasPremiados =
      payoutSummary.categories.TOP || payoutSummary.categories.SECOND || payoutSummary.categories.LOWEST

    if (hasPremiados) {
      // (mantém sua lógica de prêmios como estava)
      const categorias = [
        { key: 'TOP', data: payoutSummary.categories.TOP },
        { key: 'SECOND', data: payoutSummary.categories.SECOND },
        { key: 'LOWEST', data: payoutSummary.categories.LOWEST },
      ] as const

      let htmlGanhadores = `
        <div class="final-banner">
          <h2>FIM DO BOLÃO</h2>
        </div>

        <div class="prizes-section">
          <h2>Resumo Final do Bolão</h2>
      `

      categorias.forEach((categoria) => {
        if (!categoria.data) return

        const ganhadoresCategoria = Object.values(payouts || {})
          .filter((p: any) => p.category === categoria.key && p.amount_won > 0)
          .map((p: any) => {
            const participation = reportData.participations.find((part) => part.id === p.participation_id)
            return {
              ticketCode: participation?.ticket_code || 'N/A',
              userName: participation?.user?.name || 'N/A',
            }
          })

        if (ganhadoresCategoria.length === 0) return

        let categoriaTexto = ''
        if (categoria.key === 'TOP') categoriaTexto = `${categoria.data.score} Pontos`
        else if (categoria.key === 'SECOND') categoriaTexto = `${categoria.data.score} Pontos`
        else categoriaTexto = `Menos Pontos`

        const valorFormatado = categoria.data.amountPerWinner.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })

        const isMenorPontuacao = categoria.key === 'LOWEST'
        const textoResumo = isMenorPontuacao
          ? `${categoriaTexto} - ${categoria.data.winnersCount} ganhadores - Valor para cada premiado que acertou ${categoria.data.score} ponto: R$${valorFormatado}`
          : `${categoriaTexto} - ${categoria.data.winnersCount} ganhador${
              categoria.data.winnersCount > 1 ? 'es' : ''
            } - Valor para cada premiado: R$${valorFormatado}`

        htmlGanhadores += `
          <div class="prize-category">
            <h3>${categoriaTexto}</h3>
            <p class="category-summary">${textoResumo}</p>
        `

        ganhadoresCategoria.forEach((g: any) => {
          htmlGanhadores += `
            <div class="winner-item">
              <span class="winner-ticket">${g.ticketCode}</span>
              <span class="winner-separator">|</span>
              <span class="winner-name">${(g.userName || 'N/A').toLowerCase()}</span>
            </div>
          `
        })

        htmlGanhadores += `
          </div>
        `
      })

      htmlGanhadores += `
        </div>
      `

      html += htmlGanhadores
    }
  }

  // Histórico de Sorteios - box abaixo do Resumo final do bolão (apenas relatório completo)
  if (reportType === 'full' && reportData.draws.length > 0) {
    const drawsSorted = [...reportData.draws].sort(
      (a, b) => new Date(b.draw_date).getTime() - new Date(a.draw_date).getTime()
    )
    let drawsHistoryHtml = `
      <div class="draws-history-section">
        <h2>Histórico de Sorteios</h2>
    `
    drawsSorted.forEach((draw, idx) => {
      const seqNum = drawsSorted.length - idx
      const drawDateFormatted = formatDateTime(draw.draw_date)
      const createdFormatted = formatDateTime(draw.created_at)
      const numbersHtml = (draw.numbers || [])
        .sort((a, b) => a - b)
        .map((n) => `<span class="draws-history-number-pill">${n.toString().padStart(2, '0')}</span>`)
        .join('')
      drawsHistoryHtml += `
        <div class="draws-history-card">
          <div class="draws-history-header">
            <span class="draws-history-badge">#${seqNum}</span>
            <div class="draws-history-dates">
              <div class="draw-date">Sorteio realizado em ${drawDateFormatted}</div>
              <div class="draw-created">Criado em ${createdFormatted}</div>
            </div>
          </div>
          <div class="draws-history-numbers-label">NÚMEROS SORTEADOS</div>
          <div class="draws-history-numbers">${numbersHtml}</div>
        </div>
      `
    })
    drawsHistoryHtml += `
      </div>
    `
    html += drawsHistoryHtml
  }

  // tabela - MODIFIQUEI AQUI: adicionado page-break-before para evitar corte
  html += `
      <div class="table-section page-break-before">
        <h2>Lista de Participações</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">ID</th>
              <th style="width: 200px;">Nome</th>
              <th style="width: 180px;">Código/Ticket</th>
              <th>Números Escolhidos</th>
              <th style="width: 110px; text-align: center;">Acertos</th>
              <th style="width: 80px; text-align: center;"></th>
            </tr>
          </thead>
          <tbody>
  `

  reportData.participations.forEach((p, index) => {
    const sequentialId = index + 1
    const hits = getHits(p.numbers)
    const category = (payouts as any)?.[p.id]?.category as string | undefined
    const medal = getMedalByCategory(category)

    const numbersHtml = p.numbers
      .map((n) => {
        const hit = isHit(n)
        return `<span class="number-item ${hit ? 'hit' : ''}">${n.toString().padStart(2, '0')}</span>`
      })
      .join('')

    html += `
            <tr>
              <td style="text-align: center; font-weight: 600; color: #666;">${sequentialId}</td>
              <td style="font-weight: 500;">${p.user?.name || 'N/A'}</td>
              <td style="font-family: 'Courier New', monospace; font-size: 10px; color: #666;">${
                p.ticket_code || 'N/A'
              }</td>
              <td><div class="numbers-inline">${numbersHtml}</div></td>
              <td style="text-align: center;">
                ${hits > 0 ? `<span class="hits-count">Acertos: ${hits}</span>` : ''}
              </td>
              <td style="text-align: center;">
                ${medal ? `<span class="hits-medal">${medal}</span>` : ''}
              </td>
            </tr>
    `
  })

  html += `
          </tbody>
        </table>
      </div>

      </div>
    </body>
    </html>
  `

  return html
}

/**
 * Exporta relatório para PDF usando html2pdf
 */
function showErrorModal(title: string, message: string) {
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  `

  const modal = document.createElement('div')
  modal.className =
    'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-[fadeIn_0.2s_ease-out]'
  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-8 max-w-md mx-4 animate-[scaleIn_0.3s_ease-out] shadow-2xl">
      <div class="text-center">
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-orange-500 mb-4">
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
  const closeModal = () => modal.remove()
  closeBtn?.addEventListener('click', closeModal)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal()
  })
}

export function exportToPDF(
  reportData: ReportData,
  payoutSummary?: any,
  payouts?: Record<string, any>,
  reportType: ExportReportType = 'full'
): void {
  const html = generateReportHTML(reportData, payoutSummary, payouts, reportType)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.top = '-9999px'
  iframe.style.left = '-9999px'
  iframe.style.width = '210mm'
  iframe.style.height = '297mm'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    showErrorModal('Erro ao gerar PDF', 'Não foi possível criar o documento para gerar o PDF.')
    return
  }

  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe)
  }

  const waitForPaint = async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
  }

  const generatePDFFromIframe = async () => {
    try {
      const root = iframeDoc.getElementById('pdf-root')
      if (!root) {
        showErrorModal('Erro ao gerar PDF', 'Não foi possível localizar o container do PDF (pdf-root).')
        cleanup()
        return
      }

      await waitForPaint()

      const baseName = `relatorio_${reportData.contest.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`
      const opt = {
        margin: [10, 10, 10, 10],
        filename: reportType === 'revenue' ? `${baseName}_arrecadacao.pdf` : `${baseName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          letterRendering: true,
          onclone: (clonedDoc: Document) => {
            const styles = iframeDoc.querySelectorAll('style')
            styles.forEach((s) => clonedDoc.head.appendChild(s.cloneNode(true)))

            const cloneBody = clonedDoc.body as HTMLBodyElement
            cloneBody.style.background = '#ffffff'
            cloneBody.style.webkitPrintColorAdjust = 'exact'
            ;(cloneBody.style as any).printColorAdjust = 'exact'
          },
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }

      await html2pdf().set(opt).from(root).save()
      cleanup()
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      cleanup()
      showErrorModal('Erro ao gerar PDF', 'Não foi possível gerar o arquivo PDF. Tente novamente.')
    }
  }

  setTimeout(() => {
    if (iframe.parentNode) generatePDFFromIframe()
  }, 600)
}

/** Linha para PDF de diretório de participantes (admin) */
export interface ParticipantDirectoryPdfRow {
  name: string
  phone: string
  email: string
  /** Já formatado em pt-BR */
  registrationDate: string
}

function participantDirectoryEmpty(rows: ParticipantDirectoryPdfRow[]): boolean {
  if (!rows.length) {
    showErrorModal(
      'Nenhum participante',
      'Não há dados para exportar com os filtros atuais. Ajuste os filtros ou a busca e tente novamente.'
    )
    return true
  }
  return false
}

/**
 * Exporta lista de participantes em CSV (UTF-8 com BOM), colunas: Nome, Telefone, Data de cadastro, E-mail.
 */
export function exportParticipantsDirectoryToCSV(rows: ParticipantDirectoryPdfRow[]): void {
  if (participantDirectoryEmpty(rows)) return

  const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`
  const header = ['Nome', 'Telefone', 'Data de cadastro', 'E-mail']
  const lines = [
    header.join(','),
    ...rows.map((r) => [r.name, r.phone, r.registrationDate, r.email].map(q).join(',')),
  ]
  const csvContent = lines.join('\n')
  const fname = `participantes_dezaqui_${new Date().toISOString().split('T')[0]}.csv`
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlobToFile(blob, fname)
}

/**
 * Exporta lista de participantes em Excel (.xlsx). Em falha do motor XLSX, tenta CSV.
 */
export function exportParticipantsDirectoryToExcel(rows: ParticipantDirectoryPdfRow[]): void {
  if (participantDirectoryEmpty(rows)) return

  try {
    const data = rows.map((r) => ({
      Nome: r.name,
      Telefone: r.phone,
      'Data de cadastro': r.registrationDate,
      'E-mail': r.email,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ;(ws as { '!cols'?: { wch: number }[] })['!cols'] = [
      { wch: 28 },
      { wch: 18 },
      { wch: 22 },
      { wch: 32 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Participantes')
    const fname = `participantes_dezaqui_${new Date().toISOString().split('T')[0]}.xlsx`
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    downloadBlobToFile(blob, fname)
  } catch (err) {
    console.error('Erro ao exportar Excel (participantes):', err)
    exportParticipantsDirectoryToCSV(rows)
  }
}

/**
 * Exporta lista de participantes/usuários em PDF (NOME, TELEFONE, DATA DE CADASTRO, E-MAIL).
 */
export function exportParticipantsDirectoryToPDF(rows: ParticipantDirectoryPdfRow[]): void {
  if (participantDirectoryEmpty(rows)) return

  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const rowsHtml = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">${escape(r.name)}</td>
      <td style="padding:8px;border:1px solid #ddd;">${escape(r.phone)}</td>
      <td style="padding:8px;border:1px solid #ddd;">${escape(r.registrationDate)}</td>
      <td style="padding:8px;border:1px solid #ddd;">${escape(r.email)}</td>
    </tr>`
    )
    .join('')

  const emitted = new Date().toLocaleString('pt-BR')
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #1a1a1a; margin: 0; }
    #pdf-root { padding: 12px; background: #fff; }
    h1 { font-size: 16px; color: #1E7F43; margin: 0 0 4px 0; }
    .meta { color: #555; margin: 0 0 12px 0; font-size: 9px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #e8f5ef; padding: 8px 6px; border: 1px solid #ccc; text-align: left; font-size: 9px; }
    td { font-size: 9px; vertical-align: top; word-break: break-word; }
  </style>
</head>
<body>
  <div id="pdf-root">
    <h1>Participantes — DezAqui</h1>
    <p class="meta">Emitido em: ${escape(emitted)} · Registros: ${rows.length}</p>
    <table>
      <thead>
        <tr>
          <th>NOME</th>
          <th>TELEFONE</th>
          <th>DATA DE CADASTRO</th>
          <th>E-MAIL</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
</body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.top = '-9999px'
  iframe.style.left = '-9999px'
  iframe.style.width = '210mm'
  iframe.style.height = '297mm'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    showErrorModal('Erro ao gerar PDF', 'Não foi possível criar o documento para gerar o PDF.')
    return
  }

  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe)
  }

  const waitForPaint = async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
  }

  const generatePDFFromIframe = async () => {
    try {
      const root = iframeDoc.getElementById('pdf-root')
      if (!root) {
        showErrorModal('Erro ao gerar PDF', 'Não foi possível localizar o conteúdo do PDF.')
        cleanup()
        return
      }

      await waitForPaint()

      const fname = `participantes_dezaqui_${new Date().toISOString().split('T')[0]}.pdf`
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: fname,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          letterRendering: true,
          onclone: (clonedDoc: Document) => {
            const styles = iframeDoc.querySelectorAll('style')
            styles.forEach((s) => clonedDoc.head.appendChild(s.cloneNode(true)))
            const cloneBody = clonedDoc.body as HTMLBodyElement
            cloneBody.style.background = '#ffffff'
            ;(cloneBody.style as CSSStyleDeclaration & { printColorAdjust?: string }).printColorAdjust =
              'exact'
          },
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      }

      await html2pdf().set(opt).from(root).save()
      cleanup()
    } catch (err) {
      console.error('Erro ao gerar PDF participantes:', err)
      cleanup()
      showErrorModal('Erro ao gerar PDF', 'Não foi possível gerar o arquivo PDF. Tente novamente.')
    }
  }

  setTimeout(() => {
    if (iframe.parentNode) void generatePDFFromIframe()
  }, 400)
}
