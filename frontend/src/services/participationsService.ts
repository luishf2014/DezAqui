/**
 * Serviço de acesso a dados de participações
 * FASE 2: Participações e Ranking
 * 
 * Funções para criar e buscar participações do Supabase
 */
import { supabase } from '../lib/supabase'
import { Participation } from '../types'

/**
 * Cria uma nova participação em um concurso
 * CHATGPT: alterei aqui - sempre usa auth.uid() para user_id, não aceita do frontend
 * 
 * @param params Parâmetros da participação
 * @returns Participação criada
 */
export async function createParticipation(params: {
  contestId: string
  numbers: number[]
}): Promise<Participation> {
  // Buscar o usuário autenticado
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  const { data, error } = await supabase
    .from('participations')
    .insert({
      contest_id: params.contestId,
      user_id: user.id, // CHATGPT: sempre usa auth.uid(), não aceita do frontend
      numbers: params.numbers,
      status: 'pending', // Status padrão
    })
    .select()
    .single()

  if (error) {
    // Tratar erros de RLS com mensagem amigável
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para criar esta participação')
    }
    if (error.code === '23505') {
      throw new Error('Você já possui uma participação neste concurso')
    }
    throw new Error(`Erro ao criar participação: ${error.message}`)
  }

  return data
}

/**
 * Lista todas as participações do usuário autenticado em um concurso específico
 * 
 * @param contestId ID do concurso
 * @returns Lista de participações do usuário
 */
export async function listMyParticipationsByContest(
  contestId: string
): Promise<Participation[]> {
  // Buscar o usuário autenticado
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  const { data, error } = await supabase
    .from('participations')
    .select('*')
    .eq('contest_id', contestId)
    .eq('user_id', user.id) // CHATGPT: sempre filtra por auth.uid()
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para visualizar estas participações')
    }
    throw new Error(`Erro ao buscar participações: ${error.message}`)
  }

  return data || []
}
