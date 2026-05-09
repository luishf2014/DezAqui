-- ============================================
-- Migração 041 — Área do vendedor (dados apenas do próprio cambista via RPC)
-- MODIFIQUEI AQUI: só usuários profiles.is_seller chamam esta função; retorno agregado
-- sem expor outros vendedores; leituras internas ignoram RLS (SECURITY DEFINER).
-- ============================================

CREATE OR REPLACE FUNCTION public.rpc_get_seller_area_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  j_profile jsonb;
  j_agg jsonb;
  j_sales jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles px WHERE px.id = uid AND COALESCE(px.is_seller, FALSE)
  ) THEN
    RAISE EXCEPTION 'Acesso restrito: apenas cambistas autorizados';
  END IF;

  SELECT jsonb_build_object(
    'referral_code', COALESCE(NULLIF(trim(pr.referral_code), ''), ''),
    'commission_percent', pr.commission_percent::double precision,
    'referral_bonus_credits', COALESCE(pr.referral_bonus_credits, 0),
    'referral_bonus_credits_used', COALESCE(pr.referral_bonus_credits_used, 0),
    'referral_qualifying_sales_count', COALESCE(pr.referral_qualifying_sales_count, 0)
  )
  INTO j_profile
  FROM public.profiles pr
  WHERE pr.id = uid;

  SELECT jsonb_build_object(
    'paid_sales_via_commission_lines',
      COALESCE(COUNT(*) FILTER (WHERE sc.status IN ('pending', 'paid')), 0)::int,
    'total_sold_via_link_brl',
      COALESCE(SUM(sc.sale_value) FILTER (WHERE sc.status IN ('pending', 'paid')), 0)::double precision,
    'commission_generated_total_brl',
      COALESCE(SUM(sc.commission_value) FILTER (WHERE sc.status IN ('pending', 'paid')), 0)::double precision,
    'commission_pending_brl',
      COALESCE(SUM(sc.commission_value) FILTER (WHERE sc.status = 'pending'), 0)::double precision,
    'commission_paid_brl',
      COALESCE(SUM(sc.commission_value) FILTER (WHERE sc.status = 'paid'), 0)::double precision,
    'commission_canceled_rows',
      COALESCE(COUNT(*) FILTER (WHERE sc.status = 'canceled'), 0)::int
  )
  INTO j_agg
  FROM public.seller_commissions sc
  WHERE sc.seller_user_id = uid;

  IF j_agg IS NULL THEN
    j_agg := '{}'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(sr.row_obj ORDER BY sr.sale_dt DESC NULLS LAST), '[]'::jsonb)
  INTO j_sales
  FROM (
    SELECT
      jsonb_build_object(
        'commission_id', sc.id,
        'sale_at', COALESCE(pm.paid_at::timestamptz, sc.created_at::timestamptz),
        'contest_name', ct.name,
        'buyer_display', COALESCE(trim(nullif(by.name, '')), trim(nullif(by.email::text, '')), 'Cliente'),
        'buyer_public_contact',
          CASE
            WHEN by.email IS NULL OR trim(by.email::text) = '' THEN NULL
            ELSE
              substring(split_part(trim(lower(by.email::text)), '@', 1) FROM 1 FOR 1)
              || '***@'
              || nullif(trim(split_part(trim(lower(by.email::text)), '@', 2)), '')
          END,
        'sale_value_brl', sc.sale_value::double precision,
        'commission_value_brl', sc.commission_value::double precision,
        'commission_percent', sc.commission_percent::double precision,
        'sale_payment_status_pt', 'Pagamento confirmado',
        'participation_status', p.status,
        'commission_status', sc.status
      ) AS row_obj,
      COALESCE(pm.paid_at, sc.created_at) AS sale_dt
    FROM public.seller_commissions sc
    INNER JOIN public.participations p ON p.id = sc.participation_id
    INNER JOIN public.contests ct ON ct.id = p.contest_id
    INNER JOIN public.profiles by ON by.id = p.user_id
    LEFT JOIN LATERAL (
      SELECT pym.created_at::timestamptz AS paid_at
      FROM public.payments pym
      WHERE pym.participation_id = p.id
        AND pym.status = 'paid'
      ORDER BY pym.created_at DESC
      LIMIT 1
    ) pm ON TRUE
    WHERE sc.seller_user_id = uid
      AND NOT COALESCE(p.is_bonus, FALSE)
    ORDER BY COALESCE(pm.paid_at, sc.created_at) DESC NULLS LAST
    LIMIT 300
  ) sr;

  IF j_sales IS NULL THEN
    j_sales := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'profile', COALESCE(j_profile, '{}'::jsonb),
    'stats', COALESCE(j_agg, '{}'::jsonb),
    'sales', j_sales
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_seller_area_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_seller_area_dashboard() TO authenticated;

COMMENT ON FUNCTION public.rpc_get_seller_area_dashboard() IS 'MODIFIQUEI AQUI: painel só-leitura do vendedor (próprio uid + is_seller).';
