/**
 * Serviço de acesso a dados de concursos
 * FASE 1: CRUD completo para administradores
 * FASE 2: Participações e Ranking
 * 
 * Funções para buscar e gerenciar concursos do Supabase
 */
import { supabase } from '../lib/supabase'
import { Contest, ContestStatus } from '../types'
import { generateContestCode } from '../utils/contestCodeGenerator'

/**
 * Lista todos os concursos ativos
 * MODIFIQUEI AQUI - Usuários autenticados e não autenticados podem ver concursos com status = 'active'
 */
export async function listActiveContests(): Promise<Contest[]> {
  try {
    const { data, error } = await supabase
      .from('contests')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[contestsService] Erro ao buscar concursos ativos:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      throw new Error(`Erro ao buscar concursos: ${error.message}`)
    }

    console.log('[contestsService] Concursos ativos encontrados:', data?.length || 0)
    return data || []
  } catch (err) {
    console.error('[contestsService] Exceção ao buscar concursos:', err)
    throw err
  }
}

/**
 * Lista todos os concursos finalizados
 * MODIFIQUEI AQUI - Função para buscar concursos finalizados (histórico)
 */
export async function listFinishedContests(): Promise<Contest[]> {
  try {
    const { data, error } = await supabase
      .from('contests')
      .select('*')
      .eq('status', 'finished')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[contestsService] Erro ao buscar concursos finalizados:', {
        error,
        code: error.code,
        message: error.message,
      })
      throw new Error(`Erro ao buscar concursos finalizados: ${error.message}`)
    }

    return data || []
  } catch (err) {
    console.error('[contestsService] Exceção ao buscar concursos finalizados:', err)
    throw err
  }
}

/**
 * Lista todos os concursos (apenas para administradores)
 * Retorna concursos com qualquer status
 * MODIFIQUEI AQUI - Garantir que sempre retorna dados atualizados
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
  // MODIFIQUEI AQUI - Percentuais de premiação configuráveis
  first_place_pct?: number
  second_place_pct?: number
  lowest_place_pct?: number
  admin_fee_pct?: number
  // MODIFIQUEI AQUI - Campos informativos do concurso oficial
  official_contest_name?: string | null
  official_contest_code?: string | null
  official_contest_numbers?: string | null
  official_contest_date?: string | null
}

export async function createContest(input: CreateContestInput): Promise<Contest> {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  // MODIFIQUEI AQUI - Gerar código único do concurso automaticamente usando sigla do nome
  let contestCode = generateContestCode(input.name)
  const maxAttempts = 10
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      const { data, error } = await supabase
        .from('contests')
        .insert({
          ...input,
          status: input.status || 'draft',
          created_by: user.id,
          contest_code: contestCode, // MODIFIQUEI AQUI - Adicionar código único do concurso
        })
        .select()
        .single()

      if (error) {
        // Se erro de código duplicado, tentar gerar novo código
        if (error.code === '23505' && error.message?.includes('contest_code')) {
          attempts++
          contestCode = generateContestCode(input.name) // MODIFIQUEI AQUI - Regenerar com mesmo nome
          continue
        }
        throw new Error(`Erro ao criar concurso: ${error.message}`)
      }

      if (!data) {
        attempts++
        contestCode = generateContestCode(input.name) // MODIFIQUEI AQUI - Regenerar com mesmo nome
        continue
      }

      return data
    } catch (err) {
      // Se não for erro de código duplicado, propagar o erro
      if (err instanceof Error && !err.message.includes('contest_code')) {
        throw err
      }
      attempts++
      contestCode = generateContestCode(input.name) // MODIFIQUEI AQUI - Regenerar com mesmo nome
    }
  }

  throw new Error('Não foi possível gerar um código único para o concurso após várias tentativas')
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
  // MODIFIQUEI AQUI - Percentuais de premiação configuráveis
  first_place_pct?: number
  second_place_pct?: number
  lowest_place_pct?: number
  admin_fee_pct?: number
  // MODIFIQUEI AQUI - Campos informativos do concurso oficial
  official_contest_name?: string | null
  official_contest_code?: string | null
  official_contest_numbers?: string | null
  official_contest_date?: string | null
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
