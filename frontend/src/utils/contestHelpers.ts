/**
 * Helpers para concursos
 * FASE 2: Participações e Ranking
 * 
 * Funções auxiliares para verificar estados e condições de concursos
 */

import { Contest } from '../types'

/**
 * Verifica se um concurso ainda aceita participações
 * MODIFIQUEI AQUI - Função para verificar se concurso aceita participações baseado em:
 * - Status deve ser 'active'
 * - Data de início (start_date) deve ter começado
 * - Data de encerramento (end_date) não deve ter passado
 *
 * NOTA: Sorteios NÃO bloqueiam mais participações.
 * Participações são permitidas enquanto status === 'active'.
 * O concurso só muda para 'finished' quando alguém atinge a pontuação máxima.
 *
 * @param contest Concurso a verificar
 * @param hasDraws Se há sorteios realizados para este concurso (não usado mais para bloqueio)
 * @returns true se o concurso ainda aceita participações
 */
export function canAcceptParticipations(contest: Contest, hasDraws: boolean = false): boolean {
  // Se o status não for 'active', não aceita participações
  if (contest.status !== 'active') {
    return false
  }

  // REMOVIDO: Sorteios não bloqueiam mais participações
  // O concurso aceita participações enquanto estiver 'active'

  const now = new Date()
  const startDate = new Date(contest.start_date)
  const endDate = new Date(contest.end_date)

  // MODIFIQUEI AQUI - Verificar se a data de início já começou
  if (now < startDate) {
    return false
  }

  // Verificar se a data de encerramento já passou
  if (endDate < now) {
    return false
  }

  return true
}

/**
 * Obtém o estado atual do concurso para exibição
 * MODIFIQUEI AQUI - Retorna uma descrição do estado atual do concurso
 *
 * NOTA: Concurso só é "Finalizado" quando status === 'finished'
 * (quando alguém atinge a pontuação máxima)
 * Ter sorteios NÃO significa que o concurso está finalizado.
 *
 * @param contest Concurso a verificar
 * @param hasDraws Se há sorteios realizados para este concurso
 * @returns Objeto com informações sobre o estado do concurso
 */
export function getContestState(contest: Contest, hasDraws: boolean = false) {
  // Só considera finalizado se o STATUS for 'finished'
  // (não mais baseado em ter sorteios)
  if (contest.status === 'finished') {
    return {
      phase: 'finished',
      label: 'Finalizado',
      acceptsParticipations: false,
      message: 'Este concurso já foi finalizado',
    }
  }

  if (contest.status !== 'active') {
    return {
      phase: 'inactive',
      label: contest.status === 'draft' ? 'Rascunho' : 'Cancelado',
      acceptsParticipations: false,
      message: 'Este concurso não está ativo',
    }
  }

  // Concurso está ativo
  const now = new Date()
  const endDate = new Date(contest.end_date)
  const startDate = new Date(contest.start_date)

  // Se ainda não começou
  if (now < startDate) {
    return {
      phase: 'upcoming',
      label: 'Em breve',
      acceptsParticipations: false,
      message: 'Este concurso ainda não começou',
    }
  }

  // Se já passou a data de encerramento
  if (endDate < now) {
    return {
      phase: 'awaiting_result',
      label: 'Aguardando Resultado',
      acceptsParticipations: false,
      message: 'As inscrições foram encerradas. Aguardando resultado do sorteio.',
    }
  }

  // Concurso ativo com sorteios em andamento
  if (hasDraws) {
    return {
      phase: 'ongoing',
      label: 'Em Andamento',
      acceptsParticipations: true,
      message: 'Concurso em andamento. Sorteios já iniciados.',
    }
  }

  // Período de participação ativo (sem sorteios ainda)
  return {
    phase: 'accepting',
    label: 'Aceitando Participações',
    acceptsParticipations: true,
    message: 'Você pode participar deste concurso',
  }
}
