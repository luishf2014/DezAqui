/**
 * Serviço de acesso a dados de participações
 * FASE 2: Participações e Ranking
 * 
 * Funções para criar e buscar participações do Supabase
 */
import { supabase } from '../lib/supabase'
import { Participation, Contest } from '../types'
import { generateTicketCode } from '../utils/ticketCodeGenerator'

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

  // MODIFIQUEI AQUI - Gerar código/ticket único para a participação
  let ticketCode = generateTicketCode()
  let attempts = 0
  const maxAttempts = 10

  // Tentar criar participação com código único (pode haver conflito se código já existir)
  while (attempts < maxAttempts) {
    const { data, error } = await supabase
      .from('participations')
      .insert({
        contest_id: params.contestId,
        user_id: user.id, // CHATGPT: sempre usa auth.uid(), não aceita do frontend
        numbers: params.numbers,
        status: 'pending', // Status padrão
        ticket_code: ticketCode, // MODIFIQUEI AQUI - Adicionar código/ticket único
      })
      .select()
      .single()

    if (error) {
      // Se erro de código duplicado, tentar gerar novo código
      if (error.code === '23505' && error.message?.includes('ticket_code')) {
        attempts++
        ticketCode = generateTicketCode()
        continue
      }
      
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

  throw new Error('Não foi possível gerar um código único para a participação. Tente novamente.')
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

/**
 * Lista todas as participações do usuário autenticado com informações do concurso
 * MODIFIQUEI AQUI - Busca participações com dados do concurso para exibir na página de tickets
 * 
 * @returns Lista de participações do usuário com informações do concurso
 */
export async function listMyParticipations(): Promise<Array<Participation & { contest: Contest | null }>> {
  // Buscar o usuário autenticado
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  const { data, error } = await supabase
    .from('participations')
    .select(`
      *,
      contests (
        id,
        name,
        description,
        status,
        start_date,
        end_date,
        min_number,
        max_number,
        numbers_per_participation
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para visualizar estas participações')
    }
    throw new Error(`Erro ao buscar participações: ${error.message}`)
  }

  return (data || []).map((item: any) => ({
    ...item,
    contest: item.contests || null,
  }))
}

/**
 * Lista todas as participações pendentes (apenas para administradores)
 * MODIFIQUEI AQUI - Função para admin visualizar todas as participações pendentes
 * 
 * @returns Lista de participações pendentes com informações do concurso e usuário
 */
export async function listPendingParticipations(): Promise<Array<Participation & { contest: Contest | null; user: { id: string; name: string; email: string } | null }>> {
  const { data, error } = await supabase
    .from('participations')
    .select(`
      *,
      contests (
        id,
        name,
        description,
        status,
        start_date,
        end_date,
        min_number,
        max_number,
        numbers_per_participation,
        participation_value
      ),
      profiles:user_id (
        id,
        name,
        email
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para visualizar estas participações')
    }
    throw new Error(`Erro ao buscar participações pendentes: ${error.message}`)
  }

  return (data || []).map((item: any) => ({
    ...item,
    contest: item.contests || null,
    user: item.profiles ? {
      id: item.profiles.id,
      name: item.profiles.name,
      email: item.profiles.email,
    } : null,
  }))
}

/**
 * Ativa uma participação pendente (apenas para administradores)
 * MODIFIQUEI AQUI - Função para admin ativar participações manualmente
 * 
 * @param participationId ID da participação a ser ativada
 * @returns Participação atualizada
 */
export async function activateParticipation(participationId: string): Promise<Participation> {
  const { data, error } = await supabase
    .from('participations')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', participationId)
    .select()
    .single()

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para ativar esta participação')
    }
    throw new Error(`Erro ao ativar participação: ${error.message}`)
  }

  return data
}

/**
 * Lista todas as participações do sistema (apenas para administradores)
 * MODIFIQUEI AQUI - Função para admin visualizar todas as participações
 * 
 * @returns Lista de todas as participações com informações do concurso e usuário
 */
export async function listAllParticipations(): Promise<Array<Participation & { contest: Contest | null; user: { id: string; name: string; email: string } | null }>> {
  const { data, error } = await supabase
    .from('participations')
    .select(`
      *,
      contests (
        id,
        name,
        description,
        status,
        start_date,
        end_date,
        min_number,
        max_number,
        numbers_per_participation,
        participation_value
      ),
      profiles:user_id (
        id,
        name,
        email
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para visualizar estas participações')
    }
    throw new Error(`Erro ao buscar participações: ${error.message}`)
  }

  return (data || []).map((item: any) => ({
    ...item,
    contest: item.contests || null,
    user: item.profiles ? {
      id: item.profiles.id,
      name: item.profiles.name,
      email: item.profiles.email,
    } : null,
  }))
}

/**
 * Lista todas as participações ativas de um concurso ordenadas por ranking (pontuação)
 * MODIFIQUEI AQUI - Função para buscar ranking de um concurso
 * 
 * @param contestId ID do concurso
 * @returns Lista de participações ordenadas por pontuação (maior para menor)
 */
export async function getContestRanking(contestId: string): Promise<Array<Participation & { user: { id: string; name: string; email: string } | null }>> {
  const { data, error } = await supabase
    .from('participations')
    .select(`
      *,
      profiles:user_id (
        id,
        name,
        email
      )
    `)
    .eq('contest_id', contestId)
    .eq('status', 'active') // Apenas participações ativas aparecem no ranking
    .order('current_score', { ascending: false }) // Ordenar por pontuação (maior primeiro)
    .order('created_at', { ascending: true }) // Em caso de empate, ordenar por data de criação (mais antiga primeiro)

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para visualizar este ranking')
    }
    throw new Error(`Erro ao buscar ranking: ${error.message}`)
  }

  return (data || []).map((item: any) => ({
    ...item,
    user: item.profiles ? {
      id: item.profiles.id,
      name: item.profiles.name,
      email: item.profiles.email,
    } : null,
  }))
}
