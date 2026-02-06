-- Migration 021: Remover trigger de auto-encerramento no primeiro sorteio
-- O comportamento correto é: concurso só encerra quando alguém atinge numbers_per_participation pontos
-- Não no primeiro sorteio

-- Remove o trigger que encerrava o concurso no primeiro sorteio
DROP TRIGGER IF EXISTS trigger_auto_finish_contest_on_draw ON draws;

-- Remove a função associada
DROP FUNCTION IF EXISTS auto_finish_contest_on_first_draw();

-- Atualizar concursos que foram erroneamente finalizados
-- (concursos com sorteios mas sem ganhador com pontuação máxima)
-- NOTA: Execute manualmente se necessário, verificando caso a caso:
-- UPDATE contests SET status = 'active' WHERE status = 'finished' AND id IN (
--   SELECT DISTINCT c.id FROM contests c
--   INNER JOIN draws d ON d.contest_id = c.id
--   WHERE c.status = 'finished'
--   AND NOT EXISTS (
--     SELECT 1 FROM participations p
--     WHERE p.contest_id = c.id
--     AND p.status = 'active'
--     AND p.current_score >= c.numbers_per_participation
--   )
-- );
