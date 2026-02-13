-- ============================================
-- Migração 027: Permitir usuários verem ranking completo de concursos ativos
-- ============================================
--
-- Problema: Na página de classificação/ranking, o usuário só via seus próprios
-- números - não via os outros participantes. A classificação parecia vazia.
--
-- Causa: RLS em participations permitia ver outras participações apenas em
-- concursos finalizados (migração 025). Para concursos ATIVOS, a policy
-- "Users can view own participations" restringia à própria participação.
--
-- Solução: Adicionar policies para permitir visualizar participações e
-- perfis de concursos ATIVOS (para exibir o ranking completo).
--
-- ============================================

-- PARTICIPATIONS: SELECT participações de concursos ativos (para ranking)
DROP POLICY IF EXISTS "Users can view participations from active contests" ON public.participations;

CREATE POLICY "Users can view participations from active contests"
  ON public.participations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contests
      WHERE contests.id = participations.contest_id
        AND contests.status = 'active'
    )
  );

-- DRAW_PAYOUTS: SELECT prêmios de concursos ativos (para exibir categorias TOP/SECOND/LOWEST no ranking)
DROP POLICY IF EXISTS "Users can view payouts from active contests" ON public.draw_payouts;

CREATE POLICY "Users can view payouts from active contests"
  ON public.draw_payouts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contests
      WHERE contests.id = draw_payouts.contest_id
        AND contests.status = 'active'
    )
  );

-- PROFILES: SELECT perfis de participantes em concursos ativos (para exibir nomes no ranking)
DROP POLICY IF EXISTS "Users can view profiles from active contest participants" ON public.profiles;

CREATE POLICY "Users can view profiles from active contest participants"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.participations p
      JOIN public.contests c ON c.id = p.contest_id
      WHERE p.user_id = profiles.id
        AND c.status = 'active'
    )
  );
