/**
 * Serviço de acesso a dados de concursos
 * FASE 1: CRUD completo para administradores
 * FASE 2: Participações e Ranking
 * 
 * Funções para buscar e gerenciar concursos do Supabase
 */
import { supabase } from '../lib/supabase'
import { Contest, ContestStatus } from '../types'

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
 * Lista todos os concursos (apenas para administradores)
 * Retorna concursos com qualquer status
 */
export async function listAllContests(): Promise<Contest[]> {
  const { data, error } = await supabase
    .from('contests')
    .select('*')
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

/**
 * Cria um novo concurso
 * Apenas administradores podem criar concursos
 */
export interface CreateContestInput {
  name: string
  description?: string
  min_number: number
  max_number: number
  numbers_per_participation: number
  start_date: string
  end_date: string
  status?: ContestStatus
  participation_value?: number
}

export async function createContest(input: CreateContestInput): Promise<Contest> {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  const { data, error } = await supabase
    .from('contests')
    .insert({
      ...input,
      status: input.status || 'draft',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar concurso: ${error.message}`)
  }

  return data
}

/**
 * Atualiza um concurso existente
 * Apenas administradores podem atualizar concursos
 */
export interface UpdateContestInput {
  name?: string
  description?: string
  min_number?: number
  max_number?: number
  numbers_per_participation?: number
  start_date?: string
  end_date?: string
  status?: ContestStatus
  participation_value?: number
}

export async function updateContest(
  id: string,
  input: UpdateContestInput
): Promise<Contest> {
  const { data, error } = await supabase
    .from('contests')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar concurso: ${error.message}`)
  }

  return data
}

/**
 * Deleta um concurso
 * Apenas administradores podem deletar concursos
 * ⚠️ CUIDADO: Esta operação é irreversível
 */
export async function deleteContest(id: string): Promise<void> {
  const { error } = await supabase
    .from('contests')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Erro ao deletar concurso: ${error.message}`)
  }
}
