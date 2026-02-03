/**
 * Utilitários para exportação de dados
 * FASE 4: Sorteios e Rateio
 *
 * Funções para exportar relatórios em diferentes formatos
 */
import { ReportData } from '../services/reportsService'
// @ts-ignore - html2pdf.js não tem tipos TypeScript
import html2pdf from 'html2pdf.js'

/**
 * Exporta relatório para CSV
 * MODIFIQUEI AQUI - Função para exportar CSV
 */
export function exportToCSV(reportData: ReportData): void {
  const rows: string[] = []

  // Cabeçalho
  rows.push('Nome,Email,Código/Ticket,Números,Pontuação,Valor Pago,Status')

  // Dados
  reportData.participations.forEach((p) => {
    const numbers = p.numbers.map((n) => n.toString().padStart(2, '0')).join(';')
    const value = p.payment ? p.payment.amount.toFixed(2) : '0.00'
    rows.push(
      `"${p.user?.name || 'N/A'}","${p.user?.email || 'N/A'}","${p.ticket_code || 'N/A'}","${numbers}",${p.current_score},${value},"${p.status}"`
    )
  })

  // Criar arquivo
  const csvContent = rows.join('\n')
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute(
    'download',
    `relatorio_${reportData.contest.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
  )
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Exporta relatório para Excel (XLSX real)
 * MODIFIQUEI AQUI - Mantém a assinatura void (pra não quebrar botão),
 * mas tenta gerar XLSX real via import dinâmico. Se falhar, cai no CSV como antes.
 */
export function exportToExcel(reportData: ReportData): void {
  ;(async () => {
    try {
      const XLSX = await import('xlsx')

      const rows = reportData.participations.map((p) => {
        const numbers = p.numbers.map((n) => n.toString().padStart(2, '0')).join(' ')
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
      ;(ws as any)['!cols'] = [
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

      XLSX.writeFile(
        wb,
        `relatorio_${reportData.contest.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
      )
    } catch {
      exportToCSV(reportData)
    }
  })()
}

/**
 * Gera conteúdo HTML para PDF
 * Usa payouts reais do banco de dados (seguindo regra do RankingPage)
 */
export function generateReportHTML(
  reportData: ReportData,
  payoutSummary?: any,
  payouts?: Record<string, any>
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

  // MODIFIQUEI AQUI - Coletar todos os números sorteados de todos os sorteios
  const allDrawnNumbers: number[] = []
  reportData.draws.forEach((draw) => {
    allDrawnNumbers.push(...draw.numbers)
  })
  const uniqueDrawnNumbers = Array.from(new Set(allDrawnNumbers)).sort((a, b) => a - b)

  // MODIFIQUEI AQUI - Função para verificar se um número foi acertado
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

  // MODIFIQUEI AQUI - tenta achar percentuais em vários formatos comuns
  const pickPercent = (obj: any): number => {
    if (!obj) return 0
    const candidates = [
      obj.percent,
      obj.percentage,
      obj.percentual,
      obj.rate,
      obj.sharePercent,
      obj.share_percentage,
    ]
    const pct = candidates.map(toNumber).find((n) => n > 0) || 0
    return pct
  }

  // MODIFIQUEI AQUI - taxa admin (%) vindo do payoutSummary (vários nomes possíveis)
  const adminPercent =
    toNumber(payoutSummary?.adminFeePercent) ||
    toNumber(payoutSummary?.admin_percent) ||
    toNumber(payoutSummary?.adminPercent) ||
    toNumber(payoutSummary?.taxaAdministracaoPercent) ||
    toNumber(payoutSummary?.feePercent) ||
    toNumber(payoutSummary?.percentages?.admin) ||
    toNumber(payoutSummary?.percents?.admin) ||
    0

  const totalArrecadado = toNumber((reportData as any)?.totalRevenue || 0)

  // MODIFIQUEI AQUI - taxa admin e pool sem admin
  const adminAmount = adminPercent > 0 ? (totalArrecadado * adminPercent) / 100 : 0
  const poolSemAdmin = Math.max(totalArrecadado - adminAmount, 0)

  // MODIFIQUEI AQUI - tenta buscar % por categoria em múltiplos formatos
  const getCategoryPercent = (key: 'TOP' | 'SECOND' | 'LOWEST') => {
    const cat = payoutSummary?.categories?.[key]
    const pctFromCat = pickPercent(cat)
    if (pctFromCat > 0) return pctFromCat

    const lowKey = key === 'TOP' ? 'top' : key === 'SECOND' ? 'second' : 'lowest'
    const pctFromObj =
      toNumber(payoutSummary?.percentages?.[lowKey]) ||
      toNumber(payoutSummary?.percents?.[lowKey]) ||
      toNumber(payoutSummary?.config?.[`${lowKey}Percent`]) ||
      toNumber(payoutSummary?.settings?.[`${lowKey}Percent`]) ||
      0

    return pctFromObj
  }

  // MODIFIQUEI AQUI - total da categoria SEM ADMIN (valor em R$)
  const getCategoryTotal = (key: 'TOP' | 'SECOND' | 'LOWEST') => {
    const pct = getCategoryPercent(key)
    if (pct > 0) return (poolSemAdmin * pct) / 100

    // fallback antigo se não tiver percent:
    const cat = payoutSummary?.categories?.[key]
    const winnersCount = toNumber(cat?.winnersCount || 0)
    const amountPerWinner = toNumber(cat?.amountPerWinner || 0)
    const totalFromConfig = toNumber(cat?.totalAmount || 0)
    return totalFromConfig > 0 ? totalFromConfig : amountPerWinner * winnersCount
  }

  const totalTop = getCategoryTotal('TOP')
  const totalSecond = getCategoryTotal('SECOND')
  const totalLowest = getCategoryTotal('LOWEST')

  // ============================
  // MODIFIQUEI AQUI - Resumo financeiro: APENAS TOP/2º/MENOR em VALOR (R$)
  // ============================
  const financeHtml = `
<div class="finance-mini">
  <h3>Resumo Financeiro</h3>

  <div class="finance-grid">
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
          background: #F4C430;
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

        @media print {
          .no-print { display: none; }
          body { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div id="pdf-root">

      <div class="header">
        <h1>${reportData.contest.name}</h1>
        <div class="subtitle">Data de Início: ${formatDate(reportData.contest.start_date)}</div>
        <div class="date">Relatório gerado em: ${formatDateTime(new Date().toISOString())}</div>
      </div>
  `

  // resumo financeiro
  html += financeHtml

  // aviso
  html += `
      <div class="warning-box">
        <p>⚠️ Atenção - O jogo que não estiver pago não terá direito de receber os prêmios.</p>
      </div>
  `

  // resultados
  html += `
      <div class="results-section">
        <h2>Resultados / Números Sorteados</h2>
        <div class="results-numbers">
          ${
            uniqueDrawnNumbers.length > 0
              ? uniqueDrawnNumbers
                  .map((n) => `<span class="result-number">${n.toString().padStart(2, '0')}</span>`)
                  .join('')
              : '<span class="no-results">Resultados: -</span>'
          }
        </div>
      </div>
  `

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

  // tabela
  html += `
      <div class="table-section">
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

export function exportToPDF(reportData: ReportData, payoutSummary?: any, payouts?: Record<string, any>): void {
  const html = generateReportHTML(reportData, payoutSummary, payouts)

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

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `relatorio_${reportData.contest.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
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
