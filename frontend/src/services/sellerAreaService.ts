/**
 * MODIFIQUEI AQUI: área do vendedor (leituras restritas pelo RPC no Supabase).
 */
import { supabase } from '../lib/supabase'

export type SellerAreaProfileSnip = {
  referral_code: string
  commission_percent: number
  referral_bonus_credits: number
  referral_bonus_credits_used: number
  referral_qualifying_sales_count: number
}

export type SellerAreaStats = {
  paid_sales_via_commission_lines: number
  total_sold_via_link_brl: number
  commission_generated_total_brl: number
  commission_pending_brl: number
  commission_paid_brl: number
  commission_canceled_rows: number
}

export type SellerAreaSaleRow = {
  commission_id: string
  sale_at: string
  contest_name: string
  buyer_display: string
  buyer_public_contact: string | null
  sale_value_brl: number
  commission_value_brl: number
  commission_percent: number
  sale_payment_status_pt: string
  participation_status: string
  commission_status: string
}

export type SellerAreaDashboardPayload = {
  profile: SellerAreaProfileSnip
  stats: SellerAreaStats
  sales: SellerAreaSaleRow[]
}

/** MODIFIQUEI AQUI — confia no servidor (is_seller + escopo apenas do uid). */
export async function fetchSellerAreaDashboardRpc(): Promise<SellerAreaDashboardPayload> {
  const { data, error } = await supabase.rpc('rpc_get_seller_area_dashboard')
  if (error) throw new Error(error.message)

  const raw = data as unknown
  if (!raw || typeof raw !== 'object') {
    throw new Error('Resposta inválida do painel de vendedor')
  }

  const j = raw as Record<string, unknown>
  const profile = j.profile as Record<string, unknown>
  const stats = j.stats as Record<string, unknown>
  const sales = Array.isArray(j.sales) ? (j.sales as Record<string, unknown>[]) : []

  return {
    profile: {
      referral_code: String(profile.referral_code ?? ''),
      commission_percent: Number(profile.commission_percent ?? 0),
      referral_bonus_credits: Number(profile.referral_bonus_credits ?? 0),
      referral_bonus_credits_used: Number(profile.referral_bonus_credits_used ?? 0),
      referral_qualifying_sales_count: Number(profile.referral_qualifying_sales_count ?? 0),
    },
    stats: {
      paid_sales_via_commission_lines: Number(stats.paid_sales_via_commission_lines ?? 0),
      total_sold_via_link_brl: Number(stats.total_sold_via_link_brl ?? 0),
      commission_generated_total_brl: Number(stats.commission_generated_total_brl ?? 0),
      commission_pending_brl: Number(stats.commission_pending_brl ?? 0),
      commission_paid_brl: Number(stats.commission_paid_brl ?? 0),
      commission_canceled_rows: Number(stats.commission_canceled_rows ?? 0),
    },
    sales: sales.map((r) => ({
      commission_id: String(r.commission_id ?? ''),
      sale_at: String(r.sale_at ?? ''),
      contest_name: String(r.contest_name ?? ''),
      buyer_display: String(r.buyer_display ?? ''),
      buyer_public_contact:
        r.buyer_public_contact == null ? null : String(r.buyer_public_contact),
      sale_value_brl: Number(r.sale_value_brl ?? 0),
      commission_value_brl: Number(r.commission_value_brl ?? 0),
      commission_percent: Number(r.commission_percent ?? 0),
      sale_payment_status_pt: String(r.sale_payment_status_pt ?? ''),
      participation_status: String(r.participation_status ?? ''),
      commission_status: String(r.commission_status ?? ''),
    })),
  }
}
