-- ============================================
-- Migração 034: Prêmio adicional fixo opcional no concurso
-- MODIFIQUEI AQUI
-- ============================================
--
-- Quando has_extra_prize = true, o pool usado nos percentuais de premiação passa a ser:
--   (arrecadação de pagamentos) + extra_prize_amount
-- Quando false, comportamento idêntico ao anterior (apenas arrecadação).
-- ============================================

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS has_extra_prize BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_prize_amount DECIMAL(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.contests.has_extra_prize IS 'MODIFIQUEI AQUI: Se true, soma extra_prize_amount ao pool base dos % de premiação.';
COMMENT ON COLUMN public.contests.extra_prize_amount IS 'MODIFIQUEI AQUI: Valor fixo adicional ao pool; só entra no cálculo se has_extra_prize.';

ALTER TABLE public.contests
  ADD CONSTRAINT check_extra_prize_amount_non_negative
  CHECK (extra_prize_amount >= 0);
