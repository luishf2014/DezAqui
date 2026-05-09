-- ============================================
-- Migração 042 — bilhete bonificado ADM (correções)
--
-- 1) Remove assinatura antiga da RPC (5 args). A 042 usava igualdade a
--    pg_get_function_identity_arguments(...) que pode não bater ao caractér
--    (variantes PostgreSQL/supabase-postgres), ficando DUAS sobrecargas —
--    PostgREST falha ou escolhe a função errada.
-- 2) Trigger participations_enforce_bonus_and_active_user: SECURITY INVOKER
--    explicitamente para auth.uid()/is_admin() verem o JWT do pedido —
--    SECURITY DEFINER neste trigger fazia tratamento como "não-admin" quando
--    o GUC da RPC não entrava neste mesmo contexto, bloqueando o INSERT bonificado.
-- ============================================

-- Sobrecarga legada sem p_consume_referral_credit (idempotente)
DROP FUNCTION IF EXISTS public.rpc_admin_create_bonus_participation(uuid, uuid, integer[], text, uuid);

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
  THEN
    RAISE EXCEPTION 'Participação bonificada só via administrador ou função dedicada';
  END IF;

  RETURN NEW;
END;
$$;
