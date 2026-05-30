-- ============================================
-- Migração 045 — participação bonificada pelo cambista
-- MODIFIQUEI AQUI: RPC dedicada (is_seller) + lista de clientes vinculados
-- ============================================

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

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Clientes elegíveis para bonificação pelo cambista autenticado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_seller_list_bonus_clients()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles px
    WHERE px.id = uid
      AND COALESCE(px.is_seller, false)
      AND COALESCE(px.is_active, true)
  ) THEN
    RAISE EXCEPTION 'Acesso restrito: apenas cambistas autorizados';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'name', q.name,
        'email', q.email,
        'referral_bonus_credits', COALESCE(q.referral_bonus_credits, 0),
        'referral_bonus_credits_used', COALESCE(q.referral_bonus_credits_used, 0)
      )
      ORDER BY q.name NULLS LAST, q.email
    )
    FROM (
      SELECT DISTINCT ON (cp.id)
        cp.id,
        cp.name,
        cp.email,
        cp.referral_bonus_credits,
        cp.referral_bonus_credits_used
      FROM public.profiles cp
      WHERE cp.id <> uid
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
      ORDER BY cp.id, cp.name NULLS LAST, cp.email
    ) q
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_seller_list_bonus_clients() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_seller_list_bonus_clients() TO authenticated;

COMMENT ON FUNCTION public.rpc_seller_list_bonus_clients() IS
  'MODIFIQUEI AQUI: clientes vinculados ao cambista (código ou compra anterior) para bonificação.';

-- ---------------------------------------------------------------------------
-- Criar bilhete bonificado (cambista)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_seller_create_bonus_participation(
  p_user_id uuid,
  p_contest_id uuid,
  p_numbers integer[],
  p_reason text,
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

  IF COALESCE(p_consume_referral_credit, false) THEN
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
    NULL,
    NULL
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_seller_create_bonus_participation(uuid, uuid, integer[], text, boolean)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_seller_create_bonus_participation(uuid, uuid, integer[], text, boolean)
  TO authenticated;

COMMENT ON FUNCTION public.rpc_seller_create_bonus_participation(uuid, uuid, integer[], text, boolean) IS
  'MODIFIQUEI AQUI: bilhete R$ 0 pelo cambista (sem comissão; cliente vinculado).';
