-- ============================================
-- Migração 036: Remover participações duplicadas por external_id
-- ============================================
-- Remove participações extras criadas pelo mesmo pagamento do Mercado Pago

WITH duplicates AS (
  SELECT 
    p1.id as participation_id_to_keep,
    p2.id as participation_id_to_remove
  FROM participations p1
  INNER JOIN payments pay1 ON pay1.participation_id = p1.id
  INNER JOIN payments pay2 ON pay2.external_id = pay1.external_id AND pay2.participation_id != p1.id
  INNER JOIN participations p2 ON p2.id = pay2.participation_id
  WHERE 
    pay1.external_id IS NOT NULL 
    AND p1.created_at < p2.created_at -- Manter a mais antiga, remover a mais nova
),
removed_count AS (
  DELETE FROM participations 
  WHERE id IN (SELECT participation_id_to_remove FROM duplicates)
  RETURNING id
)
SELECT 
  (SELECT count(*) FROM removed_count) as participations_removed,
  'Duplicatas removidas com sucesso' as status;

-- Atualizar payments órfãos (sem participation_id válido)
UPDATE payments 
SET participation_id = NULL 
WHERE participation_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM participations 
    WHERE participations.id = payments.participation_id
  );