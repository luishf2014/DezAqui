-- ============================================
-- Migração 050 — vendas e listagem de clientes pelo administrador (sem comissão)
-- Nova venda / novo cliente na área admin — sem vínculo cambista nem referrer
-- ============================================

CREATE OR REPLACE FUNCTION public.rpc_admin_list_clients()
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

  IF NOT public.is_admin(uid) THEN
    RAISE EXCEPTION 'Acesso restrito: apenas administradores';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', cp.id,
        'name', cp.name,
        'email', cp.email,
        'phone', cp.phone,
        'cpf', cp.cpf
      )
      ORDER BY cp.name NULLS LAST, cp.email
    )
    FROM public.profiles cp
    WHERE cp.id <> uid
      AND COALESCE(cp.is_active, true)
      AND NOT COALESCE(cp.is_seller, false)
      AND NOT COALESCE(cp.is_admin, false)
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_list_clients() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_admin_list_clients() TO authenticated;

COMMENT ON FUNCTION public.rpc_admin_list_clients() IS
  'Admin lista clientes activos (não cambista, não admin) para nova venda / seleção.';

CREATE OR REPLACE FUNCTION public.rpc_admin_create_cash_sale(
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
  sale_val numeric;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  IF NOT public.is_admin(uid) THEN
    RAISE EXCEPTION 'Acesso restrito: apenas administradores';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles cp
    WHERE cp.id = p_user_id
      AND COALESCE(cp.is_active, true)
      AND NOT COALESCE(cp.is_seller, false)
      AND NOT COALESCE(cp.is_admin, false)
  ) THEN
    RAISE EXCEPTION 'Cliente inexistente ou inactivo';
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
    NULL,
    NULL
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object(
    'participation_id', new_id,
    'ticket_code', ticket_code,
    'amount', sale_val::double precision
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_create_cash_sale(uuid, uuid, integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_admin_create_cash_sale(uuid, uuid, integer[]) TO authenticated;

COMMENT ON FUNCTION public.rpc_admin_create_cash_sale(uuid, uuid, integer[]) IS
  'Admin regista venda em dinheiro para cliente: participação pending, sem comissão cambista.';
