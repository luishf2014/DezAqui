-- ============================================
-- Migração 033: RLS - Permitir usuário ver payments via intent (Pix)
-- ============================================
--
-- Problema: No fluxo Pix, o pagamento é criado com participation_id=null.
-- O webhook preenche participation_id após confirmar. A política existente
-- só permite SELECT quando participation_id está definido. Com isso, o
-- frontend não conseguia ver o status do pagamento Pix para exibir a
-- confirmação de sucesso (checkPixPaymentStatus retornava vazio).
--
-- Solução: Nova política que permite SELECT em payments quando o pagamento
-- tem intent_id e o pix_payment_intent pertence ao usuário autenticado.
-- Assim o usuário pode ver o payment (e o status 'paid' após o webhook)
-- para exibir o card de sucesso do Pix.
--
-- ============================================

DROP POLICY IF EXISTS "Users can view own payments via intent" ON public.payments;

CREATE POLICY "Users can view own payments via intent"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    intent_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.pix_payment_intents
      WHERE pix_payment_intents.id = payments.intent_id
        AND pix_payment_intents.user_id = auth.uid()
    )
  );
