-- ============================================
-- Migração 003: Row Level Security (RLS) - Contests
-- FASE 2: Segurança e Autenticação
-- ============================================
-- 
-- Esta migração habilita Row Level Security (RLS) na tabela contests,
-- garantindo que apenas usuários autenticados possam visualizar concursos
-- e apenas administradores possam criar, editar ou excluir concursos.
-- 
-- Objetivo:
-- Implementar segurança em nível de linha para proteger a gestão de concursos,
-- seguindo o princípio de menor privilégio e garantindo que apenas concursos
-- ativos sejam visíveis para usuários comuns.
--
-- Regras de acesso:
-- 1. Usuários autenticados comuns podem SELECT apenas concursos com status = 'active'
-- 2. Administradores podem SELECT, INSERT, UPDATE e DELETE todos os concursos
-- 3. Usuários não autenticados não podem acessar a tabela contests
--
-- Respeitando o modelo de domínio definido em docs/01_domain_model.md
-- ============================================

-- ============================================
-- HABILITAR ROW LEVEL SECURITY
-- ============================================
-- 
-- Habilita RLS na tabela contests.
-- Após habilitar, todas as operações serão bloqueadas por padrão,
-- exceto aquelas explicitamente permitidas pelas policies abaixo.
-- ============================================
ALTER TABLE public.contests
  ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICY: SELECT concursos ativos (Usuários comuns)
-- ============================================
-- 
-- Permite que usuários autenticados visualizem apenas concursos com status = 'active'.
-- 
-- Condição:
-- - O concurso deve ter status = 'active'
-- - O usuário deve estar autenticado
-- 
-- Motivo:
-- - Usuários comuns não precisam ver concursos em rascunho, finalizados ou cancelados
-- - Apenas concursos ativos são relevantes para participação
-- 
-- Uso:
-- - Listagem de concursos disponíveis para participação
-- - Visualização de detalhes de concursos ativos
-- ============================================
DROP POLICY IF EXISTS "Users can view active contests" ON public.contests;

CREATE POLICY "Users can view active contests"
  ON public.contests
  FOR SELECT
  TO authenticated
  USING (status = 'active');

-- ============================================
-- POLICY: SELECT todos os concursos (Admin)
-- ============================================
-- 
-- Permite que administradores visualizem todos os concursos, independente do status.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu perfil
-- 
-- Motivo:
-- - Administradores precisam gerenciar todos os concursos
-- - Precisam ver concursos em rascunho, finalizados e cancelados
-- 
-- Uso:
-- - Painel administrativo lista todos os concursos
-- - Administradores podem visualizar qualquer concurso para gestão
-- ============================================
DROP POLICY IF EXISTS "Admins can view all contests" ON public.contests;

CREATE POLICY "Admins can view all contests"
  ON public.contests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================
-- POLICY: INSERT concursos (Admin)
-- ============================================
-- 
-- Permite que apenas administradores criem novos concursos.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu perfil
-- 
-- Motivo:
-- - Apenas administradores devem ter permissão para criar concursos
-- - Criação de concursos é uma operação administrativa sensível
-- 
-- Uso:
-- - Formulário de criação de concursos no painel administrativo
-- - Criação de novos concursos via API administrativa
-- ============================================
DROP POLICY IF EXISTS "Admins can insert contests" ON public.contests;

CREATE POLICY "Admins can insert contests"
  ON public.contests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================
-- POLICY: UPDATE concursos (Admin)
-- ============================================
-- 
-- Permite que apenas administradores atualizem concursos existentes.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu perfil
-- 
-- Motivo:
-- - Apenas administradores devem modificar configurações de concursos
-- - Atualização de concursos pode afetar participantes e sorteios
-- 
-- Uso:
-- - Edição de concursos no painel administrativo
-- - Atualização de status, datas, regras, etc.
-- ============================================
DROP POLICY IF EXISTS "Admins can update contests" ON public.contests;

CREATE POLICY "Admins can update contests"
  ON public.contests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================
-- POLICY: DELETE concursos (Admin)
-- ============================================
-- 
-- Permite que apenas administradores excluam concursos.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu perfil
-- 
-- Motivo:
-- - Exclusão de concursos é uma operação crítica e irreversível
-- - Apenas administradores devem ter essa permissão
-- 
-- Importante:
-- - A exclusão de um concurso pode ter efeito cascata nas participações
-- - Considere usar soft delete (status = 'cancelled') ao invés de DELETE físico
-- 
-- Uso:
-- - Exclusão de concursos no painel administrativo
-- - Remoção de concursos que não serão mais utilizados
-- ============================================
DROP POLICY IF EXISTS "Admins can delete contests" ON public.contests;

CREATE POLICY "Admins can delete contests"
  ON public.contests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. Políticas de SELECT:
--    - Policies são avaliadas em OR (qualquer uma que passar permite acesso)
--    - Usuários comuns só veem concursos 'active'
--    - Admins veem todos os concursos (incluindo 'active')
--    - O índice idx_contests_status otimiza a query de usuários comuns
--
-- 2. Verificação de Admin:
--    - Todas as policies de admin usam a mesma subquery
--    - Verifica se o usuário atual tem is_admin = true em profiles
--    - O índice idx_profiles_is_admin otimiza essa verificação
--
-- 3. UPDATE Policy:
--    - Usa USING (para verificar linha existente) e WITH CHECK (para validar nova linha)
--    - Ambos verificam se o usuário é admin
--    - Garante que apenas admins podem modificar concursos
--
-- 4. DELETE Policy:
--    - Apenas admins podem deletar
--    - Considere usar status = 'cancelled' ao invés de DELETE físico
--    - DELETE em contests tem CASCADE em participations (definido na migração 001)
--
-- 5. Usuários não autenticados:
--    - Não há policies para role 'anon' ou 'public'
--    - Usuários não autenticados não podem acessar contests
--    - Isso garante que apenas usuários logados vejam concursos
--
-- 6. Performance:
--    - O índice idx_contests_status ajuda na policy de SELECT para usuários comuns
--    - O índice idx_profiles_is_admin ajuda na verificação de admin
--    - auth.uid() é otimizado pelo Supabase
--
-- 7. Segurança:
--    - RLS funciona mesmo se o cliente tentar bypassar validações do frontend
--    - Todas as queries são validadas no banco de dados
--    - Policies são aplicadas a todas as operações, incluindo via Admin API (se não usar service_role)
--
-- 8. Testes recomendados:
--    - Criar usuário comum e verificar que só vê concursos 'active'
--    - Criar usuário admin e verificar que vê todos os concursos
--    - Tentar INSERT como usuário comum (deve falhar)
--    - Tentar UPDATE como usuário comum (deve falhar)
--    - Tentar DELETE como usuário comum (deve falhar)
--    - Verificar que usuário não autenticado não acessa contests
--
-- 9. Próximas fases:
--    - FASE 2+: Adicionar policies para participations
--    - FASE 2+: Adicionar policies para draws e payments
--    - FASE 3+: Considerar soft delete para concursos (status = 'cancelled')
-- ============================================
