/**
 * Serviço de acesso a dados de concursos
 * FASE 2: Participações e Ranking
 * 
 * Funções para buscar concursos do Supabase
 */
import { supabase } from '../lib/supabase'
import { Contest } from '../types'

/**
 * Lista todos os concursos ativos
 * Usuários autenticados podem ver apenas concursos com status = 'active'
 */
export async function listActiveContests(): Promise<Contest[]> {
  const { data, error } = await supabase
    .from('contests')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar concursos: ${error.message}`)
  }

  return data || []
}

/**
 * Busca um concurso por ID
 * Retorna null se não encontrar ou se o concurso não estiver ativo (para usuários comuns)
 */
export async function getContestById(id: string): Promise<Contest | null> {
  const { data, error } = await supabase
    .from('contests')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Registro não encontrado
      return null
    }
    throw new Error(`Erro ao buscar concurso: ${error.message}`)
  }

  return data
}
