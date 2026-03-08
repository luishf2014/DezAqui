-- Script alternativo simples para remover participações órfãs
-- Execute se o script complexo der timeout

-- Buscar participações órfãs das últimas 24h
-- (participações que não têm payment vinculado)
SELECT 
  p.id, 
  p.ticket_code,
  p.created_at
FROM participations p
WHERE p.status = 'active'
  AND p.created_at >= NOW() - INTERVAL '24 hours'
  AND NOT EXISTS (
    SELECT 1 FROM payments pay 
    WHERE pay.participation_id = p.id
  )
ORDER BY p.created_at DESC;

-- Depois de verificar os resultados acima, execute:
-- DELETE FROM participations WHERE ticket_code = 'TK-C2CUJY'; -- Substitua pelo código correto