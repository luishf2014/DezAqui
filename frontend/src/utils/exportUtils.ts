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
 * Exporta relatório para Excel (formato CSV com extensão .xlsx)
 * MODIFIQUEI AQUI - Função para exportar Excel (usando CSV por enquanto)
 */
export function exportToExcel(reportData: ReportData): void {
  // Por enquanto, usamos CSV com extensão .xlsx
  // Para implementação completa, seria necessário biblioteca como xlsx
  exportToCSV(reportData)
}

/**
 * Gera conteúdo HTML para PDF
 * MODIFIQUEI AQUI - Função refatorada para gerar HTML do relatório com novo design
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
  // MODIFIQUEI AQUI - Helpers financeiros (declara UMA VEZ só)
  // ============================
  const money = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const totalArrecadado = Number((reportData as any)?.totalRevenue || 0)

  // MODIFIQUEI AQUI - Pega total da categoria (valor "cheio") e valor por ganhador
  const getCategoryTotals = (key: 'TOP' | 'SECOND' | 'LOWEST') => {
    const cat = payoutSummary?.categories?.[key]

    const winnersCount = Number(cat?.winnersCount || 0)

    // MODIFIQUEI AQUI - Total da categoria:
    // Prioriza "totalAmount" se existir; senão usa amountPerWinner * winnersCount (modelo atual do seu summary)
    const amountPerWinner = Number(cat?.amountPerWinner || 0)
    const totalFromConfig = Number(cat?.totalAmount || 0)

    const total = totalFromConfig > 0 ? totalFromConfig : amountPerWinner * winnersCount

    // MODIFIQUEI AQUI - Se total existir mas winnersCount ainda não, tenta inferir por payoutSummary (se tiver)
    // (mantém comportamento seguro sem quebrar)
    const perWinner = winnersCount > 0 ? total / winnersCount : 0

    return { total, winnersCount, perWinner }
  }

  const topTotals = getCategoryTotals('TOP')
  const secondTotals = getCategoryTotals('SECOND')
  const lowestTotals = getCategoryTotals('LOWEST')

  const totalPremiado = topTotals.total + secondTotals.total + lowestTotals.total

  const showTop = topTotals.total > 0
  const showSecond = secondTotals.total > 0
  const showLowest = lowestTotals.total > 0

  // MODIFIQUEI AQUI - Bloco de resumo financeiro (sem ADMIN) - mostrar total da categoria mesmo sem ganhador
  return `
<div class="finance-mini">
  <h3>Resumo Financeiro</h3>

  <div class="finance-grid">
    <div class="finance-card">
      <div class="finance-label">Total Arrecadado</div>
      <div class="finance-value">R$ ${money(totalArrecadado)}</div>
    </div>

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

  <!-- MODIFIQUEI AQUI - Total premiado (sem ADMIN) -->
  <div style="margin-top:10px; font-size:11px; color:#666; font-weight:700;">
    Total premiado (sem ADMIN): <span style="font-size:12px; color:#1F1F1F; font-weight:900;">R$ ${money(totalPremiado)}</span>
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

        /* MODIFIQUEI AQUI - Container fixo para o html2pdf capturar corretamente */
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

        /* MODIFIQUEI AQUI - Bloco pequeno de resumo financeiro (sem ADMIN) */
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
          grid-template-columns: 1.2fr 1fr 1fr 1fr;
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

        /* Seção de Resultados */
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

        /* MODIFIQUEI AQUI - Centralizar conteúdo dentro dos quadrados (corrigindo "texto subindo") */
        .result-number,
        .number-item {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1 !important;
          padding: 0 !important; /* MODIFIQUEI AQUI - remove padding que desloca o texto */
          vertical-align: middle;
        }
        /* MODIFIQUEI AQUI - Garantir altura consistente */
        .result-number { height: 38px; }
        .number-item { height: 18px; min-width: 24px; }

        /* Tabela de Participações */
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

        /* Números em linha única */
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

        /* MODIFIQUEI AQUI - Aumentar tamanho da medalha */
        .hits-medal {
          font-size: 20px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        /* Seção de Prêmios */
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

        /* Final do Bolão */
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
          .results-section, .prizes-section {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <!-- MODIFIQUEI AQUI - Wrapper principal para capturar o PDF com estilos -->
      <div id="pdf-root">
      <!-- Cabeçalho -->
      <div class="header">
        <h1>${reportData.contest.name}</h1>
        <div class="subtitle">Data de Início: ${formatDate(reportData.contest.start_date)}</div>
        <div class="date">Relatório gerado em: ${formatDateTime(new Date().toISOString())}</div>
      </div>
  `

  // MODIFIQUEI AQUI - Inserir resumo financeiro (sem ADMIN)
  html += financeHtml

  // Aviso
  html += `
      <!-- Aviso Fixo -->
      <div class="warning-box">
        <p>⚠️ Atenção - O jogo que não estiver pago não terá direito de receber os prêmios.</p>
      </div>
  `

  // Resultados
  html += `
      <!-- Resultados no TOPO -->
      <div class="results-section">
        <h2>Resultados / Números Sorteados</h2>
        <div class="results-numbers">
          ${uniqueDrawnNumbers.length > 0
      ? uniqueDrawnNumbers
        .map((n) => `<span class="result-number">${n.toString().padStart(2, '0')}</span>`)
        .join('')
      : '<span class="no-results">Resultados: -</span>'
    }
        </div>
      </div>
  `

  // Resumo/Classificação dos Ganhadores (usando payouts reais)
  const isFinalReport = reportData.reportType === 'final' || reportData.contest.status === 'finished'
  if (isFinalReport && payoutSummary && payoutSummary.maxScore > 0) {
    const hasPremiados =
      payoutSummary.categories.TOP || payoutSummary.categories.SECOND || payoutSummary.categories.LOWEST

    if (hasPremiados) {
      // MODIFIQUEI AQUI - Função fora de template string para evitar erro do esbuild
      const buildPremiacaoBox = (key: 'TOP' | 'SECOND' | 'LOWEST', label: string) => {
        const cat = payoutSummary?.categories?.[key]
        if (!cat) return ''

        const valorPorGanhador = Number(cat.amountPerWinner || 0)
        const qtd = Number(cat.winnersCount || 0)
        if (valorPorGanhador <= 0 || qtd <= 0) return ''

        const totalCategoria = valorPorGanhador * qtd

        const valorPorGanhadorFmt = valorPorGanhador.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })

        const totalCategoriaFmt = totalCategoria.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })

        return `
          <div style="
            background:#fff;
            border:1px solid #E5E5E5;
            border-left:5px solid #1E7F43;
            border-radius:8px;
            padding:12px 14px;
            margin:10px 0;
            box-shadow:0 2px 4px rgba(0,0,0,0.03);
          ">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div style="font-weight:700; color:#1E7F43; font-size:13px;">${label}</div>
              <div style="font-weight:800; color:#1F1F1F; font-size:13px;">R$ ${valorPorGanhadorFmt}</div>
            </div>
            <div style="margin-top:6px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div style="color:#666; font-size:11px;">${qtd} ganhador(es)</div>
              <div style="color:#666; font-size:11px;">Total categoria: <b style="color:#1F1F1F;">R$ ${totalCategoriaFmt}</b></div>
            </div>
          </div>
        `
      }

      let htmlGanhadores = `
        <div class="final-banner">
          <h2>FIM DO BOLÃO</h2>
        </div>

        <div class="prizes-section">
          <h2>Resumo Final do Bolão</h2>
      `

      // MODIFIQUEI AQUI - Quadro de premiações por categoria (sem administrador)
      htmlGanhadores += `
        <div style="margin: 10px 0 18px 0;">
          ${buildPremiacaoBox('TOP', 'Maior Pontuação')}
          ${buildPremiacaoBox('SECOND', 'Segunda Maior Pontuação')}
          ${buildPremiacaoBox('LOWEST', 'Menor Pontuação')}
        </div>
      `

      const categorias = [
        { key: 'TOP', data: payoutSummary.categories.TOP },
        { key: 'SECOND', data: payoutSummary.categories.SECOND },
        { key: 'LOWEST', data: payoutSummary.categories.LOWEST },
      ] as const

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
          : `${categoriaTexto} - ${categoria.data.winnersCount} ganhador${categoria.data.winnersCount > 1 ? 'es' : ''
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

  // Tabela (início)
  html += `
      <!-- Tabela de Participações -->
      <div class="table-section">
        <h2>Lista de Participações</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">ID</th>
              <th style="width: 200px;">Nome</th>
              <th style="width: 180px;">Código/Ticket</th>
              <th>Números Escolhidos</th>

              <!-- MODIFIQUEI AQUI - Novas colunas conforme sequência pedida -->
              <th style="width: 110px; text-align: center;">Acertos</th>

              <!-- MODIFIQUEI AQUI - Remover apenas o título da medalha (deixar coluna sem texto) -->
              <th style="width: 80px; text-align: center;"></th>
            </tr>
          </thead>
          <tbody>
  `

  // Linhas
  reportData.participations.forEach((p, index) => {
    const sequentialId = index + 1
    const hits = getHits(p.numbers)

    // Pegar categoria do payout por participation.id (map é participation_id -> payout)
    const category = (payouts as any)?.[p.id]?.category as string | undefined
    const medal = getMedalByCategory(category)

    const numbersHtml = p.numbers
      .map((n) => {
        const isHitNumber = isHit(n)
        return (
          '<span class="number-item ' +
          (isHitNumber ? 'hit' : '') +
          '">' +
          n.toString().padStart(2, '0') +
          '</span>'
        )
      })
      .join('')

    html += `
            <tr>
              <td style="text-align: center; font-weight: 600; color: #666;">${sequentialId}</td>
              <td style="font-weight: 500;">${p.user?.name || 'N/A'}</td>
              <td style="font-family: 'Courier New', monospace; font-size: 10px; color: #666;">${p.ticket_code || 'N/A'
      }</td>

              <!-- MODIFIQUEI AQUI - Coluna apenas com números -->
              <td>
                <div class="numbers-inline">
                  ${numbersHtml}
                </div>
              </td>

              <!-- MODIFIQUEI AQUI - Coluna "Acertos" separada (mantendo o estilo do badge) -->
              <td style="text-align: center;">
                ${hits > 0 ? `<span class="hits-count">Acertos: ${hits}</span>` : ''}
              </td>

              <!-- MODIFIQUEI AQUI - Coluna "Medalha" (maior) -->
              <td style="text-align: center;">
                ${medal ? `<span class="hits-medal">${medal}</span>` : ''}
              </td>
            </tr>
    `
  })

  // Fechamentos
  html += `
          </tbody>
        </table>
      </div>

      <!-- MODIFIQUEI AQUI - Fechar wrapper principal -->
      </div>
    </body>
    </html>
  `

  return html
}

/**
 * Exporta relatório para PDF usando window.print()
 * MODIFIQUEI AQUI - Função para gerar PDF via print
 */
// MODIFIQUEI AQUI - Função auxiliar para mostrar modais de erro com ícones
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

  // MODIFIQUEI AQUI - Esperar render real antes de capturar
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
              ; (cloneBody.style as any).printColorAdjust = 'exact'
          },
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
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
