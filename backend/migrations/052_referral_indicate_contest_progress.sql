-- ============================================
-- Migração 052 — progresso por bolão no painel Indique e Ganhe
-- MODIFIQUEI AQUI: barras por bolão ativo (vendas no ciclo atual vs meta).
-- ============================================

CREATE OR REPLACE FUNCTION public.rpc_get_referral_indicate_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  j_profile jsonb;
  j_stats jsonb;
  j_last jsonb;
  j_rewards jsonb;
  j_progress jsonb;
  buyers int;
  sales int;
  gen_n int;
  pend_brl numeric;
  paid_brl numeric;
  pr_credits int;
  pr_used int;
  pr_code text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles px WHERE px.id = uid AND COALESCE(px.is_seller, false)
  ) THEN
    RAISE EXCEPTION 'Área exclusiva de clientes — cambistas usam «Meu link de venda»';
  END IF;

  SELECT
    COALESCE(NULLIF(trim(pr.referral_code), ''), ''),
    COALESCE(pr.referral_bonus_credits, 0),
    COALESCE(pr.referral_bonus_credits_used, 0)
  INTO pr_code, pr_credits, pr_used
  FROM public.profiles pr
  WHERE pr.id = uid;

  j_profile := jsonb_build_object(
    'referral_code', COALESCE(pr_code, ''),
    'referral_bonus_credits', COALESCE(pr_credits, 0),
    'referral_bonus_credits_used', COALESCE(pr_used, 0)
  );

  SELECT COUNT(DISTINCT pt.user_id)::int
  INTO buyers
  FROM public.referral_paid_attributions rpa
  INNER JOIN public.participations pt ON pt.id = rpa.participation_id
  WHERE rpa.referrer_profile_id = uid
    AND pt.user_id IS DISTINCT FROM uid;

  SELECT COUNT(*)::int
  INTO sales
  FROM public.referral_paid_attributions rpa
  WHERE rpa.referrer_profile_id = uid;

  SELECT COUNT(*)::int
  INTO gen_n
  FROM public.referral_indication_rewards r
  WHERE r.beneficiary_profile_id = uid;

  SELECT COALESCE(SUM(r.amount_brl) FILTER (WHERE r.reward_type = 'manual_pix_bonus' AND r.status = 'pending'), 0)::numeric
  INTO pend_brl
  FROM public.referral_indication_rewards r
  WHERE r.beneficiary_profile_id = uid;

  SELECT COALESCE(SUM(r.amount_brl) FILTER (WHERE r.reward_type = 'manual_pix_bonus' AND r.status = 'paid'), 0)::numeric
  INTO paid_brl
  FROM public.referral_indication_rewards r
  WHERE r.beneficiary_profile_id = uid;

  j_stats := jsonb_build_object(
    'referred_buyers_count', COALESCE(buyers, 0),
    'confirmed_sales_count', COALESCE(sales, 0),
    'bonuses_generated_count', COALESCE(gen_n, 0),
    'bonuses_pending_pix_brl', COALESCE(pend_brl, 0)::double precision,
    'bonuses_paid_pix_brl', COALESCE(paid_brl, 0)::double precision,
    'free_tickets_available', COALESCE(pr_credits, 0),
    'free_tickets_used', COALESCE(pr_used, 0)
  );

  SELECT COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'contest_id', q.contest_id,
        'contest_name', q.contest_name,
        'target_sales', q.target_sales,
        'reward_type', q.reward_type,
        'reward_value', q.reward_value,
        'confirmed_sales_total', q.confirmed_sales_total,
        'current_cycle_sales', q.current_cycle_sales,
        'milestones_reached', q.milestones_reached
      ) ORDER BY q.contest_name
    )
    FROM (
      SELECT
        c.id AS contest_id,
        c.name AS contest_name,
        c.referral_target_sales AS target_sales,
        c.referral_reward_type AS reward_type,
        CASE
          WHEN c.referral_reward_value IS NULL THEN NULL
          ELSE c.referral_reward_value::double precision
        END AS reward_value,
        COALESCE(sc.cnt, 0) AS confirmed_sales_total,
        CASE
          WHEN COALESCE(c.referral_target_sales, 0) > 0 THEN
            COALESCE(sc.cnt, 0) % c.referral_target_sales
          ELSE 0
        END AS current_cycle_sales,
        CASE
          WHEN COALESCE(c.referral_target_sales, 0) > 0 THEN
            COALESCE(sc.cnt, 0) / c.referral_target_sales
          ELSE 0
        END AS milestones_reached
      FROM public.contests c
      LEFT JOIN (
        SELECT pt.contest_id, COUNT(*)::int AS cnt
        FROM public.referral_paid_attributions rpa
        INNER JOIN public.participations pt ON pt.id = rpa.participation_id
        WHERE rpa.referrer_profile_id = uid
        GROUP BY pt.contest_id
      ) sc ON sc.contest_id = c.id
      WHERE c.status = 'active'
        AND COALESCE(c.referral_target_sales, 0) > 0
        AND c.referral_reward_type IS NOT NULL
    ) q
  ), '[]'::jsonb)
  INTO j_progress;

  SELECT jsonb_build_object(
    'id', r.id,
    'created_at', r.created_at,
    'reward_type', r.reward_type,
    'amount_brl', CASE WHEN r.amount_brl IS NULL THEN NULL ELSE r.amount_brl::double precision END,
    'status', r.status,
    'contest_id', r.contest_id,
    'sales_milestone_total', r.sales_milestone_total
  )
  INTO j_last
  FROM public.referral_indication_rewards r
  WHERE r.beneficiary_profile_id = uid
  ORDER BY r.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'created_at', q.created_at,
        'reward_type', q.reward_type,
        'amount_brl', CASE WHEN q.amount_brl IS NULL THEN NULL ELSE q.amount_brl::double precision END,
        'status', q.status,
        'sales_milestone_total', q.sales_milestone_total,
        'contest_name', q.contest_name,
        'paid_at', q.paid_at,
        'admin_payment_note', q.admin_payment_note
      ) ORDER BY q.created_at DESC
    )
    FROM (
      SELECT
        r.id,
        r.created_at,
        r.reward_type,
        r.amount_brl,
        r.status,
        r.sales_milestone_total,
        r.paid_at,
        r.admin_payment_note,
        ct.name AS contest_name
      FROM public.referral_indication_rewards r
      INNER JOIN public.contests ct ON ct.id = r.contest_id
      WHERE r.beneficiary_profile_id = uid
      ORDER BY r.created_at DESC
      LIMIT 80
    ) q
  ), '[]'::jsonb)
  INTO j_rewards;

  RETURN jsonb_build_object(
    'profile', COALESCE(j_profile, '{}'::jsonb),
    'stats', COALESCE(j_stats, '{}'::jsonb),
    'last_bonus', j_last,
    'recent_rewards', COALESCE(j_rewards, '[]'::jsonb),
    'contest_progress', COALESCE(j_progress, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_get_referral_indicate_dashboard() IS
  'MODIFIQUEI AQUI: resumo Indique e Ganhe + progresso por bolão ativo (ciclo atual da meta).';
