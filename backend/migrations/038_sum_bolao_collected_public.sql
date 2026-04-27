-- Soma dos valores pagos no bolão por concurso (bilhetes ativos, último pagamento pago por participação).
-- Evita usar só quantidade × valor atual da cota quando o admin altera o valor da cota ao longo do tempo.

CREATE OR REPLACE FUNCTION public.sum_bolao_collected_public(p_contest_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(x.amount), 0)::numeric
  FROM (
    SELECT DISTINCT ON (pay.participation_id)
      pay.amount::numeric AS amount
    FROM public.payments pay
    INNER JOIN public.participations part ON part.id = pay.participation_id
    WHERE part.contest_id = p_contest_id
      AND part.status = 'active'
      AND pay.status = 'paid'
      AND EXISTS (
        SELECT 1
        FROM public.contests c
        WHERE c.id = part.contest_id
          AND c.status IN ('active', 'finished')
      )
    ORDER BY pay.participation_id, pay.created_at DESC
  ) x;
$$;

COMMENT ON FUNCTION public.sum_bolao_collected_public(uuid) IS
  'Soma valores pagos em participações ativas do concurso (último pagamento pago por bilhete).';

GRANT EXECUTE ON FUNCTION public.sum_bolao_collected_public(uuid) TO anon, authenticated, service_role;
