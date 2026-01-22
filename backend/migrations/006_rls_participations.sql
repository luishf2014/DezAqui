-- ============================================
-- Migração 006: Row Level Security (RLS) - Participations
-- FASE 2: Segurança e Autenticação
-- ============================================
-- 
-- Esta migração habilita Row Level Security (RLS) na tabela participations,
-- garantindo que usuários só possam ver e criar suas próprias participações,
-- enquanto administradores têm acesso completo para gestão.
-- 
-- Objetivo:
-- Implementar segurança em nível de linha para proteger dados de participações,
-- seguindo o princípio de menor privilégio e garantindo que usuários só
-- acessem suas próprias participações em concursos.
--
-- Regras de acesso:
-- 1. Usuários autenticados comuns podem SELECT apenas suas próprias participações
-- 2. Usuários autenticados comuns podem INSERT apenas com seu próprio user_id
-- 3. Administradores podem SELECT, INSERT e DELETE todas as participações
-- 4. UPDATE é bloqueado para todos (nenhuma policy criada)
-- 5. Usuários não autenticados não podem acessar a tabela
--
-- Respeitando o modelo de domínio definido em docs/01_domain_model.md
-- ============================================

-- ============================================
-- HABILITAR ROW LEVEL SECURITY
-- ============================================
-- 
-- Habilita RLS na tabela participations.
-- Após habilitar, todas as operações serão bloqueadas por padrão,
-- exceto aquelas explicitamente permitidas pelas policies abaixo.
-- ============================================
ALTER TABLE public.participations
  ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICY: SELECT próprias participações (Usuário comum)
-- ============================================
-- 
-- Permite que usuários autenticados visualizem apenas suas próprias participações.
-- 
-- Condição:
-- - O registro deve ter user_id igual ao auth.uid() do usuário autenticado
-- 
-- Motivo:
-- - Usuários não devem ver participações de outros usuários
-- - Protege privacidade e dados sensíveis de outros participantes
-- - Permite que usuários acompanhem suas próprias participações
-- 
-- Uso:
-- - Usuário visualiza suas próprias participações em concursos
-- - Listagem de participações do usuário logado
-- ============================================
DROP POLICY IF EXISTS "Users can view own participations" ON public.participations;

CREATE POLICY "Users can view own participations"
  ON public.participations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- POLICY: INSERT própria participação (Usuário comum)
-- ============================================
-- 
-- Permite que usuários autenticados criem participações apenas para si mesmos.
-- 
-- Condição:
-- - O user_id do registro a ser inserido deve ser igual ao auth.uid()
-- 
-- Motivo:
-- - Usuários só podem se inscrever em concursos para si mesmos
-- - Previne que um usuário crie participações em nome de outros
-- - Garante segurança mesmo se o frontend tentar enviar user_id diferente
-- 
-- Uso:
-- - Usuário se inscreve em um concurso
-- - Criação de nova participação via formulário
-- ============================================
DROP POLICY IF EXISTS "Users can insert own participations" ON public.participations;

CREATE POLICY "Users can insert own participations"
  ON public.participations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- POLICY: SELECT todas as participações (Admin)
-- ============================================
-- 
-- Permite que administradores visualizem todas as participações do sistema.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu perfil
-- 
-- Motivo:
-- - Administradores precisam gerenciar todas as participações
-- - Necessário para painel administrativo e relatórios
-- 
-- Uso:
-- - Painel administrativo lista todas as participações
-- - Administradores podem visualizar qualquer participação para gestão
-- ============================================
DROP POLICY IF EXISTS "Admins can view all participations" ON public.participations;

CREATE POLICY "Admins can view all participations"
  ON public.participations
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
-- POLICY: INSERT participações (Admin)
-- ============================================
-- 
-- Permite que administradores criem participações para qualquer usuário.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu perfil
-- 
-- Motivo:
-- - Administradores podem precisar criar participações manualmente
-- - Útil para correções, migrações ou casos especiais
-- 
-- Uso:
-- - Criação manual de participações no painel administrativo
-- - Correção de dados ou migração de informações
-- ============================================
DROP POLICY IF EXISTS "Admins can insert participations" ON public.participations;

CREATE POLICY "Admins can insert participations"
  ON public.participations
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
-- POLICY: DELETE participações (Admin)
-- ============================================
-- 
-- Permite que apenas administradores excluam participações.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu perfil
-- 
-- Motivo:
-- - Exclusão de participações é uma operação administrativa sensível
-- - Apenas administradores devem ter essa permissão
-- - Previne que usuários excluam suas próprias participações acidentalmente
-- 
-- Uso:
-- - Remoção de participações no painel administrativo
-- - Correção de dados ou cancelamento de participações inválidas
-- ============================================
DROP POLICY IF EXISTS "Admins can delete participations" ON public.participations;

CREATE POLICY "Admins can delete participations"
  ON public.participations
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
-- 1. UPDATE não tem policy:
--    - Nenhuma policy de UPDATE foi criada
--    - UPDATE está bloqueado para todos os usuários (incluindo admins)
--    - Se UPDATE for necessário no futuro, criar policy específica
--    - Por enquanto, use DELETE + INSERT para modificações
--
-- 2. Políticas de SELECT:
--    - Policies são avaliadas em OR (qualquer uma que passar permite acesso)
--    - Usuários comuns só veem suas próprias participações
--    - Admins veem todas as participações (incluindo as próprias)
--    - O índice idx_participations_user_id otimiza a query de usuários comuns
--
-- 3. Verificação de Admin:
--    - Todas as policies de admin usam a mesma subquery
--    - Verifica se o usuário atual tem is_admin = true em profiles
--    - O índice idx_profiles_is_admin otimiza essa verificação
--
-- 4. INSERT Policy para usuários comuns:
--    - Usa WITH CHECK para validar que user_id = auth.uid()
--    - Previne que usuários criem participações para outros
--    - Garante que o user_id sempre corresponde ao usuário autenticado
--    - Mesmo se o frontend tentar enviar user_id diferente, será bloqueado
--
-- 5. Usuários não autenticados:
--    - Não há policies para role 'anon' ou 'public'
--    - Usuários não autenticados não podem acessar participations
--    - Isso garante que apenas usuários logados vejam participações
--
-- 6. Performance:
--    - O índice idx_participations_user_id ajuda na policy de SELECT para usuários comuns
--    - O índice idx_profiles_is_admin ajuda na verificação de admin
--    - auth.uid() é otimizado pelo Supabase
--
-- 7. Segurança:
--    - RLS funciona mesmo se o cliente tentar bypassar validações do frontend
--    - Todas as queries são validadas no banco de dados
--    - Policies são aplicadas a todas as operações, incluindo via Admin API (se não usar service_role)
--    - Usuários não podem modificar user_id para criar participações para outros
--
-- 8. Testes recomendados:
--    - Criar usuário comum e verificar que só vê suas próprias participações
--    - Criar usuário comum e tentar INSERT com user_id diferente (deve falhar)
--    - Criar usuário admin e verificar que vê todas as participações
--    - Criar usuário admin e verificar que pode INSERT e DELETE
--    - Tentar UPDATE como qualquer usuário (deve falhar - sem policy)
--    - Verificar que usuário não autenticado não acessa participations
-- ============================================
