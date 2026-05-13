/**
 * MODIFIQUEI AQUI: ADM — vendedores, comissões, bonificações por indicação.
 */
import { supabase } from '../lib/supabase'
import type { User } from '../types'

export type SellerCommissionRow = {
  id: string
  seller_user_id: string
  participation_id: string
  sale_value: number
  commission_percent: number
  commission_value: number
  status: 'pending' | 'paid' | 'canceled'
  created_at: string
  paid_at?: string | null
  admin_payment_note?: string | null
}

export type ReferralIndicationRewardAdminRow = {
  id: string
  beneficiary_profile_id: string
  contest_id: string
  sales_milestone_total: number
  reward_type: string
  amount_brl: number | null
  status: string
  admin_payment_note: string | null
  paid_at: string | null
  created_at: string
}

export async function fetchReferralIndicationRewardsForAdmin(): Promise<ReferralIndicationRewardAdminRow[]> {
  const { data, error } = await supabase
    .from('referral_indication_rewards')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data || []) as ReferralIndicationRewardAdminRow[]
}

export async function updateReferralIndicationRewardAdmin(params: {
  id: string
  status: 'pending' | 'paid' | 'canceled'
  admin_payment_note?: string | null
}): Promise<void> {
  const patch: Record<string, unknown> = { status: params.status }
  if (params.status === 'paid') {
    patch.paid_at = new Date().toISOString()
  } else {
    patch.paid_at = null
  }
  if (params.admin_payment_note !== undefined) {
    patch.admin_payment_note = params.admin_payment_note
  }
  const { error } = await supabase.from('referral_indication_rewards').update(patch).eq('id', params.id)
  if (error) throw new Error(error.message)
}

export async function fetchCommissionsForAdmin(): Promise<SellerCommissionRow[]> {
  const { data, error } = await supabase
    .from('seller_commissions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []) as SellerCommissionRow[]
}

export async function updateCommissionStatusAdmin(
  id: string,
  status: 'pending' | 'paid' | 'canceled',
  options?: { admin_payment_note?: string | null }
): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (status === 'paid') {
    patch.paid_at = new Date().toISOString()
  } else {
    patch.paid_at = null
  }
  if (options?.admin_payment_note !== undefined) {
    patch.admin_payment_note = options.admin_payment_note
  }
  const { error } = await supabase.from('seller_commissions').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateUserSellerFieldsAdmin(params: {
  userId: string
  is_seller?: boolean
  commission_percent?: number
  is_active?: boolean
}): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (params.is_seller !== undefined) patch.is_seller = params.is_seller
  if (params.commission_percent !== undefined) patch.commission_percent = params.commission_percent
  if (params.is_active !== undefined) patch.is_active = params.is_active
  if (Object.keys(patch).length === 0) return
  const { error } = await supabase.from('profiles').update(patch).eq('id', params.userId)
  if (error) throw new Error(error.message)
}

export async function adminCreateBonusParticipationRpc(params: {
  userId: string
  contestId: string
  numbers: number[]
  reason: string
  bonusOriginUserId?: string | null
  /** MODIFIQUEI AQUI — consome 1 referral_bonus_credit do cliente e incrementa uso. */
  consumeReferralCredit?: boolean
}): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_admin_create_bonus_participation', {
    p_user_id: params.userId,
    p_contest_id: params.contestId,
    p_numbers: params.numbers,
    p_reason: params.reason,
    p_bonus_origin_user_id: params.bonusOriginUserId ?? null,
    p_consume_referral_credit: Boolean(params.consumeReferralCredit),
  })
  if (error) {
    const code = error.code != null ? String(error.code).trim() : ''
    const bits = [
      error.message,
      error.details && typeof error.details === 'string' && error.details.trim() ? error.details.trim() : null,
      error.hint && typeof error.hint === 'string' && error.hint.trim() ? error.hint.trim() : null,
      code ? `código ${code}` : null,
    ].filter(Boolean) as string[]
    throw new Error(bits.join(' · '))
  }
  const id = data as string
  return id
}

/** MODIFIQUEI AQUI: totais do ADM para vendedores / indicação (R$ só em comissões reais pagas/indicadas). */
export type PartnerUserRow = User & {
  indication_rewards_count: number
  indication_pix_pending_brl: number
  indication_pix_paid_brl: number
  commissions_sale_count_pending: number
  commissions_sale_count_paid: number
  commissions_sale_count_canceled: number
  total_sold_via_referral_brl: number
  commissions_total_pending_brl: number
  commissions_total_paid_brl: number
  commissions_total_canceled_sale_brl: number
}

export async function listUsersWithTotalsForPartners(): Promise<PartnerUserRow[]> {
  const users = await supabase
    .from('profiles')
    .select(
      'id, email, name, phone, cpf, birth_date, is_admin, is_active, referral_code, referral_bonus_credits, referral_bonus_credits_used, referral_qualifying_sales_count, is_seller, commission_percent, created_at, updated_at'
    )
    .order('name')

  if (users.error) throw new Error(users.error.message)

  const [{ data: commRows, error: cErr }, { data: rewRows, error: rErr }] = await Promise.all([
    supabase.from('seller_commissions').select('seller_user_id, status, sale_value, commission_value'),
    supabase.from('referral_indication_rewards').select('beneficiary_profile_id, reward_type, status, amount_brl'),
  ])
  if (cErr) throw new Error(cErr.message)
  if (rErr) throw new Error(rErr.message)

  type Agg = {
    pendN: number
    paidN: number
    cancN: number
    pendComm: number
    paidComm: number
    pendSale: number
    paidSale: number
    cancSale: number
  }
  const agg = new Map<string, Agg>()
  const initAgg = (): Agg => ({
    pendN: 0,
    paidN: 0,
    cancN: 0,
    pendComm: 0,
    paidComm: 0,
    pendSale: 0,
    paidSale: 0,
    cancSale: 0,
  })

  for (const r of commRows || []) {
    const sid = r.seller_user_id as string
    if (!agg.has(sid)) agg.set(sid, initAgg())
    const a = agg.get(sid)!
    const st = r.status as string
    const sv = Number(r.sale_value ?? 0)
    const cv = Number(r.commission_value ?? 0)
    if (st === 'pending') {
      a.pendN += 1
      a.pendComm += cv
      a.pendSale += sv
    } else if (st === 'paid') {
      a.paidN += 1
      a.paidComm += cv
      a.paidSale += sv
    } else if (st === 'canceled') {
      a.cancN += 1
      a.cancSale += sv
    }
  }

  const rewAgg = new Map<string, { n: number; pend: number; paid: number }>()
  for (const r of rewRows || []) {
    const bid = r.beneficiary_profile_id as string
    if (!rewAgg.has(bid)) rewAgg.set(bid, { n: 0, pend: 0, paid: 0 })
    const a = rewAgg.get(bid)!
    a.n += 1
    const rt = r.reward_type as string
    const st = r.status as string
    const am = Number(r.amount_brl ?? 0)
    if (rt === 'manual_pix_bonus' && st === 'pending') a.pend += am
    if (rt === 'manual_pix_bonus' && st === 'paid') a.paid += am
  }

  return ((users.data || []) as User[]).map((u) => ({
    ...u,
    indication_rewards_count: rewAgg.get(u.id)?.n ?? 0,
    indication_pix_pending_brl: rewAgg.get(u.id)?.pend ?? 0,
    indication_pix_paid_brl: rewAgg.get(u.id)?.paid ?? 0,
    commissions_sale_count_pending: agg.get(u.id)?.pendN ?? 0,
    commissions_sale_count_paid: agg.get(u.id)?.paidN ?? 0,
    commissions_sale_count_canceled: agg.get(u.id)?.cancN ?? 0,
    total_sold_via_referral_brl: (agg.get(u.id)?.pendSale ?? 0) + (agg.get(u.id)?.paidSale ?? 0),
    commissions_total_pending_brl: agg.get(u.id)?.pendComm ?? 0,
    commissions_total_paid_brl: agg.get(u.id)?.paidComm ?? 0,
    commissions_total_canceled_sale_brl: agg.get(u.id)?.cancSale ?? 0,
  }))
}
