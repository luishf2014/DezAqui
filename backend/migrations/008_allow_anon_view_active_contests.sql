-- ============================================
-- Migração 008: Permitir visualização de concursos ativos para usuários anônimos
-- FASE 1: Fundação do Sistema (Core)
-- ============================================
-- 
-- Esta migração adiciona uma política RLS que permite que usuários não autenticados
-- (role 'anon') visualizem concursos com status = 'active'.
-- 
-- Objetivo:
-- Permitir que visitantes do site possam visualizar a lista de concursos disponíveis
-- sem precisar estar autenticados, facilitando o acesso e a descoberta de concursos.
--
-- Regras de acesso:
-- - Usuários anônimos podem SELECT apenas concursos com status = 'active'
-- - Isso permite que a página /contests funcione mesmo sem login
-- - Mantém a segurança: apenas concursos ativos são visíveis publicamente
--
-- ============================================

-- ============================================
-- POLICY: SELECT concursos ativos (Usuários anônimos)
-- ============================================
-- 
-- Permite que usuários não autenticados visualizem concursos com status = 'active'.
-- 
-- Condição:
-- - O concurso deve ter status = 'active'
-- - O usuário não precisa estar autenticado (role 'anon')
-- 
-- Motivo:
-- - Facilita a descoberta de concursos pelos visitantes do site
-- - Permite que usuários vejam os concursos antes de se cadastrarem
-- - Mantém segurança: apenas concursos ativos são públicos
-- 
-- Uso:
-- - Listagem pública de concursos disponíveis para participação
-- - Visualização de detalhes de concursos ativos por visitantes
-- ============================================
DROP POLICY IF EXISTS "Anonymous users can view active contests" ON public.contests;

CREATE POLICY "Anonymous users can view active contests"
  ON public.contests
  FOR SELECT
  TO anon
  USING (status = 'active');

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. Políticas de SELECT agora incluem:
--    - Usuários anônimos: apenas concursos 'active'
--    - Usuários autenticados comuns: apenas concursos 'active'
--    - Administradores: todos os concursos (qualquer status)
--
-- 2. Segurança:
--    - Apenas concursos ativos são visíveis publicamente
--    - Concursos em rascunho, finalizados ou cancelados permanecem privados
--    - Usuários anônimos não podem criar, editar ou deletar concursos
--
-- 3. Performance:
--    - O índice idx_contests_status otimiza a query para usuários anônimos
--    - A política é avaliada no banco de dados, garantindo eficiência
--
-- 4. Testes recomendados:
--    - Verificar que usuário não autenticado vê apenas concursos 'active'
--    - Verificar que usuário não autenticado não vê concursos 'draft', 'finished' ou 'cancelled'
--    - Verificar que usuário não autenticado não pode criar, editar ou deletar concursos
-- ============================================
