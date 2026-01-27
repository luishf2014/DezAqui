/**
 * Serviço de acesso a dados de descontos e promoções
 * FASE 1: Painel Administrativo - Financeiro
 * 
 * Funções para criar e gerenciar descontos e promoções
 */
import { supabase } from '../lib/supabase'
import { Discount, DiscountType } from '../types'

/**
 * Lista todos os descontos (apenas para administradores)
 */
export async function listAllDiscounts(): Promise<Discount[]> {
  const { data, error } = await supabase
    .from('discounts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para visualizar estes descontos')
    }
    throw new Error(`Erro ao buscar descontos: ${error.message}`)
  }

  return data || []
}

/**
 * Busca um desconto por código
 */
export async function getDiscountByCode(code: string): Promise<Discount | null> {
  const { data, error } = await supabase
    .from('discounts')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Não encontrado
    }
    throw new Error(`Erro ao buscar desconto: ${error.message}`)
  }

  return data
}

/**
 * Busca descontos ativos para um concurso específico ou globais
 */
export async function getActiveDiscounts(contestId?: string): Promise<Discount[]> {
  const now = new Date().toISOString()
  
  let query = supabase
    .from('discounts')
    .select('*')
    .eq('is_active', true)
    .lte('start_date', now)
    .gte('end_date', now)
    .order('created_at', { ascending: false })

  if (contestId) {
    // Buscar descontos específicos do concurso ou globais (contest_id IS NULL)
    query = query.or(`contest_id.eq.${contestId},contest_id.is.null`)
  } else {
    // Buscar apenas descontos globais
    query = query.is('contest_id', null)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Erro ao buscar descontos ativos: ${error.message}`)
  }

  // Filtrar por limite de usos
  return (data || []).filter(discount => 
    !discount.max_uses || discount.current_uses < discount.max_uses
  )
}

/**
 * Cria um novo desconto
 */
export interface CreateDiscountInput {
  code: string
  name: string
  description?: string
  discount_type: DiscountType
  discount_value: number
  contest_id?: string | null
  start_date: string
  end_date: string
  max_uses?: number | null
}

export async function createDiscount(input: CreateDiscountInput): Promise<Discount> {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  // Validar código único e converter para maiúsculas
  const codeUpper = input.code.toUpperCase().trim()
  
  // Validar valor do desconto
  if (input.discount_value <= 0) {
    throw new Error('O valor do desconto deve ser maior que zero')
  }

  if (input.discount_type === 'percentage' && (input.discount_value > 100 || input.discount_value < 0)) {
    throw new Error('O desconto percentual deve estar entre 0 e 100')
  }

  // Validar datas
  if (new Date(input.end_date) <= new Date(input.start_date)) {
    throw new Error('A data de término deve ser posterior à data de início')
  }

  const { data, error } = await supabase
    .from('discounts')
    .insert({
      ...input,
      code: codeUpper,
      created_by: user.id,
      current_uses: 0,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Já existe um desconto com este código')
    }
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para criar descontos')
    }
    throw new Error(`Erro ao criar desconto: ${error.message}`)
  }

  return data
}

/**
 * Atualiza um desconto existente
 */
export interface UpdateDiscountInput {
  code?: string
  name?: string
  description?: string
  discount_type?: DiscountType
  discount_value?: number
  contest_id?: string | null
  start_date?: string
  end_date?: string
  max_uses?: number | null
  is_active?: boolean
}

export async function updateDiscount(
  id: string,
  input: UpdateDiscountInput
): Promise<Discount> {
  const updateData: any = { ...input }

  // Se atualizar código, converter para maiúsculas
  if (updateData.code) {
    updateData.code = updateData.code.toUpperCase().trim()
  }

  // Validar valor do desconto se fornecido
  if (updateData.discount_value !== undefined) {
    if (updateData.discount_value <= 0) {
      throw new Error('O valor do desconto deve ser maior que zero')
    }

    const discountType = updateData.discount_type || input.discount_type
    if (discountType === 'percentage' && (updateData.discount_value > 100 || updateData.discount_value < 0)) {
      throw new Error('O desconto percentual deve estar entre 0 e 100')
    }
  }

  // Validar datas se ambas forem fornecidas
  if (updateData.start_date && updateData.end_date) {
    if (new Date(updateData.end_date) <= new Date(updateData.start_date)) {
      throw new Error('A data de término deve ser posterior à data de início')
    }
  }

  const { data, error } = await supabase
    .from('discounts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Já existe um desconto com este código')
    }
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para atualizar este desconto')
    }
    throw new Error(`Erro ao atualizar desconto: ${error.message}`)
  }

  return data
}

/**
 * Deleta um desconto
 */
export async function deleteDiscount(id: string): Promise<void> {
  const { error } = await supabase
    .from('discounts')
    .delete()
    .eq('id', id)

  if (error) {
    if (error.code === '42501') {
      throw new Error('Você não tem permissão para deletar este desconto')
    }
    throw new Error(`Erro ao deletar desconto: ${error.message}`)
  }
}

/**
 * Incrementa o contador de usos de um desconto
 */
export async function incrementDiscountUses(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_discount_uses', {
    discount_id: id,
  })

  if (error) {
    // Se a função RPC não existir, fazer update manual
    const { data: discount } = await supabase
      .from('discounts')
      .select('current_uses')
      .eq('id', id)
      .single()

    if (discount) {
      const { error: updateError } = await supabase
        .from('discounts')
        .update({ current_uses: (discount.current_uses || 0) + 1 })
        .eq('id', id)

      if (updateError) {
        throw new Error(`Erro ao incrementar usos do desconto: ${updateError.message}`)
      }
    }
  }
}

/**
 * Calcula o valor final com desconto aplicado
 */
export function calculateDiscountedPrice(
  originalPrice: number,
  discount: Discount
): number {
  if (!discount.is_active) {
    return originalPrice
  }

  const now = new Date()
  const startDate = new Date(discount.start_date)
  const endDate = new Date(discount.end_date)

  if (now < startDate || now > endDate) {
    return originalPrice
  }

  if (discount.max_uses && discount.current_uses >= discount.max_uses) {
    return originalPrice
  }

  if (discount.discount_type === 'percentage') {
    const discountAmount = (originalPrice * discount.discount_value) / 100
    return Math.max(0, originalPrice - discountAmount)
  } else {
    // fixed
    return Math.max(0, originalPrice - discount.discount_value)
  }
}
