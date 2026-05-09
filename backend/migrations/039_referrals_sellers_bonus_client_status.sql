-- ============================================
-- Migração 039: Indicação, vendedores/comissão, bonificação, clientes inativos
-- ============================================
-- MODIFIQUEI AQUI: Bonificação (is_bonus), código de indicação, comissões de vendedor,
-- contagem 10 vendas indicadas pagas = 1 crédito de jogo grátis, perfil is_active / is_seller.

-- ---------------------------------------------------------------------------
-- 1) profiles: status, vendedor, código de indicação, créditos e contador
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_seller BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 5
    CHECK (commission_percent >= 0 AND commission_percent <= 100);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_bonus_credits INTEGER NOT NULL DEFAULT 0
    CHECK (referral_bonus_credits >= 0);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_qualifying_sales_count INTEGER NOT NULL DEFAULT 0
    CHECK (referral_qualifying_sales_count >= 0);

COMMENT ON COLUMN public.profiles.is_active IS 'MODIFIQUEI AQUI: Cliente ativo pode comprar; inativo preserva histórico.';
COMMENT ON COLUMN public.profiles.referral_code IS 'MODIFIQUEI AQUI: Código único de indicação (ref= na URL).';
COMMENT ON COLUMN public.profiles.is_seller IS 'MODIFIQUEI AQUI: Cambista/vendedor com comissão sobre vendas com seu código.';
COMMENT ON COLUMN public.profiles.commission_percent IS 'MODIFIQUEI AQUI: Percentual de comissão (padrão 5%) quando is_seller.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code_unique
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL;

-- Backfill referral_code antes de NOT NULL (id sem hífens: único por usuário)
UPDATE public.profiles p
SET referral_code = upper('DZ' || substring(replace(p.id::text, '-', '') from 1 for 12))
WHERE p.referral_code IS NULL OR length(trim(p.referral_code)) = 0;

ALTER TABLE public.profiles
  ALTER COLUMN referral_code SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) participações: bonificação, indicação, amount (valor travado se existia só no cliente)
-- ---------------------------------------------------------------------------
ALTER TABLE public.participations
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2);

ALTER TABLE public.participations
  ADD COLUMN IF NOT EXISTS is_bonus BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.participations
  ADD COLUMN IF NOT EXISTS bonus_reason TEXT;

ALTER TABLE public.participations
  ADD COLUMN IF NOT EXISTS bonus_origin_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.participations
  ADD COLUMN IF NOT EXISTS referred_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.participations
  ADD COLUMN IF NOT EXISTS referrer_code_snapshot TEXT;

COMMENT ON COLUMN public.participations.is_bonus IS 'MODIFIQUEI AQUI: Jogo bonificado não entra em arrecadação nem comissão.';
COMMENT ON COLUMN public.participations.bonus_origin_user_id IS 'MODIFIQUEI AQUI: Origem/registro administrativo opcional.';
COMMENT ON COLUMN public.participations.referred_by_profile_id IS 'MODIFIQUEI AQUI: Indicador/vendedor (resolvido a partir do código).';

CREATE INDEX IF NOT EXISTS idx_participations_referred_by
  ON public.participations (referred_by_profile_id)
  WHERE referred_by_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_participations_is_bonus
  ON public.participations (is_bonus);

-- ---------------------------------------------------------------------------
-- 3) pix_payment_intents: guardar código de indicação e perfil já resolvido (Edge Function)
-- ---------------------------------------------------------------------------
ALTER TABLE public.pix_payment_intents
  ADD COLUMN IF NOT EXISTS referrer_code_snapshot TEXT;

ALTER TABLE public.pix_payment_intents
  ADD COLUMN IF NOT EXISTS referred_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pix_payment_intents.referred_by_profile_id IS 'MODIFIQUEI AQUI: Indicador resolvido pela Edge ao criar o intent (não confiar só no cliente).';

-- ---------------------------------------------------------------------------
-- 4) payments: marca idempotência de efeitos pós-venda (indicação + comissão)
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS sale_side_effects_at TIMESTAMPTZ;

COMMENT ON COLUMN public.payments.sale_side_effects_at IS 'MODIFIQUEI AQUI: Quando foram aplicados attribution/comissão para este pagamento pago.';

-- ---------------------------------------------------------------------------
-- 5) Tabelas novas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_paid_attributions (
  participation_id UUID PRIMARY KEY REFERENCES public.participations(id) ON DELETE CASCADE,
  referrer_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_attr_referrer ON public.referral_paid_attributions(referrer_profile_id);

CREATE TABLE IF NOT EXISTS public.referral_bonus_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  milestone_total INTEGER NOT NULL CHECK (milestone_total > 0 AND milestone_total % 10 = 0),
  credits_granted INTEGER NOT NULL DEFAULT 1 CHECK (credits_granted > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (beneficiary_profile_id, milestone_total)
);

CREATE TABLE IF NOT EXISTS public.seller_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participation_id UUID NOT NULL REFERENCES public.participations(id) ON DELETE CASCADE,
  sale_value NUMERIC(12, 2) NOT NULL CHECK (sale_value >= 0),
  commission_percent NUMERIC(5, 2) NOT NULL CHECK (commission_percent >= 0 AND commission_percent <= 100),
  commission_value NUMERIC(12, 2) NOT NULL CHECK (commission_value >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participation_id)
);

CREATE INDEX IF NOT EXISTS idx_seller_commissions_seller ON public.seller_commissions(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_seller_commissions_status ON public.seller_commissions(status);

COMMENT ON TABLE public.referral_paid_attributions IS 'MODIFIQUEI AQUI: Cada bilhete pago/indicador contado uma vez.';
COMMENT ON TABLE public.referral_bonus_events IS 'MODIFIQUEI AQUI: Auditoria quando 10ª venda qualificável libera crédito.';
COMMENT ON TABLE public.seller_commissions IS 'MODIFIQUEI AQUI: Comissões de vendedor por participação paga confirmada.';

-- ---------------------------------------------------------------------------
-- 6) Atualiza handle_new_user (mantém cpf/birth_date e preenche referral_code / flags)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rc text;
BEGIN
  rc := upper('DZ' || substring(replace(NEW.id::text, '-', '') from 1 for 12));

  INSERT INTO public.profiles (
    id,
    email,
    name,
    phone,
    cpf,
    birth_date,
    is_admin,
    is_active,
    referral_code,
    is_seller,
    commission_percent,
    referral_bonus_credits,
    referral_qualifying_sales_count,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'email', ''),
      NEW.email
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    NEW.raw_user_meta_data->>'phone',
    NULLIF(NEW.raw_user_meta_data->>'cpf', ''),
    CASE
      WHEN (NEW.raw_user_meta_data->>'birth_date') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (NEW.raw_user_meta_data->>'birth_date')::date
      ELSE NULL
    END,
    FALSE,
    true,
    rc,
    false,
    5,
    0,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'MODIFIQUEI AQUI: Novo usuário ganha código de indicação e cliente ativo por padrão.';

-- ---------------------------------------------------------------------------
-- 7) Perfis — bloqueio de colunas restritas para não-admin + policy admin UPDATE
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
  NEW.referral_bonus_credits := OLD.referral_bonus_credits;
  NEW.referral_qualifying_sales_count := OLD.referral_qualifying_sales_count;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_lock_restricted_columns_trg ON public.profiles;

CREATE TRIGGER profiles_lock_restricted_columns_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_lock_restricted_columns();

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 8) Participações — usuário não pode declarar bonificada; conta ativa obrigatória
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.participations_enforce_bonus_and_active_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
  THEN
    RAISE EXCEPTION 'Participação bonificada só via administrador ou função dedicada';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS participations_enforce_bonus_and_active_user_trg ON public.participations;

CREATE TRIGGER participations_enforce_bonus_and_active_user_trg
  BEFORE INSERT ON public.participations
  FOR EACH ROW
  EXECUTE FUNCTION public.participations_enforce_bonus_and_active_user();

CREATE OR REPLACE FUNCTION public.participations_resolve_referrer_from_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref uuid;
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

DROP TRIGGER IF EXISTS participations_resolve_referrer_trg ON public.participations;

CREATE TRIGGER participations_resolve_referrer_trg
  BEFORE INSERT ON public.participations
  FOR EACH ROW
  EXECUTE FUNCTION public.participations_resolve_referrer_from_snapshot();

DROP POLICY IF EXISTS "Users can insert own participations" ON public.participations;

CREATE POLICY "Users can insert own participations"
  ON public.participations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND COALESCE(is_bonus, false) = false
  );

-- ---------------------------------------------------------------------------
-- 9) Pagamentos — sem valor em participação bonificada
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payments_block_for_bonus_participation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b boolean;
BEGIN
  IF NEW.participation_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.is_bonus, false) INTO b
  FROM public.participations p
  WHERE p.id = NEW.participation_id;

  IF COALESCE(b, false) AND COALESCE(NEW.amount, 0) > 0 THEN
    RAISE EXCEPTION 'Participação bonificada não aceita pagamento com valor';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_block_bonus_trg ON public.payments;

CREATE TRIGGER payments_block_bonus_trg
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_block_for_bonus_participation();

-- ---------------------------------------------------------------------------
-- 10) Efeitos pós-venda (idempotente)
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
  ins_attr int;
  new_count int;
  pct numeric;
  comm numeric;
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

  -- Indicação: uma vez por bilhete
  IF part.referred_by_profile_id IS NOT NULL
     AND part.referred_by_profile_id <> part.user_id THEN
    INSERT INTO public.referral_paid_attributions (participation_id, referrer_profile_id)
    VALUES (part.id, part.referred_by_profile_id)
    ON CONFLICT (participation_id) DO NOTHING;

    GET DIAGNOSTICS ins_attr = ROW_COUNT;

    IF ins_attr > 0 THEN
      UPDATE public.profiles
      SET referral_qualifying_sales_count = referral_qualifying_sales_count + 1
      WHERE id = part.referred_by_profile_id
      RETURNING referral_qualifying_sales_count INTO new_count;

      IF new_count IS NOT NULL AND new_count % 10 = 0 THEN
        UPDATE public.profiles
        SET referral_bonus_credits = referral_bonus_credits + 1
        WHERE id = part.referred_by_profile_id;

        INSERT INTO public.referral_bonus_events (beneficiary_profile_id, milestone_total, credits_granted)
        VALUES (part.referred_by_profile_id, new_count, 1)
        ON CONFLICT (beneficiary_profile_id, milestone_total) DO NOTHING;
      END IF;
    END IF;
  END IF;

  -- Comissão (somente se indicador é vendedor)
  IF part.referred_by_profile_id IS NOT NULL THEN
    SELECT pr.is_seller, pr.commission_percent
    INTO ref_rec
    FROM public.profiles pr
    WHERE pr.id = part.referred_by_profile_id;

    IF FOUND AND ref_rec.is_seller AND COALESCE(ref_rec.commission_percent, 0) > 0 THEN
      pct := LEAST(ref_rec.commission_percent, 100::numeric);
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
  END IF;

  UPDATE public.payments
  SET sale_side_effects_at = now()
  WHERE id = p_payment_id AND sale_side_effects_at IS NULL;

END;
$$;

CREATE OR REPLACE FUNCTION public.revert_paid_sale_payment_effects_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  UPDATE public.seller_commissions
  SET status = 'canceled'
  WHERE participation_id = OLD.participation_id AND status = 'pending';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_revert_effects_trg ON public.payments;

CREATE TRIGGER payments_revert_effects_trg
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.revert_paid_sale_payment_effects_row();

CREATE OR REPLACE FUNCTION public.trg_payments_call_apply_sale_effects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND NEW.participation_id IS NOT NULL THEN
    IF TG_OP = 'INSERT'
       OR OLD.participation_id IS DISTINCT FROM NEW.participation_id
       OR OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.apply_paid_sale_effects(NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_call_apply_sale_effects_trg ON public.payments;

CREATE TRIGGER payments_call_apply_sale_effects_trg
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_payments_call_apply_sale_effects();

-- ---------------------------------------------------------------------------
-- 11) Comissões canceladas se participação cancelada
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.participations_cancel_commissions_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  UPDATE public.seller_commissions
  SET status = 'canceled'
  WHERE participation_id = NEW.id AND status = 'pending';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS participations_cancel_commissions_trg ON public.participations;

CREATE TRIGGER participations_cancel_commissions_trg
  AFTER UPDATE ON public.participations
  FOR EACH ROW
  EXECUTE FUNCTION public.participations_cancel_commissions_fn();

-- ---------------------------------------------------------------------------
-- 12) RPC — resgatar 1 crédito de indicação (inserção bonificada, bypass policy)
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

  -- MODIFIQUEI AQUI: permite is_bonus na trigger de validação (SECURITY DEFINER não bypassa triggers)
  PERFORM set_config('app.rpc_referral_redeem', '1', true);

  PERFORM 1 FROM public.profiles p
  WHERE p.id = uid AND COALESCE(p.is_active, true) AND COALESCE(p.referral_bonus_credits, 0) > 0
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

  UPDATE public.profiles
  SET referral_bonus_credits = referral_bonus_credits - 1
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
    'referral_credit_10_paid_sales',
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_redeem_referral_free_credit(uuid, integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_redeem_referral_free_credit(uuid, integer[]) TO authenticated;

COMMENT ON FUNCTION public.rpc_redeem_referral_free_credit(uuid, integer[]) IS
  'MODIFIQUEI AQUI: Consome 1 crédito e cria participação bonificada ativa sem pagamento.';

-- ---------------------------------------------------------------------------
-- 13) RPC — admin criar bonificação manual / aprovada
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_admin_create_bonus_participation(
  p_user_id uuid,
  p_contest_id uuid,
  p_numbers integer[],
  p_reason text,
  p_bonus_origin_user_id uuid DEFAULT NULL
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
BEGIN
  IF uid IS NULL OR NOT public.is_admin(uid) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  PERFORM set_config('app.rpc_admin_bonus', '1', true);

  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_user_id AND COALESCE(pr.is_active, true)) THEN
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
    p_reason,
    p_bonus_origin_user_id,
    NULL,
    NULL
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_create_bonus_participation(uuid, uuid, integer[], text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_admin_create_bonus_participation(uuid, uuid, integer[], text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 14) Arrecadação pública — excluir bilhetes bonificados mesmo com pagamentos antigos/errôneos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sum_bolao_collected_public(p_contest_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(x.amount), 0)::numeric
  FROM (
    SELECT DISTINCT ON (pay.participation_id)
      pay.amount::numeric AS amount
    FROM public.payments pay
    INNER JOIN public.participations part ON part.id = pay.participation_id
    WHERE part.contest_id = p_contest_id
      AND part.status = 'active'
      AND COALESCE(part.is_bonus, false) = false
      AND pay.status = 'paid'
      AND EXISTS (
        SELECT 1
        FROM public.contests cc
        WHERE cc.id = part.contest_id
          AND cc.status IN ('active', 'finished')
      )
    ORDER BY pay.participation_id, pay.created_at DESC
  ) x;
$$;

-- ---------------------------------------------------------------------------
-- 15) RLS novas tabelas
-- ---------------------------------------------------------------------------
ALTER TABLE public.referral_paid_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_bonus_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins referral_paid attributions select" ON public.referral_paid_attributions;

CREATE POLICY "Admins referral_paid attributions select"
  ON public.referral_paid_attributions
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins referral_bonus_events select" ON public.referral_bonus_events;

CREATE POLICY "Admins referral_bonus_events select"
  ON public.referral_bonus_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins seller_commissions all" ON public.seller_commissions;

CREATE POLICY "Admins seller_commissions all"
  ON public.seller_commissions
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Sellers view own commissions" ON public.seller_commissions;

CREATE POLICY "Sellers view own commissions"
  ON public.seller_commissions
  FOR SELECT
  TO authenticated
  USING (seller_user_id = auth.uid());
