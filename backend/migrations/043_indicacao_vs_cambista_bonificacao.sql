-- ============================================
-- Migração 043: Separar Indique e Ganhe (cliente) vs Cambista (comissão)
-- MODIFIQUEI AQUI: meta por concurso, bônus Pix manual ou jogo grátis;
-- indicação só conta para quem NÃO é cambista; comissão só para cambista;
-- sem carteira; cancelamento remove atribuição e cancela bônus Pix pendentes excedentes.
-- ============================================

-- ---------------------------------------------------------------------------
-- 1) Concurso — parâmetros do programa «Indique e Ganhe» + override de % cambista
-- ---------------------------------------------------------------------------
ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS referral_target_sales INTEGER
    CHECK (referral_target_sales IS NULL OR referral_target_sales > 0);

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS referral_reward_type TEXT
    CHECK (
      referral_reward_type IS NULL
      OR referral_reward_type IN ('free_ticket', 'manual_pix_bonus')
    );

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS referral_reward_value NUMERIC(12, 2)
    CHECK (referral_reward_value IS NULL OR referral_reward_value >= 0);

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS seller_commission_percent_override NUMERIC(5, 2)
    CHECK (
      seller_commission_percent_override IS NULL
      OR (
        seller_commission_percent_override >= 0
        AND seller_commission_percent_override <= 100
      )
    );

COMMENT ON COLUMN public.contests.referral_target_sales IS 'MODIFIQUEI AQUI: vendas confirmadas (pagas) via indicação necessárias para 1 recompensa; NULL desliga geração automática.';
COMMENT ON COLUMN public.contests.referral_reward_type IS 'MODIFIQUEI AQUI: free_ticket | manual_pix_bonus.';
COMMENT ON COLUMN public.contests.referral_reward_value IS 'MODIFIQUEI AQUI: valor informativo do bônus Pix (pagamento manual pelo ADM).';
COMMENT ON COLUMN public.contests.seller_commission_percent_override IS 'MODIFIQUEI AQUI: se preenchido, substitui profiles.commission_percent nas vendas deste bolão.';

-- ---------------------------------------------------------------------------
-- 2) Registros de bônus por indicação (sem carteira)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_indication_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  sales_milestone_total INTEGER NOT NULL CHECK (sales_milestone_total > 0),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('free_ticket', 'manual_pix_bonus')),
  amount_brl NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'canceled')),
  admin_payment_note TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (beneficiary_profile_id, contest_id, sales_milestone_total)
);

CREATE INDEX IF NOT EXISTS idx_ref_ind_rew_beneficiary
  ON public.referral_indication_rewards (beneficiary_profile_id);

CREATE INDEX IF NOT EXISTS idx_ref_ind_rew_contest
  ON public.referral_indication_rewards (contest_id);

COMMENT ON TABLE public.referral_indication_rewards IS 'MODIFIQUEI AQUI: bônus gerados pela meta de indicações por bolão; Pix fica pendente até o ADM marcar pago.';

-- ---------------------------------------------------------------------------
-- 3) Comissões — auditoria de pagamento manual Pix
-- ---------------------------------------------------------------------------
ALTER TABLE public.seller_commissions
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.seller_commissions
  ADD COLUMN IF NOT EXISTS admin_payment_note TEXT;

COMMENT ON COLUMN public.seller_commissions.paid_at IS 'MODIFIQUEI AQUI: quando o ADM registrou pagamento manual via Pix.';
COMMENT ON COLUMN public.seller_commissions.admin_payment_note IS 'MODIFIQUEI AQUI: observação do ADM (ex.: comprovante, data do Pix).';

-- ---------------------------------------------------------------------------
-- 4) Função auxiliar — cancelar bônus Pix pendentes se meta não é mais atingida
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_cancel_stale_pending_pix_bonuses(
  p_referrer_id uuid,
  p_contest_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnt int;
BEGIN
  IF p_referrer_id IS NULL OR p_contest_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::int
  INTO v_cnt
  FROM public.referral_paid_attributions rpa
  INNER JOIN public.participations pt ON pt.id = rpa.participation_id
  WHERE rpa.referrer_profile_id = p_referrer_id
    AND pt.contest_id = p_contest_id;

  UPDATE public.referral_indication_rewards r
  SET status = 'canceled'
  WHERE r.beneficiary_profile_id = p_referrer_id
    AND r.contest_id = p_contest_id
    AND r.reward_type = 'manual_pix_bonus'
    AND r.status = 'pending'
    AND r.sales_milestone_total > COALESCE(v_cnt, 0);
END;
$$;

COMMENT ON FUNCTION public.referral_cancel_stale_pending_pix_bonuses(uuid, uuid) IS
  'MODIFIQUEI AQUI: após remover venda da contagem, cancela bônus Pix pendentes que exigiam mais vendas.';

-- ---------------------------------------------------------------------------
-- 5) Efeitos pós-venda (substitui lógica 039/040 — indicação ≠ cambista)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_paid_sale_effects(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pym public.payments%ROWTYPE;
  part public.participations%ROWTYPE;
  ref_rec RECORD;
  ct_rec RECORD;
  ins_attr int;
  ins_reward int;
  contest_sales int;
  target int;
  pct numeric;
  comm numeric;
  eff_pct numeric;
BEGIN
  SELECT * INTO pym FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF pym.participation_id IS NULL OR pym.status <> 'paid' THEN
    RETURN;
  END IF;

  IF pym.sale_side_effects_at IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT * INTO part FROM public.participations WHERE id = pym.participation_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF COALESCE(part.is_bonus, false) THEN
    UPDATE public.payments
    SET sale_side_effects_at = now()
    WHERE id = p_payment_id;
    RETURN;
  END IF;

  IF part.referred_by_profile_id IS NOT NULL
     AND part.referred_by_profile_id <> part.user_id THEN
    SELECT pr.is_seller, pr.commission_percent
    INTO ref_rec
    FROM public.profiles pr
    WHERE pr.id = part.referred_by_profile_id;

    IF FOUND AND COALESCE(ref_rec.is_seller, false) THEN
      -- MODIFIQUEI AQUI: Cambista — só comissão; percentual do bolão substitui o do perfil.
      SELECT COALESCE(c.seller_commission_percent_override, ref_rec.commission_percent, 0)
      INTO eff_pct
      FROM public.contests c
      WHERE c.id = part.contest_id;

      IF COALESCE(eff_pct, 0) > 0 THEN
        pct := LEAST(eff_pct, 100::numeric);
        comm := round(pym.amount::numeric * (pct / 100), 2);

        INSERT INTO public.seller_commissions (
          seller_user_id,
          participation_id,
          sale_value,
          commission_percent,
          commission_value,
          status
        )
        VALUES (
          part.referred_by_profile_id,
          part.id,
          pym.amount::numeric,
          pct,
          comm,
          'pending'
        )
        ON CONFLICT (participation_id) DO NOTHING;
      END IF;
    ELSE
      -- Cliente indicador: meta por bolão, sem comissão
      INSERT INTO public.referral_paid_attributions (participation_id, referrer_profile_id)
      VALUES (part.id, part.referred_by_profile_id)
      ON CONFLICT (participation_id) DO NOTHING;

      GET DIAGNOSTICS ins_attr = ROW_COUNT;

      IF ins_attr > 0 THEN
        SELECT
          c.referral_target_sales,
          c.referral_reward_type,
          c.referral_reward_value
        INTO ct_rec
        FROM public.contests c
        WHERE c.id = part.contest_id;

        target := COALESCE(ct_rec.referral_target_sales, 0);

        IF target > 0
           AND ct_rec.referral_reward_type IS NOT NULL THEN
          SELECT COUNT(*)::int
          INTO contest_sales
          FROM public.referral_paid_attributions rpa
          INNER JOIN public.participations pt ON pt.id = rpa.participation_id
          WHERE rpa.referrer_profile_id = part.referred_by_profile_id
            AND pt.contest_id = part.contest_id;

          IF contest_sales > 0 AND contest_sales % target = 0 THEN
            IF ct_rec.referral_reward_type = 'free_ticket' THEN
              INSERT INTO public.referral_indication_rewards (
                beneficiary_profile_id,
                contest_id,
                sales_milestone_total,
                reward_type,
                amount_brl,
                status,
                paid_at
              )
              VALUES (
                part.referred_by_profile_id,
                part.contest_id,
                contest_sales,
                'free_ticket',
                NULL,
                'paid',
                now()
              )
              ON CONFLICT (beneficiary_profile_id, contest_id, sales_milestone_total) DO NOTHING;

              GET DIAGNOSTICS ins_reward = ROW_COUNT;

              IF ins_reward > 0 THEN
                UPDATE public.profiles
                SET referral_bonus_credits = referral_bonus_credits + 1
                WHERE id = part.referred_by_profile_id;
              END IF;
            ELSIF ct_rec.referral_reward_type = 'manual_pix_bonus' THEN
              INSERT INTO public.referral_indication_rewards (
                beneficiary_profile_id,
                contest_id,
                sales_milestone_total,
                reward_type,
                amount_brl,
                status
              )
              VALUES (
                part.referred_by_profile_id,
                part.contest_id,
                contest_sales,
                'manual_pix_bonus',
                COALESCE(ct_rec.referral_reward_value, 0),
                'pending'
              )
              ON CONFLICT (beneficiary_profile_id, contest_id, sales_milestone_total) DO NOTHING;
            END IF;
        END IF;
      END IF;
    END IF;
    END IF;
  END IF;

  UPDATE public.payments
  SET sale_side_effects_at = now()
  WHERE id = p_payment_id AND sale_side_effects_at IS NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Reverter pagamento: comissão + indicação + bônus pendentes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revert_paid_sale_payment_effects_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref uuid;
  v_contest uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.participation_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT contest_id INTO v_contest
  FROM public.participations
  WHERE id = OLD.participation_id;

  UPDATE public.seller_commissions
  SET status = 'canceled'
  WHERE participation_id = OLD.participation_id AND status = 'pending';

  DELETE FROM public.referral_paid_attributions
  WHERE participation_id = OLD.participation_id
  RETURNING referrer_profile_id INTO v_ref;

  IF v_ref IS NOT NULL AND v_contest IS NOT NULL THEN
    PERFORM public.referral_cancel_stale_pending_pix_bonuses(v_ref, v_contest);
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Participação cancelada: invalidar comissão pendente e indicação
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.participations_cancel_commissions_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref uuid;
  v_contest uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  UPDATE public.seller_commissions
  SET status = 'canceled'
  WHERE participation_id = NEW.id AND status = 'pending';

  DELETE FROM public.referral_paid_attributions
  WHERE participation_id = NEW.id
  RETURNING referrer_profile_id INTO v_ref;

  IF v_ref IS NOT NULL THEN
    v_contest := NEW.contest_id;
    PERFORM public.referral_cancel_stale_pending_pix_bonuses(v_ref, v_contest);
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8) RPC — resgatar jogo grátis (bloqueia cambistas)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_redeem_referral_free_credit(p_contest_id uuid, p_numbers integer[])
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
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  PERFORM set_config('app.rpc_referral_redeem', '1', true);

  PERFORM 1 FROM public.profiles p
  WHERE p.id = uid
    AND COALESCE(p.is_active, true)
    AND COALESCE(p.referral_bonus_credits, 0) > 0
    AND NOT COALESCE(p.is_seller, false)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sem crédito de indicação, conta inativa ou perfil de vendedor não usa este fluxo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.contests ct WHERE ct.id = p_contest_id AND ct.status = 'active'
  ) THEN
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

  UPDATE public.profiles
  SET
    referral_bonus_credits = referral_bonus_credits - 1,
    referral_bonus_credits_used = referral_bonus_credits_used + 1
  WHERE id = uid;

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
    uid,
    p_numbers,
    'active',
    0,
    ticket_code,
    NULL,
    true,
    'referral_indication_free_ticket',
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9) Painel «Indique e Ganhe» (apenas não cambista)
-- ---------------------------------------------------------------------------
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
    'recent_rewards', COALESCE(j_rewards, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_referral_indicate_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_referral_indicate_dashboard() TO authenticated;

COMMENT ON FUNCTION public.rpc_get_referral_indicate_dashboard() IS
  'MODIFIQUEI AQUI: resumo Indique e Ganhe (cliente não cambista).';

-- ---------------------------------------------------------------------------
-- 10) Painel cambista — sem campos de indicação irrelevantes
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
    'commission_percent', pr.commission_percent::double precision
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

-- ---------------------------------------------------------------------------
-- 11) RLS — referral_indication_rewards
-- ---------------------------------------------------------------------------
ALTER TABLE public.referral_indication_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins referral_indication_rewards all" ON public.referral_indication_rewards;

CREATE POLICY "Admins referral_indication_rewards all"
  ON public.referral_indication_rewards
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users view own referral indication rewards" ON public.referral_indication_rewards;

CREATE POLICY "Users view own referral indication rewards"
  ON public.referral_indication_rewards
  FOR SELECT
  TO authenticated
  USING (beneficiary_profile_id = auth.uid());

DROP POLICY IF EXISTS "Referrers view own paid attributions" ON public.referral_paid_attributions;

CREATE POLICY "Referrers view own paid attributions"
  ON public.referral_paid_attributions
  FOR SELECT
  TO authenticated
  USING (referrer_profile_id = auth.uid());
