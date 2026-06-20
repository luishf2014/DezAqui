-- ============================================
-- Migração 048 — venda paga pelo cambista (dinheiro pendente + dados cliente p/ Pix)
-- Cash: participação pending → admin valida em AdminActivations → comissão via trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.rpc_seller_create_cash_sale(
  p_user_id uuid,
  p_contest_id uuid,
  p_numbers integer[]
)
RETURNS jsonb
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
  ct_rec RECORD;
  seller_ref text;
  sale_val numeric;
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

  SELECT
    c.participation_value,
    c.numbers_per_participation,
    c.min_number,
    c.max_number,
    c.start_date,
    c.end_date
  INTO ct_rec
  FROM public.contests c
  WHERE c.id = p_contest_id AND c.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bolão indisponível ou inactivo';
  END IF;

  IF now() < ct_rec.start_date THEN
    RAISE EXCEPTION 'Este bolão ainda não começou';
  END IF;

  IF now() > ct_rec.end_date THEN
    RAISE EXCEPTION 'Prazo de participação encerrado';
  END IF;

  IF cardinality(p_numbers) <> ct_rec.numbers_per_participation THEN
    RAISE EXCEPTION 'Quantidade de números inválida para este bolão';
  END IF;

  PERFORM 1
  FROM unnest(p_numbers) AS x(n)
  WHERE NOT (x.n BETWEEN ct_rec.min_number AND ct_rec.max_number);
  IF FOUND THEN
    RAISE EXCEPTION 'Número fora do intervalo permitido';
  END IF;

  sale_val := COALESCE(ct_rec.participation_value, 0)::numeric;
  IF sale_val <= 0 THEN
    RAISE EXCEPTION 'Valor do bolão inválido';
  END IF;

  SELECT NULLIF(trim(pr.referral_code), '')
  INTO seller_ref
  FROM public.profiles pr
  WHERE pr.id = uid;

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
    referred_by_profile_id,
    referrer_code_snapshot
  )
  VALUES (
    p_contest_id,
    p_user_id,
    p_numbers,
    'pending',
    0,
    ticket_code,
    sale_val,
    false,
    uid,
    seller_ref
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object(
    'participation_id', new_id,
    'ticket_code', ticket_code,
    'amount', sale_val::double precision
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_seller_create_cash_sale(uuid, uuid, integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_seller_create_cash_sale(uuid, uuid, integer[]) TO authenticated;

COMMENT ON FUNCTION public.rpc_seller_create_cash_sale(uuid, uuid, integer[]) IS
  'Cambista regista venda em dinheiro: participação pending aguarda validação ADM; comissão após pagamento cash.';

-- Incluir CPF/telefone na lista de clientes (Pix pelo cambista)
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
        'phone', q.phone,
        'cpf', q.cpf,
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
        cp.phone,
        cp.cpf,
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
      ORDER BY cp.id, cp.name NULLS LAST
    ) q
  ), '[]'::jsonb);
END;
$$;
