-- ============================================
-- Migração 040: Créditos de bonificação usados + RPC admin consumir crédito
-- MODIFIQUEI AQUI — contador de créditos debitados por participação bonificada;
-- permite ADM usar crédito do usuário com auditoria; lock em profiles.
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_bonus_credits_used INTEGER NOT NULL DEFAULT 0
    CHECK (referral_bonus_credits_used >= 0);

COMMENT ON COLUMN public.profiles.referral_bonus_credits_used IS 'MODIFIQUEI AQUI: Quantidade total de bilhetes grátis consumidos pelo usuário (redeems + ADM com consumo).';

-- Backfill a partir de bilhetes bonificados existentes pelo fluxo da indicação / ADM
UPDATE public.profiles p
SET referral_bonus_credits_used = COALESCE(up.cnt, 0)
FROM (
  SELECT
    user_id AS uid,
    COUNT(*)::int AS cnt
  FROM public.participations pt
  WHERE COALESCE(pt.is_bonus, FALSE)
    AND (
      pt.bonus_reason IS NOT DISTINCT FROM 'referral_credit_10_paid_sales'
      OR COALESCE(trim(pt.bonus_reason), '') ILIKE '%consumo_credito_indicacao%'
    )
  GROUP BY user_id
) up
WHERE p.id = up.uid;

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
  NEW.referral_bonus_credits := OLD.referral_bonus_credits;
  NEW.referral_qualifying_sales_count := OLD.referral_qualifying_sales_count;
  -- MODIFIQUEI AQUI: usuário não altera uso de créditos manualmente
  NEW.referral_bonus_credits_used := OLD.referral_bonus_credits_used;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- rpc_redeem: incrementar créditos usados
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
  WHERE p.id = uid AND COALESCE(p.is_active, TRUE) AND COALESCE(p.referral_bonus_credits, 0) > 0
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sem crédito de indicação ou conta inativa';
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

  -- MODIFIQUEI AQUI: debita disponível + incrementa uso
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
    TRUE,
    'referral_credit_10_paid_sales',
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- rpc_admin_create_bonus_participation: opcional consumo de crédito de indicação
-- MODIFIQUEI AQUI — remove assinatura antiga (5 args) para evitar sobrecarga duplicada no PostgREST
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_admin_create_bonus_participation(uuid, uuid, integer[], text, uuid);

CREATE OR REPLACE FUNCTION public.rpc_admin_create_bonus_participation(
  p_user_id uuid,
  p_contest_id uuid,
  p_numbers integer[],
  p_reason text,
  p_bonus_origin_user_id uuid DEFAULT NULL,
  p_consume_referral_credit boolean DEFAULT FALSE
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
BEGIN
  IF uid IS NULL OR NOT public.is_admin(uid) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  PERFORM set_config('app.rpc_admin_bonus', '1', TRUE);

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr WHERE pr.id = p_user_id AND COALESCE(pr.is_active, TRUE)
  ) THEN
    RAISE EXCEPTION 'Cliente inexistente ou inativo';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.contests ct WHERE ct.id = p_contest_id AND ct.status = 'active') THEN
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

  IF COALESCE(p_consume_referral_credit, FALSE) THEN
    PERFORM 1 FROM public.profiles pu
    WHERE pu.id = p_user_id AND COALESCE(pu.referral_bonus_credits, 0) > 0
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente sem crédito de bonificação disponível';
    END IF;

    UPDATE public.profiles
    SET
      referral_bonus_credits = referral_bonus_credits - 1,
      referral_bonus_credits_used = referral_bonus_credits_used + 1
    WHERE id = p_user_id;

    audit_reason := audit_reason || ' | consumo_credito_indicacao';
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
    p_user_id,
    p_numbers,
    'active',
    0,
    ticket_code,
    NULL,
    TRUE,
    audit_reason,
    p_bonus_origin_user_id,
    NULL,
    NULL
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_create_bonus_participation(uuid, uuid, integer[], text, uuid, boolean)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_admin_create_bonus_participation(uuid, uuid, integer[], text, uuid, boolean)
  TO authenticated;
