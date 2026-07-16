-- ============================================
-- Migração 054 — bloquear participações fora do período «Aceitando Participações»
-- MODIFIQUEI AQUI: status active + start_date <= now <= end_date (exclui «Aguardando Resultado»).
-- ============================================

-- ---------------------------------------------------------------------------
-- 1) Helper reutilizável
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_accepts_participations(p_contest_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contests c
    WHERE c.id = p_contest_id
      AND c.status = 'active'
      AND now() >= c.start_date
      AND now() <= c.end_date
  );
$$;

COMMENT ON FUNCTION public.contest_accepts_participations(uuid) IS
  'MODIFIQUEI AQUI: true só enquanto o bolão aceita novas participações (antes de «Aguardando Resultado»).';

-- ---------------------------------------------------------------------------
-- 2) Trigger participations — última linha de defesa (admins e RPCs dedicadas isentos)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.participations_enforce_bonus_and_active_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.user_id AND COALESCE(p.is_active, true)
  ) THEN
    RAISE EXCEPTION 'Conta inativa: não é possível criar participação';
  END IF;

  IF COALESCE(NEW.is_bonus, false)
     AND NOT public.is_admin(auth.uid())
     AND COALESCE(current_setting('app.rpc_referral_redeem', true), '') <> '1'
     AND COALESCE(current_setting('app.rpc_admin_bonus', true), '') <> '1'
     AND COALESCE(current_setting('app.rpc_seller_bonus', true), '') <> '1'
  THEN
    RAISE EXCEPTION 'Participação bonificada só via administrador, cambista autorizado ou função dedicada';
  END IF;

  IF NOT (
    public.is_admin(auth.uid())
    OR COALESCE(current_setting('app.rpc_admin_bonus', true), '') = '1'
  ) THEN
    IF NOT public.contest_accepts_participations(NEW.contest_id) THEN
      RAISE EXCEPTION 'Este bolão não está aceitando participações no momento';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Resgate de jogo grátis — mesma regra de período
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

  IF NOT public.contest_accepts_participations(p_contest_id) THEN
    RAISE EXCEPTION 'Este bolão não está aceitando participações no momento';
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
  'MODIFIQUEI AQUI: consome crédito de indicação; exige bolão em período de inscrições abertas.';
