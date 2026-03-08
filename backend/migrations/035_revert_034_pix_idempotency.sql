-- ============================================
-- Migração 035: Reverter alterações da 034 (idempotência Pix)
-- ============================================
-- Execute este SQL no Supabase para desfazer a migração 034.
-- O webhook foi revertido para a versão simples que não usa PROCESSING nem participation_id.

-- 1. Remover coluna participation_id (se existir)
ALTER TABLE public.pix_payment_intents DROP COLUMN IF EXISTS participation_id;

-- 2. Atualizar registros em PROCESSING para PENDING (antes de remover o valor do CHECK)
UPDATE public.pix_payment_intents SET status = 'PENDING' WHERE status = 'PROCESSING';

-- 3. Restaurar CHECK constraint do status (remover PROCESSING)
-- Remove a constraint de status e recria sem PROCESSING
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'pix_payment_intents'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.pix_payment_intents DROP CONSTRAINT %I', r.conname);
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN NULL; -- ignora se não existir
END $$;

-- Recria a constraint original (PENDING, PAID, EXPIRED, CANCELLED apenas)
ALTER TABLE public.pix_payment_intents
  ADD CONSTRAINT pix_payment_intents_status_check
  CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED'));
