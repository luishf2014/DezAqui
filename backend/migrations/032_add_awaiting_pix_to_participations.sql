-- ============================================
-- Migração 032: awaiting_pix em participations
-- ============================================
-- Quando true: participação criada para Pix cart, não deve aparecer em Meus Tickets até o webhook ativar
-- Quando false/null: participação para dinheiro, aparece em Meus Tickets mesmo pendente
--

ALTER TABLE public.participations ADD COLUMN IF NOT EXISTS awaiting_pix BOOLEAN DEFAULT false;
COMMENT ON COLUMN public.participations.awaiting_pix IS 'Se true, participação aguardando confirmação Pix - não exibir em Meus Tickets até ativada';
