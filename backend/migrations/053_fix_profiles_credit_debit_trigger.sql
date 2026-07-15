-- ============================================
-- Migração 053 — corrigir débito de créditos no resgate (trigger revertia o UPDATE)
-- MODIFIQUEI AQUI: profiles_lock_restricted_columns bloqueava referral_bonus_credits
-- mesmo quando rpc_redeem_referral_free_credit tentava debitar (bilhetes infinitos).
-- ============================================

-- ---------------------------------------------------------------------------
-- 1) Trigger — permitir alteração de créditos só via RPCs dedicadas
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
  NEW.referral_qualifying_sales_count := OLD.referral_qualifying_sales_count;

  -- MODIFIQUEI AQUI: resgate de crédito (cliente) ou concessão pós-meta (apply_paid_sale_effects)
  IF current_setting('app.rpc_referral_redeem', true) <> '1'
     AND current_setting('app.referral_grant_credit', true) <> '1' THEN
    NEW.referral_bonus_credits := OLD.referral_bonus_credits;
  END IF;

  IF current_setting('app.rpc_referral_redeem', true) <> '1' THEN
    NEW.referral_bonus_credits_used := OLD.referral_bonus_credits_used;
  END IF;

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
-- 2) Concessão de crédito ao bater meta — sinalizar no trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_paid_sale_effects(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
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
                PERFORM set_config('app.referral_grant_credit', '1', true);
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
-- 3) Resgate — verificar que o débito realmente ocorreu antes do INSERT
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
  credits_before int;
  credits_after int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  PERFORM set_config('app.rpc_referral_redeem', '1', true);

  SELECT COALESCE(p.referral_bonus_credits, 0)
  INTO credits_before
  FROM public.profiles p
  WHERE p.id = uid
    AND COALESCE(p.is_active, true)
    AND NOT COALESCE(p.is_seller, false)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta inativa ou perfil de vendedor não usa este fluxo';
  END IF;

  IF credits_before < 1 THEN
    RAISE EXCEPTION 'Sem crédito de indicação disponível';
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
  WHERE id = uid
    AND COALESCE(referral_bonus_credits, 0) > 0;

  SELECT COALESCE(referral_bonus_credits, 0)
  INTO credits_after
  FROM public.profiles
  WHERE id = uid;

  IF credits_after >= credits_before THEN
    RAISE EXCEPTION 'Falha ao debitar crédito de indicação — tente novamente';
  END IF;

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

COMMENT ON FUNCTION public.rpc_redeem_referral_free_credit(uuid, integer[]) IS
  'MODIFIQUEI AQUI: consome 1 referral_bonus_credit (com verificação pós-débito) e cria bilhete bonificado.';
