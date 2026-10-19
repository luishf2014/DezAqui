-- ============================================
-- Migracao 056 - permitir correcao e exclusao de sorteios por administradores
-- ============================================
-- A migration 005 tornou sorteios imutaveis. A gestao administrativa agora
-- precisa corrigir lancamentos e remover duplicatas, sem ampliar o acesso de
-- usuarios comuns.

BEGIN;

ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can update draws" ON public.draws;
CREATE POLICY "Admins can update draws"
  ON public.draws
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete draws" ON public.draws;
CREATE POLICY "Admins can delete draws"
  ON public.draws
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

COMMENT ON POLICY "Admins can update draws" ON public.draws IS
  'Permite que administradores corrijam numeros, data e quantidade de numeros de um sorteio.';

COMMENT ON POLICY "Admins can delete draws" ON public.draws IS
  'Permite que administradores removam sorteios lancados por engano ou em duplicidade.';

COMMIT;
