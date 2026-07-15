-- ============================================
-- Migração 051 — créditos de indicação: só ADM cria bonificação livre
-- MODIFIQUEI AQUI: cambista não cria bilhete bonificado; resgate exige débito atómico.
-- ============================================

-- ---------------------------------------------------------------------------
-- 1) Cambista: bilhete bonificado desativado (apenas vendas pagas)
-- ---------------------------------------------------------------------------
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
BEGIN
  RAISE EXCEPTION 'Cambistas não podem criar bilhetes bonificados. Use vendas pagas ou peça ao cliente que resgate o crédito em Indique e Ganhe.';
END;
$$;

COMMENT ON FUNCTION public.rpc_seller_create_bonus_participation(uuid, uuid, integer[], text) IS
  'MODIFIQUEI AQUI: desativado — só o ADM pode criar bonificação institucional; cliente resgata crédito via rpc_redeem_referral_free_credit.';

-- ---------------------------------------------------------------------------
-- 2) Resgate pelo cliente: débito atómico (evita saldo negativo / duplo clique)
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

  PERFORM 1
  FROM public.profiles p
  WHERE p.id = uid
    AND COALESCE(p.is_active, true)
    AND NOT COALESCE(p.is_seller, false)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta inativa ou perfil de vendedor não usa este fluxo';
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sem crédito de indicação disponível';
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
  'MODIFIQUEI AQUI: consome 1 referral_bonus_credit e cria participação bonificada ativa (cliente não cambista).';
