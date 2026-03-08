-- ============================================
-- Migração 037: Remover participações órfãs (sem pagamento vinculado)
-- ============================================
-- Remove participações que foram criadas sem estar vinculadas a nenhum pagamento

WITH orphan_participations AS (
  SELECT p.id, p.ticket_code, p.created_at
  FROM participations p
  WHERE p.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM payments pay 
      WHERE pay.participation_id = p.id
    )
    AND p.created_at >= NOW() - INTERVAL '24 hours' -- Apenas das últimas 24h para segurança
),
deleted_count AS (
  DELETE FROM participations 
  WHERE id IN (SELECT id FROM orphan_participations)
  RETURNING id, ticket_code
)
SELECT 
  array_agg(ticket_code) as tickets_removidos,
  count(*) as total_removido
FROM deleted_count;