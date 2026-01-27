/**
 * Utilitários para exportação de dados
 * FASE 4: Sorteios e Rateio
 * 
 * Funções para exportar relatórios em diferentes formatos
 */
import { ReportData } from '../services/reportsService'

/**
 * Exporta relatório para CSV
 * MODIFIQUEI AQUI - Função para exportar CSV
 */
export function exportToCSV(reportData: ReportData): void {
  const rows: string[] = []
  
  // Cabeçalho
  rows.push('Nome,Email,Código/Ticket,Números,Pontuação,Valor Pago,Status')
  
  // Dados
  reportData.participations.forEach(p => {
    const numbers = p.numbers.map(n => n.toString().padStart(2, '0')).join(';')
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
  link.setAttribute('download', `relatorio_${reportData.contest.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
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
 * MODIFIQUEI AQUI - Função para gerar HTML do relatório
 */
export function generateReportHTML(reportData: ReportData): string {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatório - ${reportData.contest.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; color: #1F1F1F; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1E7F43; padding-bottom: 20px; }
        .header h1 { color: #1E7F43; font-size: 24px; margin-bottom: 10px; }
        .header p { color: #666; font-size: 12px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
        .summary-card { background: #F9F9F9; padding: 15px; border-radius: 8px; text-align: center; }
        .summary-card label { display: block; font-size: 11px; color: #666; margin-bottom: 5px; }
        .summary-card value { display: block; font-size: 20px; font-weight: bold; color: #1E7F43; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #1E7F43; color: white; padding: 12px; text-align: left; font-size: 11px; }
        td { padding: 10px; border-bottom: 1px solid #E5E5E5; font-size: 10px; }
        tr:hover { background: #F9F9F9; }
        .numbers { display: flex; flex-wrap: wrap; gap: 4px; }
        .number-badge { background: #F4C430; color: #1F1F1F; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9px; }
        .draw-section { margin-top: 30px; page-break-before: always; }
        .draw-card { background: #F9F9F9; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
        .draw-numbers { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .draw-number { background: #1E7F43; color: white; padding: 4px 8px; border-radius: 6px; font-weight: bold; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${reportData.contest.name}</h1>
        ${reportData.draw ? `<p>Sorteio: ${reportData.draw.code || formatDate(reportData.draw.draw_date)}</p>` : ''}
        <p>Relatório gerado em: ${formatDate(new Date().toISOString())}</p>
      </div>

      <div class="summary">
        <div class="summary-card">
          <label>Participantes</label>
          <value>${reportData.totalParticipants}</value>
        </div>
        <div class="summary-card">
          <label>Participações</label>
          <value>${reportData.totalParticipations}</value>
        </div>
        <div class="summary-card">
          <label>Arrecadado</label>
          <value>R$ ${reportData.totalRevenue.toFixed(2).replace('.', ',')}</value>
        </div>
        <div class="summary-card">
          <label>Sorteios</label>
          <value>${reportData.draws.length}</value>
        </div>
      </div>

      <h2 style="margin-bottom: 15px; color: #1E7F43;">Lista de Participantes</h2>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Código/Ticket</th>
            <th>Números</th>
            <th>Pontuação</th>
            <th>Valor Pago</th>
          </tr>
        </thead>
        <tbody>
  `

  reportData.participations.forEach(p => {
    const numbers = p.numbers.map(n => `<span class="number-badge">${n.toString().padStart(2, '0')}</span>`).join('')
    const value = p.payment ? `R$ ${p.payment.amount.toFixed(2).replace('.', ',')}` : '-'
    html += `
          <tr>
            <td>${p.user?.name || 'N/A'}</td>
            <td>${p.user?.email || 'N/A'}</td>
            <td>${p.ticket_code || 'N/A'}</td>
            <td><div class="numbers">${numbers}</div></td>
            <td>${p.current_score}</td>
            <td>${value}</td>
          </tr>
    `
  })

  html += `
        </tbody>
      </table>
  `

  if (reportData.draws.length > 0) {
    html += `
      <div class="draw-section">
        <h2 style="margin-bottom: 15px; color: #1E7F43;">Histórico de Sorteios</h2>
    `
    reportData.draws.forEach(draw => {
      const numbers = draw.numbers.map(n => `<span class="draw-number">${n.toString().padStart(2, '0')}</span>`).join('')
      html += `
        <div class="draw-card">
          <p style="font-weight: bold; margin-bottom: 5px;">${draw.code || `Sorteio ${formatDate(draw.draw_date)}`}</p>
          <p style="font-size: 11px; color: #666; margin-bottom: 10px;">${formatDate(draw.draw_date)}</p>
          <div class="draw-numbers">${numbers}</div>
        </div>
      `
    })
    html += `</div>`
  }

  html += `
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
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-[fadeIn_0.2s_ease-out]'
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

export function exportToPDF(reportData: ReportData): void {
  const html = generateReportHTML(reportData)
  const printWindow = window.open('', '_blank')
  
  if (!printWindow) {
    showErrorModal(
      'Pop-up bloqueado',
      'Não foi possível abrir a janela de impressão. Verifique se os pop-ups estão bloqueados.'
    )
    return
  }

  printWindow.document.write(html)
  printWindow.document.close()
  
  // Aguardar carregamento e abrir diálogo de impressão
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }
}
