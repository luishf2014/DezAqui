/**
 * MODIFIQUEI AQUI — painel «Indique e Ganhe» (cliente não cambista) via RPC.
 */
import { supabase } from '../lib/supabase'

export type ReferIndicateRewardRow = {
  id: string
  created_at: string
  reward_type: 'free_ticket' | 'manual_pix_bonus'
  amount_brl: number | null
  status: 'pending' | 'paid' | 'canceled'
  sales_milestone_total: number
  contest_name: string
  paid_at: string | null
  admin_payment_note: string | null
}

export type ReferIndicateStats = {
  referred_buyers_count: number
  confirmed_sales_count: number
  bonuses_generated_count: number
  bonuses_pending_pix_brl: number
  bonuses_paid_pix_brl: number
  free_tickets_available: number
  free_tickets_used: number
}

export type ReferIndicateDashboardPayload = {
  profile: {
    referral_code: string
    referral_bonus_credits: number
    referral_bonus_credits_used: number
  }
  stats: ReferIndicateStats
  last_bonus: Record<string, unknown> | null
  recent_rewards: ReferIndicateRewardRow[]
}

export async function fetchReferIndicateDashboardRpc(): Promise<ReferIndicateDashboardPayload> {
  const { data, error } = await supabase.rpc('rpc_get_referral_indicate_dashboard')
  if (error) throw new Error(error.message)

  const raw = data as unknown
  if (!raw || typeof raw !== 'object') {
    throw new Error('Resposta inválida do painel Indique e Ganhe')
  }

  const j = raw as Record<string, unknown>
  const profile = j.profile as Record<string, unknown>
  const stats = j.stats as Record<string, unknown>
  const last = j.last_bonus as Record<string, unknown> | null | undefined
  const rewards = Array.isArray(j.recent_rewards) ? j.recent_rewards : []

  return {
    profile: {
      referral_code: String(profile?.referral_code ?? ''),
      referral_bonus_credits: Number(profile?.referral_bonus_credits ?? 0),
      referral_bonus_credits_used: Number(profile?.referral_bonus_credits_used ?? 0),
    },
    stats: {
      referred_buyers_count: Number(stats?.referred_buyers_count ?? 0),
      confirmed_sales_count: Number(stats?.confirmed_sales_count ?? 0),
      bonuses_generated_count: Number(stats?.bonuses_generated_count ?? 0),
      bonuses_pending_pix_brl: Number(stats?.bonuses_pending_pix_brl ?? 0),
      bonuses_paid_pix_brl: Number(stats?.bonuses_paid_pix_brl ?? 0),
      free_tickets_available: Number(stats?.free_tickets_available ?? 0),
      free_tickets_used: Number(stats?.free_tickets_used ?? 0),
    },
    last_bonus: last ?? null,
    recent_rewards: rewards.map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: String(row.id ?? ''),
        created_at: String(row.created_at ?? ''),
        reward_type: String(row.reward_type ?? '') as ReferIndicateRewardRow['reward_type'],
        amount_brl: row.amount_brl == null ? null : Number(row.amount_brl),
        status: String(row.status ?? '') as ReferIndicateRewardRow['status'],
        sales_milestone_total: Number(row.sales_milestone_total ?? 0),
        contest_name: String(row.contest_name ?? ''),
        paid_at: row.paid_at == null ? null : String(row.paid_at),
        admin_payment_note: row.admin_payment_note == null ? null : String(row.admin_payment_note),
      }
    }),
  }
}
