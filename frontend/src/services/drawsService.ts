/**
 * Serviço de acesso a dados de sorteios
 * FASE 2: Participações e Ranking
 * 
 * Funções para buscar sorteios do Supabase
 */
import { supabase } from '../lib/supabase'
import { Draw } from '../types'

/**
 * Lista todos os sorteios de um concurso
 * Ordenados por data do sorteio (mais recente primeiro)
 * 
 * @param contestId ID do concurso
 */
export async function listDrawsByContestId(contestId: string): Promise<Draw[]> {
  const { data, error } = await supabase
    .from('draws')
    .select('*')
    .eq('contest_id', contestId)
    .order('draw_date', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar sorteios: ${error.message}`)
  }

  return data || []
}
