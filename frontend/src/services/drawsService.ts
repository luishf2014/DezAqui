/**
 * Serviço de acesso a dados de sorteios
 * FASE 4: Sorteios e Rateio
 * 
 * Funções para gerenciar sorteios do Supabase
 */
import { supabase } from '../lib/supabase'
import { Draw } from '../types'
import { generateDrawCode } from '../utils/drawCodeGenerator'

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

/**
 * Lista todos os sorteios do sistema (apenas para administradores)
 * MODIFIQUEI AQUI - Função para listar todos os sorteios
 */
export async function listAllDraws(contestId?: string): Promise<Draw[]> {
  let query = supabase
    .from('draws')
    .select('*')
    .order('draw_date', { ascending: false })

  if (contestId) {
    query = query.eq('contest_id', contestId)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para visualizar estes sorteios')
    }
    throw new Error(`Erro ao buscar sorteios: ${error.message}`)
  }

  return data || []
}

/**
 * Busca um sorteio específico por código
 * MODIFIQUEI AQUI - Função para buscar sorteio por código
 * 
 * @param contestId ID do concurso
 * @param code Código do sorteio
 * @returns Sorteio encontrado ou null
 */
export async function getDrawByCode(contestId: string, code: string): Promise<Draw | null> {
  const { data, error } = await supabase
    .from('draws')
    .select('*')
    .eq('contest_id', contestId)
    .eq('code', code)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Não encontrado
    }
    throw new Error(`Erro ao buscar sorteio: ${error.message}`)
  }

  return data
}

/**
 * Busca um sorteio por ID
 * MODIFIQUEI AQUI - Função para buscar sorteio por ID
 */
export async function getDrawById(id: string): Promise<Draw | null> {
  const { data, error } = await supabase
    .from('draws')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Não encontrado
    }
    throw new Error(`Erro ao buscar sorteio: ${error.message}`)
  }

  return data
}

/**
 * Interface para criar um novo sorteio
 */
export interface CreateDrawInput {
  contest_id: string
  numbers: number[]
  draw_date: string
  code?: string // Opcional, será gerado automaticamente se não fornecido
}

/**
 * Cria um novo sorteio
 * MODIFIQUEI AQUI - Função para criar sorteio
 */
export async function createDraw(input: CreateDrawInput): Promise<Draw> {
  // Validar números
  if (!input.numbers || input.numbers.length === 0) {
    throw new Error('É necessário informar pelo menos um número sorteado')
  }

  // Validar números únicos
  const uniqueNumbers = [...new Set(input.numbers)]
  if (uniqueNumbers.length !== input.numbers.length) {
    throw new Error('Os números sorteados devem ser únicos')
  }

  // Validar data
  if (!input.draw_date) {
    throw new Error('É necessário informar a data do sorteio')
  }

  // Gerar código se não fornecido
  const code = input.code || generateDrawCode()

  // MODIFIQUEI AQUI - Tentar inserir com código primeiro
  let insertData: any = {
    contest_id: input.contest_id,
    numbers: input.numbers,
    draw_date: input.draw_date,
    code,
  }

  let { data, error } = await supabase
    .from('draws')
    .insert(insertData)
    .select()
    .single()

  // Se o erro for sobre a coluna 'code' não encontrada, tentar inserir sem ela
  if (error && error.message && error.message.includes("'code'")) {
    console.warn('Coluna code não encontrada. Tentando inserir sem código. Execute a migração 013_add_code_to_draws.sql')
    
    // Tentar novamente sem o campo code
    insertData = {
      contest_id: input.contest_id,
      numbers: input.numbers,
      draw_date: input.draw_date,
    }

    const retryResult = await supabase
      .from('draws')
      .insert(insertData)
      .select()
      .single()

    if (retryResult.error) {
      if (retryResult.error.code === '42501') {
        throw new Error('Você não tem permissão para criar sorteios')
      }
      throw new Error(`Erro ao criar sorteio: ${retryResult.error.message}`)
    }

    data = retryResult.data
    error = null
  }

  if (error) {
    if (error.code === '23505') {
      throw new Error('Já existe um sorteio com este código')
    }
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para criar sorteios')
    }
    throw new Error(`Erro ao criar sorteio: ${error.message}`)
  }

  return data
}

/**
 * Interface para atualizar um sorteio
 */
export interface UpdateDrawInput {
  numbers?: number[]
  draw_date?: string
}

/**
 * Atualiza um sorteio existente
 * MODIFIQUEI AQUI - Função para atualizar sorteio
 * 
 * NOTA: Sorteios são eventos históricos e geralmente não devem ser alterados.
 * Esta função existe para casos especiais de correção.
 */
export async function updateDraw(id: string, input: UpdateDrawInput): Promise<Draw> {
  // Validar números se fornecidos
  if (input.numbers) {
    if (input.numbers.length === 0) {
      throw new Error('É necessário informar pelo menos um número sorteado')
    }

    // Validar números únicos
    const uniqueNumbers = [...new Set(input.numbers)]
    if (uniqueNumbers.length !== input.numbers.length) {
      throw new Error('Os números sorteados devem ser únicos')
    }
  }

  const { data, error } = await supabase
    .from('draws')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para atualizar este sorteio')
    }
    throw new Error(`Erro ao atualizar sorteio: ${error.message}`)
  }

  return data
}

/**
 * Deleta um sorteio
 * MODIFIQUEI AQUI - Função para deletar sorteio
 * 
 * NOTA: Sorteios são eventos históricos e geralmente não devem ser deletados.
 * Esta função existe para casos especiais de correção.
 */
export async function deleteDraw(id: string): Promise<void> {
  const { error } = await supabase
    .from('draws')
    .delete()
    .eq('id', id)

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para deletar este sorteio')
    }
    throw new Error(`Erro ao deletar sorteio: ${error.message}`)
  }
}
