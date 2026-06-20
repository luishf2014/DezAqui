-- Cancelar Pix pendente (cliente ou cambista que gerou a venda)

CREATE OR REPLACE FUNCTION public.rpc_cancel_pending_pix_payment(p_external_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  ext_id text;
  intent_rec RECORD;
  pay_count int := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  ext_id := NULLIF(trim(p_external_id), '');
  IF ext_id IS NULL THEN
    RAISE EXCEPTION 'ID do pagamento inválido';
  END IF;

  SELECT pi.id, pi.user_id, pi.status, pi.referred_by_profile_id
  INTO intent_rec
  FROM public.payments pym
  INNER JOIN public.pix_payment_intents pi ON pi.id = pym.intent_id
  WHERE pym.external_id = ext_id
    AND pym.status = 'pending'
    AND pym.payment_method = 'pix'
  ORDER BY pym.created_at DESC
  LIMIT 1;

  IF intent_rec.id IS NULL THEN
    RETURN jsonb_build_object('cancelled', false, 'reason', 'not_found_or_already_final');
  END IF;

  IF intent_rec.status NOT IN ('PENDING') THEN
    RETURN jsonb_build_object('cancelled', false, 'reason', 'intent_not_pending');
  END IF;

  IF NOT (
    public.is_admin(uid)
    OR intent_rec.user_id = uid
    OR (
      intent_rec.referred_by_profile_id = uid
      AND EXISTS (
        SELECT 1 FROM public.profiles sp
        WHERE sp.id = uid
          AND COALESCE(sp.is_seller, false)
          AND COALESCE(sp.is_active, true)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar este Pix';
  END IF;

  UPDATE public.pix_payment_intents
  SET status = 'CANCELLED',
      updated_at = now()
  WHERE id = intent_rec.id
    AND status = 'PENDING';

  UPDATE public.payments
  SET status = 'cancelled',
      updated_at = now()
  WHERE external_id = ext_id
    AND status = 'pending'
    AND payment_method = 'pix';

  GET DIAGNOSTICS pay_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'cancelled', true,
    'payments_updated', pay_count,
    'intent_id', intent_rec.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cancel_pending_pix_payment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_pending_pix_payment(text) TO authenticated;

COMMENT ON FUNCTION public.rpc_cancel_pending_pix_payment(text) IS
  'Cancela Pix pendente (intent + payment). Cliente, cambista da venda ou admin.';
