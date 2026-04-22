-- ============================================
-- Migração 019: Tabela de prêmios por participação (draw payouts)
-- FASE 4: Sorteios e Rateio
-- ============================================
--
-- Esta migração cria uma tabela para armazenar prêmios calculados
-- por participação em cada sorteio, permitindo que usuários vejam
-- automaticamente se ganharam e quanto ganharam.
--
-- MODIFIQUEI AQUI - Versão "à prova de erro":
-- - Garante pgcrypto (gen_random_uuid)
-- - user_id referencia auth.users(id) (RLS correto com auth.uid())
-- - Policies e índices idempotentes
-- ============================================

-- MODIFIQUEI AQUI - Garante extensão para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.draw_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  draw_id UUID NOT NULL REFERENCES public.draws(id) ON DELETE CASCADE,
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  participation_id UUID NOT NULL REFERENCES public.participations(id) ON DELETE CASCADE,

  -- MODIFIQUEI AQUI - user_id deve ser o auth.users.id para RLS funcionar corretamente
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Categoria de premiação
  category TEXT NOT NULL CHECK (category IN ('TOP', 'SECOND', 'LOWEST', 'NONE')),

  -- Pontuação da participação neste sorteio
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),

  -- Valor ganho (0 se não premiado)
  amount_won NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_won >= 0),

  -- Metadados
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint: uma participação só pode ter um payout por draw
  CONSTRAINT draw_payouts_unique_draw_participation UNIQUE (draw_id, participation_id)
);

-- Índices para consultas rápidas (idempotentes)
CREATE INDEX IF NOT EXISTS idx_draw_payouts_draw_id ON public.draw_payouts(draw_id);
CREATE INDEX IF NOT EXISTS idx_draw_payouts_contest_id ON public.draw_payouts(contest_id);
CREATE INDEX IF NOT EXISTS idx_draw_payouts_participation_id ON public.draw_payouts(participation_id);
CREATE INDEX IF NOT EXISTS idx_draw_payouts_user_id ON public.draw_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_draw_payouts_category ON public.draw_payouts(category);

-- Índice parcial para premiados
CREATE INDEX IF NOT EXISTS idx_draw_payouts_amount_won_desc
  ON public.draw_payouts(amount_won DESC)
  WHERE amount_won > 0;

COMMENT ON TABLE public.draw_payouts IS
  'Prêmios calculados por participação em cada sorteio. Permite que usuários vejam automaticamente se ganharam e quanto ganharam.';

-- RLS
ALTER TABLE public.draw_payouts ENABLE ROW LEVEL SECURITY;

-- MODIFIQUEI AQUI - Deixa policies idempotentes (evita erro ao reexecutar migração)
DROP POLICY IF EXISTS "Users can view their own payouts" ON public.draw_payouts;
DROP POLICY IF EXISTS "Admins can view all payouts" ON public.draw_payouts;
DROP POLICY IF EXISTS "Admins can insert payouts" ON public.draw_payouts;
DROP POLICY IF EXISTS "Admins can update payouts" ON public.draw_payouts;
DROP POLICY IF EXISTS "Admins can delete payouts" ON public.draw_payouts;

-- Usuário vê apenas seus próprios payouts
CREATE POLICY "Users can view their own payouts"
  ON public.draw_payouts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admin vê todos
CREATE POLICY "Admins can view all payouts"
  ON public.draw_payouts
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Apenas admin pode inserir/atualizar/deletar
CREATE POLICY "Admins can insert payouts"
  ON public.draw_payouts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update payouts"
  ON public.draw_payouts
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete payouts"
  ON public.draw_payouts
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
