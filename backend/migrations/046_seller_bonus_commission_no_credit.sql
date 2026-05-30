-- ============================================
-- Migração 046 — bonificação cambista gera comissão; sem consumo de crédito
-- MODIFIQUEI AQUI: comissão sobre participation_value do bolão; painel inclui estas linhas
-- ============================================

DROP FUNCTION IF EXISTS public.rpc_seller_create_bonus_participation(uuid, uuid, integer[], text, boolean);

CREATE OR REPLACE FUNCTION public.rpc_seller_create_bonus_participation(
  p_user_id uuid,
  p_contest_id uuid,
  p_numbers integer[],
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
  ticket_code text;
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i int;
  audit_reason text;
  seller_rec RECORD;
  ct_rec RECORD;
  eff_pct numeric;
  comm numeric;
  sale_val numeric;
  skip_comm boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles sx
    WHERE sx.id = uid
      AND COALESCE(sx.is_seller, false)
      AND COALESCE(sx.is_active, true)
  ) THEN
    RAISE EXCEPTION 'Acesso restrito: apenas cambistas autorizados';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles cp
    WHERE cp.id = p_user_id
      AND COALESCE(cp.is_active, true)
      AND NOT COALESCE(cp.is_seller, false)
      AND NOT COALESCE(cp.is_admin, false)
      AND (
        cp.referred_by_seller_profile_id = uid
        OR EXISTS (
          SELECT 1
          FROM public.participations pt
          WHERE pt.user_id = cp.id
            AND pt.referred_by_profile_id = uid
        )
      )
  ) THEN
    RAISE EXCEPTION 'Cliente inexistente, inativo ou não vinculado a este cambista';
  END IF;

  PERFORM set_config('app.rpc_seller_bonus', '1', true);

  SELECT c.participation_value, c.seller_commission_percent_override
  INTO ct_rec
  FROM public.contests c
  WHERE c.id = p_contest_id AND c.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Concurso indisponível';
  END IF;

  PERFORM 1
  FROM public.contests c
  WHERE c.id = p_contest_id
    AND cardinality(p_numbers) = c.numbers_per_participation;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quantidade de números inválida para este concurso';
  END IF;

  PERFORM 1
  FROM public.contests c,
    LATERAL unnest(p_numbers) AS x(n)
  WHERE c.id = p_contest_id
    AND NOT (x.n BETWEEN c.min_number AND c.max_number);
  IF FOUND THEN
    RAISE EXCEPTION 'Número fora do intervalo permitido';
  END IF;

  audit_reason := NULLIF(trim(p_reason), '');
  IF audit_reason IS NULL THEN
    RAISE EXCEPTION 'Motivo (auditoria) é obrigatório';
  END IF;

  audit_reason := audit_reason || ' | cambista';

  ticket_code := 'TK-';
  FOR i IN 1..6 LOOP
    ticket_code := ticket_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;

  INSERT INTO public.participations (
    contest_id,
    user_id,
    numbers,
    status,
    current_score,
    ticket_code,
    amount,
    is_bonus,
    bonus_reason,
    bonus_origin_user_id,
    referred_by_profile_id,
    referrer_code_snapshot
  )
  VALUES (
    p_contest_id,
    p_user_id,
    p_numbers,
    'active',
    0,
    ticket_code,
    NULL,
    true,
    audit_reason,
    uid,
    uid,
    NULL
  )
  RETURNING id INTO new_id;

  SELECT pr.commission_percent, pr.commission_mode
  INTO seller_rec
  FROM public.profiles pr
  WHERE pr.id = uid;

  sale_val := COALESCE(ct_rec.participation_value, 0)::numeric;
  eff_pct := COALESCE(ct_rec.seller_commission_percent_override, seller_rec.commission_percent, 0);

  IF COALESCE(seller_rec.commission_mode, 'recurring_purchases') = 'first_purchase_only' THEN
    IF EXISTS (
      SELECT 1
      FROM public.seller_commissions sc2
      INNER JOIN public.participations pb ON pb.id = sc2.participation_id
      WHERE sc2.seller_user_id = uid
        AND pb.user_id = p_user_id
        AND sc2.status IN ('pending', 'paid')
        AND sc2.participation_id <> new_id
    ) THEN
      skip_comm := true;
    END IF;
  END IF;

  IF NOT skip_comm AND COALESCE(eff_pct, 0) > 0 AND sale_val > 0 THEN
    comm := round(sale_val * (LEAST(eff_pct, 100::numeric) / 100), 2);

    INSERT INTO public.seller_commissions (
      seller_user_id,
      participation_id,
      sale_value,
      commission_percent,
      commission_value,
      status
    )
    VALUES (
      uid,
      new_id,
      sale_val,
      LEAST(eff_pct, 100::numeric),
      comm,
      'pending'
    )
    ON CONFLICT (participation_id) DO NOTHING;
  END IF;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_seller_create_bonus_participation(uuid, uuid, integer[], text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_seller_create_bonus_participation(uuid, uuid, integer[], text)
  TO authenticated;

COMMENT ON FUNCTION public.rpc_seller_create_bonus_participation(uuid, uuid, integer[], text) IS
  'MODIFIQUEI AQUI: bilhete R$ 0 pelo cambista; gera comissão pendente sobre o valor do bolão.';

-- ---------------------------------------------------------------------------
-- Painel cambista — incluir comissões de bonificação criadas pelo próprio cambista
-- ---------------------------------------------------------------------------
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
  buyers int;
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
    'commission_mode', COALESCE(NULLIF(trim(pr.commission_mode), ''), 'recurring_purchases')
  )
  INTO j_profile
  FROM public.profiles pr
  WHERE pr.id = uid;

  SELECT COUNT(DISTINCT p.user_id)::int
  INTO buyers
  FROM public.participations p
  INNER JOIN public.payments pym ON pym.participation_id = p.id AND pym.status = 'paid'
  WHERE p.referred_by_profile_id = uid
    AND p.user_id IS DISTINCT FROM uid
    AND NOT COALESCE(p.is_bonus, false);

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
      COALESCE(COUNT(*) FILTER (WHERE sc.status = 'canceled'), 0)::int,
    'referred_buyers_with_paid_sale_count', COALESCE(buyers, 0)
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
        'sale_payment_status_pt',
          CASE
            WHEN COALESCE(p.is_bonus, false) AND p.bonus_origin_user_id = uid THEN 'Bonificação cambista'
            WHEN COALESCE(p.is_bonus, false) THEN 'Bonificação'
            ELSE 'Pagamento confirmado'
          END,
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

COMMENT ON FUNCTION public.rpc_get_seller_area_dashboard() IS
  'MODIFIQUEI AQUI: painel cambista inclui comissões de bonificação criadas pelo próprio vendedor.';
