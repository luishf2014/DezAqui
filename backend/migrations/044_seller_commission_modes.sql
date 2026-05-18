-- ============================================
-- Migração 044: Modos de comissão do cambista + vínculo persistente cliente↔cambista
-- MODIFIQUEI AQUI: first_purchase_only vs recurring_purchases; referred_by_seller_profile_id;
-- RPC de «claim» do código pendente; trigger de participação prioriza vínculo salvo no perfil.
-- ============================================

-- ---------------------------------------------------------------------------
-- 1) Colunas em profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_mode TEXT NOT NULL DEFAULT 'recurring_purchases'
    CHECK (commission_mode IN ('first_purchase_only', 'recurring_purchases'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_seller_profile_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_seller
  ON public.profiles (referred_by_seller_profile_id)
  WHERE referred_by_seller_profile_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.commission_mode IS
  'MODIFIQUEI AQUI: first_purchase_only = comissão só na 1ª venda paga do cliente indicado; recurring_purchases = todas as vendas pagas.';

COMMENT ON COLUMN public.profiles.referred_by_seller_profile_id IS
  'MODIFIQUEI AQUI: Cambista que trouxe o cliente (imutável para o próprio usuário após gravado via RPC oficial).';

-- ---------------------------------------------------------------------------
-- 2) Lock de colunas — commission_mode + vínculo cambista (com excepção RPC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_lock_restricted_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.is_admin := OLD.is_admin;
  NEW.is_active := OLD.is_active;
  NEW.referral_code := OLD.referral_code;
  NEW.is_seller := OLD.is_seller;
  NEW.commission_percent := OLD.commission_percent;
  NEW.commission_mode := OLD.commission_mode;
  NEW.referral_bonus_credits := OLD.referral_bonus_credits;
  NEW.referral_qualifying_sales_count := OLD.referral_qualifying_sales_count;
  NEW.referral_bonus_credits_used := OLD.referral_bonus_credits_used;

  -- MODIFIQUEI AQUI: só permite preencher referred_by_seller_profile_id uma vez, via RPC (session var)
  IF NOT (
    current_setting('app.rpc_claim_seller_referral', true) = '1'
    AND OLD.referred_by_seller_profile_id IS NULL
  ) THEN
    NEW.referred_by_seller_profile_id := OLD.referred_by_seller_profile_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) RPC — persistir vínculo a partir do código (só cambista is_seller)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_claim_pending_seller_referral(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  v_norm text;
  v_seller uuid;
  v_existing uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  SELECT referred_by_seller_profile_id INTO v_existing
  FROM public.profiles WHERE id = uid;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'already_bound', 'seller_profile_id', v_existing);
  END IF;

  v_norm := upper(trim(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')));
  IF v_norm IS NULL OR length(v_norm) = 0 THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'empty_code');
  END IF;

  SELECT pr.id INTO v_seller
  FROM public.profiles pr
  WHERE lower(trim(pr.referral_code)) = lower(trim(v_norm))
    AND COALESCE(pr.is_active, true)
    AND COALESCE(pr.is_seller, false)
  LIMIT 1;

  IF v_seller IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'not_seller_or_unknown');
  END IF;

  IF v_seller = uid THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'self_referral');
  END IF;

  PERFORM set_config('app.rpc_claim_seller_referral', '1', true);

  UPDATE public.profiles p
  SET referred_by_seller_profile_id = v_seller,
      updated_at = now()
  WHERE p.id = uid
    AND p.referred_by_seller_profile_id IS NULL;

  IF FOUND THEN
    RETURN jsonb_build_object('claimed', true, 'reason', 'ok', 'seller_profile_id', v_seller);
  END IF;

  RETURN jsonb_build_object('claimed', false, 'reason', 'already_bound');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_claim_pending_seller_referral(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_claim_pending_seller_referral(text) TO authenticated;

COMMENT ON FUNCTION public.rpc_claim_pending_seller_referral(text) IS
  'MODIFIQUEI AQUI: grava referred_by_seller_profile_id quando o código é de cambista activo (1× por cliente).';

-- ---------------------------------------------------------------------------
-- 4) Participações — vínculo salvo no perfil prevalece sobre ?ref= da sessão
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.participations_resolve_referrer_from_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref uuid;
  v_bind uuid;
BEGIN
  -- MODIFIQUEI AQUI: Webhook/service role (sem JWT) envia referred_by já resolvido
  IF auth.uid() IS NULL THEN
    IF COALESCE(NEW.is_bonus, false) THEN
      NEW.referred_by_profile_id := NULL;
      NEW.referrer_code_snapshot := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_bonus, false) THEN
    NEW.referred_by_profile_id := NULL;
    NEW.referrer_code_snapshot := NULL;
    RETURN NEW;
  END IF;

  NEW.referred_by_profile_id := NULL;

  -- MODIFIQUEI AQUI: vínculo persistente cliente ↔ cambista (não sobrescrever com outro ?ref=)
  SELECT p.referred_by_seller_profile_id INTO v_bind
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF v_bind IS NOT NULL AND v_bind <> NEW.user_id THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles sx
      WHERE sx.id = v_bind
        AND COALESCE(sx.is_seller, false)
        AND COALESCE(sx.is_active, true)
    ) THEN
      NEW.referred_by_profile_id := v_bind;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.referrer_code_snapshot IS NOT NULL AND length(trim(NEW.referrer_code_snapshot)) > 0 THEN
    SELECT pr.id INTO v_ref
    FROM public.profiles pr
    WHERE lower(trim(pr.referral_code)) = lower(trim(NEW.referrer_code_snapshot))
      AND COALESCE(pr.is_active, true)
    LIMIT 1;

    IF v_ref IS NOT NULL AND v_ref <> NEW.user_id THEN
      NEW.referred_by_profile_id := v_ref;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Efeitos pós-venda — comissão cambista com modo primeira compra vs recorrente
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
  skip_seller_commission boolean;
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
    SELECT pr.is_seller, pr.commission_percent, pr.commission_mode
    INTO ref_rec
    FROM public.profiles pr
    WHERE pr.id = part.referred_by_profile_id;

    IF FOUND AND COALESCE(ref_rec.is_seller, false) THEN
      -- MODIFIQUEI AQUI: Cambista — só comissão; percentual do bolão substitui o do perfil.
      SELECT COALESCE(c.seller_commission_percent_override, ref_rec.commission_percent, 0)
      INTO eff_pct
      FROM public.contests c
      WHERE c.id = part.contest_id;

      skip_seller_commission := false;

      -- MODIFIQUEI AQUI: primeira compra paga — bloqueia novas comissões do mesmo comprador para o mesmo cambista
      IF COALESCE(ref_rec.commission_mode, 'recurring_purchases') = 'first_purchase_only' THEN
        IF EXISTS (
          SELECT 1
          FROM public.seller_commissions sc2
          INNER JOIN public.participations pb ON pb.id = sc2.participation_id
          WHERE sc2.seller_user_id = part.referred_by_profile_id
            AND pb.user_id = part.user_id
            AND sc2.status IN ('pending', 'paid')
        ) THEN
          skip_seller_commission := true;
        END IF;
      END IF;

      IF NOT skip_seller_commission AND COALESCE(eff_pct, 0) > 0 THEN
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
    ELSIF FOUND THEN
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
-- 6) Painel cambista — modo + clientes distintos com venda paga via código
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

COMMENT ON FUNCTION public.rpc_get_seller_area_dashboard() IS
  'MODIFIQUEI AQUI: painel só-leitura do vendedor (modo comissão + clientes com venda paga).';
