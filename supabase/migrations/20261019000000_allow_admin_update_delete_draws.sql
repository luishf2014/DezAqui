-- Permite que somente administradores corrijam ou removam sorteios.
-- Espelha backend/migrations/056_allow_admin_update_delete_draws.sql para o
-- fluxo de deploy do Supabase CLI.

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
