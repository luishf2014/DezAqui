-- ============================================
-- Migração 047: vínculo cliente↔cambista na criação de conta pelo cambista
-- Chamada pela Edge Function seller-create-client (service_role).
-- ============================================

CREATE OR REPLACE FUNCTION public.rpc_internal_bind_client_to_seller(
  p_seller_id uuid,
  p_client_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF p_seller_id IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'Parâmetros inválidos';
  END IF;

  IF p_seller_id = p_client_id THEN
    RAISE EXCEPTION 'Cambista não pode vincular a si mesmo';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = p_seller_id
      AND COALESCE(pr.is_seller, false)
      AND COALESCE(pr.is_active, true)
  ) THEN
    RAISE EXCEPTION 'Cambista inválido ou inactivo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_client_id
  ) THEN
    RAISE EXCEPTION 'Perfil do cliente ainda não existe';
  END IF;

  PERFORM set_config('app.rpc_claim_seller_referral', '1', true);

  UPDATE public.profiles p
  SET referred_by_seller_profile_id = p_seller_id,
      updated_at = now()
  WHERE p.id = p_client_id
    AND p.referred_by_seller_profile_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('bound', false, 'reason', 'already_bound');
  END IF;

  RETURN jsonb_build_object('bound', true, 'reason', 'ok', 'seller_profile_id', p_seller_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_internal_bind_client_to_seller(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_internal_bind_client_to_seller(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.rpc_internal_bind_client_to_seller(uuid, uuid) IS
  'Vincula novo cliente ao cambista (Edge Function seller-create-client; só service_role).';
