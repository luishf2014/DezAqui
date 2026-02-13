-- ============================================
-- Migração 025: Permitir usuários verem concursos finalizados (Histórico)
-- ============================================
--
-- Problema: Na aba "Histórico", concursos finalizados não aparecem
-- para usuários comuns. Apenas admins conseguiam ver.
--
-- Causa: RLS em contests permitia SELECT apenas em status = 'active'
-- para usuários autenticados e anônimos.
--
-- Solução: Adicionar policies para permitir SELECT em status = 'finished'
-- e dados relacionados (draws, participations, payouts, profiles).
--
-- ============================================

-- CONTESTS: SELECT concursos finalizados
DROP POLICY IF EXISTS "Users can view finished contests" ON public.contests;
CREATE POLICY "Users can view finished contests"
  ON public.contests FOR SELECT TO authenticated
  USING (status = 'finished');

DROP POLICY IF EXISTS "Anonymous users can view finished contests" ON public.contests;
CREATE POLICY "Anonymous users can view finished contests"
  ON public.contests FOR SELECT TO anon
  USING (status = 'finished');

-- DRAWS: SELECT sorteios de concursos finalizados
DROP POLICY IF EXISTS "Users can view draws from finished contests" ON public.draws;
CREATE POLICY "Users can view draws from finished contests"
  ON public.draws FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contests WHERE contests.id = draws.contest_id AND contests.status = 'finished'));

DROP POLICY IF EXISTS "Anonymous users can view draws from finished contests" ON public.draws;
CREATE POLICY "Anonymous users can view draws from finished contests"
  ON public.draws FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.contests WHERE contests.id = draws.contest_id AND contests.status = 'finished'));

-- PARTICIPATIONS: SELECT participações de concursos finalizados (para ranking)
DROP POLICY IF EXISTS "Users can view participations from finished contests" ON public.participations;
CREATE POLICY "Users can view participations from finished contests"
  ON public.participations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contests WHERE contests.id = participations.contest_id AND contests.status = 'finished'));

DROP POLICY IF EXISTS "Anonymous users can view participations from finished contests" ON public.participations;
CREATE POLICY "Anonymous users can view participations from finished contests"
  ON public.participations FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.contests WHERE contests.id = participations.contest_id AND contests.status = 'finished'));

-- DRAW_PAYOUTS: SELECT prêmios de concursos finalizados
DROP POLICY IF EXISTS "Users can view payouts from finished contests" ON public.draw_payouts;
CREATE POLICY "Users can view payouts from finished contests"
  ON public.draw_payouts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contests WHERE contests.id = draw_payouts.contest_id AND contests.status = 'finished'));

DROP POLICY IF EXISTS "Anonymous users can view payouts from finished contests" ON public.draw_payouts;
CREATE POLICY "Anonymous users can view payouts from finished contests"
  ON public.draw_payouts FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.contests WHERE contests.id = draw_payouts.contest_id AND contests.status = 'finished'));

-- PROFILES: SELECT perfis de participantes em concursos finalizados (para exibir nomes no ranking)
DROP POLICY IF EXISTS "Users can view profiles from finished contest participants" ON public.profiles;
CREATE POLICY "Users can view profiles from finished contest participants"
  ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.participations p JOIN public.contests c ON c.id = p.contest_id WHERE p.user_id = profiles.id AND c.status = 'finished'));
