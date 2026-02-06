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
 * MODIFIQUEI AQUI - sempre usa auth.uid() para user_id, não aceita do frontend
 * 
 * @param params Parâmetros da participação
 * @returns Participação criada
 */
export async function createParticipation(params: {
  contestId: string
  numbers: number[]
  amount: number // MODIFIQUEI AQUI - valor travado vindo do checkout
}): Promise<Participation> {
  // Buscar o usuário autenticado
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  // MODIFIQUEI AQUI - Validar dados antes de enviar
  if (!params.contestId || !params.numbers || params.numbers.length === 0) {
    throw new Error('Dados inválidos para criar participação')
  }

  // MODIFIQUEI AQUI - Validar valor travado
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error('Valor inválido para criar participação')
  }

  // MODIFIQUEI AQUI - Validar se o concurso está ativo e pode aceitar participações
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('id, status, start_date, end_date')
    .eq('id', params.contestId)
    .single()

  if (contestError || !contest) {
    throw new Error('Concurso não encontrado')
  }

  // Verificar se o concurso está finalizado
  if (contest.status === 'finished') {
    throw new Error('Este concurso já foi finalizado e não aceita novas participações')
  }

  // Verificar se o concurso está ativo
  if (contest.status !== 'active') {
    throw new Error('Este concurso não está ativo no momento')
  }

  const now = new Date()
  const startDate = new Date(contest.start_date)
  const endDate = new Date(contest.end_date)

  // MODIFIQUEI AQUI - Verificar se a data de início já começou
  if (now < startDate) {
    throw new Error('Este concurso ainda não começou. As participações estarão disponíveis a partir da data de início.')
  }

  // Verificar se a data de encerramento já passou
  if (endDate < now) {
    throw new Error('O prazo para participação neste concurso já encerrou')
  }

  // REMOVIDO: Verificação que bloqueava participações se já existisse sorteio
  // Comportamento correto: participações são permitidas enquanto concurso estiver "active"
  // O concurso só muda para "finished" quando alguém atinge numbers_per_participation pontos

  // MODIFIQUEI AQUI - Garantir que os números são válidos (inteiros não-negativos)
  // Normalizar e validar números
  if (!Array.isArray(params.numbers) || params.numbers.length === 0) {
    throw new Error('Números não fornecidos ou inválidos.')
  }

  const validNumbers = params.numbers.map(n => {
    // Se já for número, verificar diretamente
    if (typeof n === 'number') {
      return Number.isInteger(n) && n >= 0 ? n : null
    }
    // Se for string, converter
    if (typeof n === 'string') {
      const num = parseInt(n, 10)
      return Number.isInteger(num) && !Number.isNaN(num) && num >= 0 ? num : null
    }
    // Tentar converter para número
    const num = Number(n)
    return Number.isInteger(num) && !Number.isNaN(num) && num >= 0 ? num : null
  }).filter((n): n is number => n !== null)

  if (validNumbers.length !== params.numbers.length) {
    console.error('[participationsService] Números recebidos:', params.numbers, 'Tipo:', typeof params.numbers[0])
    console.error('[participationsService] Números válidos:', validNumbers)
    throw new Error('Números inválidos. Por favor, selecione apenas números válidos.')
  }

  // MODIFIQUEI AQUI - Validar se os números estão dentro do intervalo do concurso
  // Buscar informações do concurso para validar intervalo
  const { data: contestInfo } = await supabase
    .from('contests')
    .select('min_number, max_number')
    .eq('id', params.contestId)
    .single()

  if (contestInfo) {
    const invalidRange = validNumbers.filter(n =>
      n < contestInfo.min_number || n > contestInfo.max_number
    )
    if (invalidRange.length > 0) {
      throw new Error(
        `Números fora do intervalo permitido (${contestInfo.min_number} - ${contestInfo.max_number}): ${invalidRange.join(', ')}`
      )
    }
  }

  // MODIFIQUEI AQUI - Gerar código/ticket único para a participação
  let ticketCode = generateTicketCode()
  let attempts = 0
  const maxAttempts = 10

  // Tentar criar participação com código único (pode haver conflito se código já existir)
  while (attempts < maxAttempts) {
    try {
      const { data, error } = await supabase
        .from('participations')
        .insert({
          contest_id: params.contestId,
          user_id: user.id, // CHATGPT: sempre usa auth.uid(), não aceita do frontend
          numbers: validNumbers, // MODIFIQUEI AQUI - Usar números validados e convertidos
          status: 'pending', // Status padrão
          ticket_code: ticketCode, // MODIFIQUEI AQUI - Adicionar código/ticket único
          amount: params.amount, // MODIFIQUEI AQUI - salvar valor travado vindo do checkout
        })
        .select('*')
        .maybeSingle() // MODIFIQUEI AQUI - Usar maybeSingle() ao invés de single() para evitar erro 406

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
        // MODIFIQUEI AQUI - Melhor tratamento de erro 400
        if (error.code === 'PGRST116' || error.message?.includes('400')) {
          throw new Error(`Dados inválidos: ${error.message}`)
        }
        throw new Error(`Erro ao criar participação: ${error.message}`)
      }

      if (!data) {
        // Se não retornou dados mas também não teve erro, tentar novamente
        attempts++
        ticketCode = generateTicketCode()
        continue
      }

      return data
    } catch (err) {
      // Se não for erro de código duplicado, propagar o erro
      if (err instanceof Error && !err.message.includes('ticket_code')) {
        throw err
      }
      // Se for erro de código duplicado, continuar tentando
      if (attempts < maxAttempts - 1) {
        attempts++
        ticketCode = generateTicketCode()
        continue
      }
      throw err
    }
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
  // MODIFIQUEI AQUI - Primeiro verificar se a participação existe
  const { data: existingData, error: fetchError } = await supabase
    .from('participations')
    .select('id')
    .eq('id', participationId)
    .maybeSingle()

  if (fetchError) {
    throw new Error(`Erro ao verificar participação: ${fetchError.message}`)
  }

  if (!existingData) {
    throw new Error('Participação não encontrada')
  }

  // MODIFIQUEI AQUI - Atualizar usando maybeSingle() para evitar erro 406
  console.log(`[participationsService] Ativando participação ${participationId}...`)
  const { data, error } = await supabase
    .from('participations')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', participationId)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error(`[participationsService] Erro ao ativar participação ${participationId}:`, error)
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para ativar esta participação')
    }
    throw new Error(`Erro ao ativar participação: ${error.message}`)
  }

  if (!data) {
    console.error(`[participationsService] Participação ${participationId} não encontrada após atualização`)
    throw new Error('Participação não encontrada após atualização')
  }

  console.log(`[participationsService] Participação ${participationId} ativada com sucesso. Status: ${data.status}`)
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
