-- Contagem pública de participações ativas por concurso (premiação estimada para todos os roles, incl. anon).
-- RLS em participations não expõe linhas a anon em concursos ativos; a UI usava len(ranking) == 0.

CREATE OR REPLACE FUNCTION public.count_active_participations_public(p_contest_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.participations p
  WHERE p.contest_id = p_contest_id
    AND p.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = p.contest_id
        AND c.status IN ('active', 'finished')
    );
$$;

COMMENT ON FUNCTION public.count_active_participations_public(uuid) IS
  'Conta participações ativas do concurso; visível a anon (apenas concursos ativos/finalizados) para premiação estimada.';

GRANT EXECUTE ON FUNCTION public.count_active_participations_public(uuid) TO anon, authenticated, service_role;
