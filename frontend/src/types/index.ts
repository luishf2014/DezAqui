/**
 * Tipos TypeScript do domínio
 * 
 * Baseado no modelo de domínio definido em docs/01_domain_model.md
 * 
 * FASE 1: Tipos básicos apenas
 * Fases futuras: Expandir conforme necessário
 */

// ============================================
// Usuário
// ============================================
export interface User {
  id: string
  email: string
  name: string
  phone?: string
  is_admin: boolean
  created_at: string
  updated_at: string
}

// ============================================
// Concurso
// ============================================
export type ContestStatus = 'draft' | 'active' | 'finished' | 'cancelled'

export interface Contest {
  id: string
  name: string
  description?: string
  min_number: number
  max_number: number
  numbers_per_participation: number
  start_date: string
  end_date: string
  status: ContestStatus
  participation_value?: number
  created_by: string
  created_at: string
  updated_at: string
}

// ============================================
// Participação
// ============================================
export type ParticipationStatus = 'pending' | 'active' | 'cancelled'

export interface Participation {
  id: string
  contest_id: string
  user_id: string
  numbers: number[]
  status: ParticipationStatus
  current_score: number
  ticket_code?: string // MODIFIQUEI AQUI - Código único da participação (ex: TKT-20250124-A1B2C3)
  created_at: string
  updated_at: string
}

// ============================================
// Sorteio
// ============================================
export interface Draw {
  id: string
  contest_id: string
  numbers: number[]
  draw_date: string
  code?: string // MODIFIQUEI AQUI - Código único do sorteio (ex: DRW-20250124-A1B2C3)
  created_at: string
}

// ============================================
// Pagamento
// ============================================
export type PaymentStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'
export type PaymentMethod = 'pix' | 'cash' | 'manual'

export interface Payment {
  id: string
  participation_id: string
  amount: number
  status: PaymentStatus
  payment_method?: PaymentMethod
  external_id?: string
  external_data?: Record<string, unknown>
  paid_at?: string
  created_at: string
  updated_at: string
}

// ============================================
// Desconto/Promoção
// ============================================
export type DiscountType = 'percentage' | 'fixed'

export interface Discount {
  id: string
  code: string // Código único do cupom (ex: PROMO2025)
  name: string
  description?: string
  discount_type: DiscountType // 'percentage' ou 'fixed'
  discount_value: number // Valor do desconto (percentual 0-100 ou valor fixo)
  contest_id?: string | null // NULL = desconto global
  start_date: string
  end_date: string
  max_uses?: number | null // NULL = ilimitado
  current_uses: number
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}
