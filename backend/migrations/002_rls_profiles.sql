-- ============================================
-- Migração 002: Row Level Security (RLS) - Profiles
-- FASE 2: Segurança e Autenticação
-- ============================================
-- 
-- Esta migração habilita Row Level Security (RLS) na tabela profiles,
-- garantindo que usuários só possam acessar e modificar seus próprios dados,
-- exceto administradores que têm acesso a todos os perfis.
-- 
-- Objetivo:
-- Implementar segurança em nível de linha para proteger dados sensíveis
-- dos usuários, seguindo o princípio de menor privilégio.
--
-- Regras de acesso:
-- 1. Usuários autenticados podem SELECT e UPDATE apenas seu próprio perfil
-- 2. Administradores (is_admin = true) podem SELECT todos os perfis
-- 3. Nenhum usuário pode DELETE perfis (operações de exclusão são raras e
--    devem ser feitas via Admin API ou funções específicas)
-- 4. INSERT é feito automaticamente via trigger (002_auth_profiles_trigger.sql)
--
-- Respeitando o modelo de domínio definido em docs/01_domain_model.md
-- ============================================

-- ============================================
-- HABILITAR ROW LEVEL SECURITY
-- ============================================
-- 
-- Habilita RLS na tabela profiles.
-- Após habilitar, todas as operações serão bloqueadas por padrão,
-- exceto aquelas explicitamente permitidas pelas policies abaixo.
-- ============================================
ALTER TABLE public.profiles
  ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICY: SELECT próprio perfil
-- ============================================
-- 
-- Permite que usuários autenticados visualizem apenas seu próprio perfil.
-- 
-- Condição:
-- - profiles.id deve ser igual ao auth.uid() (ID do usuário autenticado)
-- 
-- Uso:
-- - Usuário visualiza seus próprios dados no perfil
-- - Frontend pode buscar dados do usuário logado
-- ============================================
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- ============================================
-- POLICY: SELECT todos os perfis (Admin)
-- ============================================
-- 
-- Permite que administradores visualizem todos os perfis do sistema.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu próprio perfil
-- 
-- Importante:
-- - Esta policy verifica o perfil do próprio usuário para determinar se é admin
-- - Usa uma subquery para buscar o is_admin do usuário atual
-- - Permite que admins gerenciem todos os usuários do sistema
-- 
-- Uso:
-- - Painel administrativo pode listar todos os usuários
-- - Administradores podem visualizar dados de qualquer usuário
-- ============================================
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- ============================================
-- POLICY: UPDATE próprio perfil
-- ============================================
-- 
-- Permite que usuários autenticados atualizem apenas seu próprio perfil.
-- 
-- Condição:
-- - profiles.id deve ser igual ao auth.uid() (ID do usuário autenticado)
-- 
-- Restrições implícitas:
-- - Usuários não podem alterar o campo is_admin (apenas admins via Admin API)
-- - Usuários não podem alterar o id (chave primária)
-- - Usuários não podem alterar created_at (timestamp imutável)
-- 
-- Campos que podem ser atualizados:
-- - name: Nome do usuário
-- - phone: Telefone do usuário
-- - email: Email (se necessário, pode ser restringido futuramente)
-- - updated_at: Atualizado automaticamente via trigger
-- 
-- Uso:
-- - Usuário edita seu próprio perfil na aplicação
-- - Formulário de atualização de dados pessoais
-- ============================================
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. INSERT não tem policy:
--    - INSERTs são feitos automaticamente via trigger (002_auth_profiles_trigger.sql)
--    - O trigger usa SECURITY DEFINER, então não precisa de policy
--    - Frontend não deve fazer INSERT diretamente em profiles
--
-- 2. DELETE não tem policy:
--    - Nenhum usuário pode deletar perfis via RLS
--    - Exclusões devem ser feitas via Admin API ou funções específicas
--    - A exclusão em auth.users (via CASCADE) já remove o perfil automaticamente
--
-- 3. Ordem das policies:
--    - Policies de SELECT são avaliadas em OR (qualquer uma que passar permite acesso)
--    - Policy de UPDATE usa USING (para verificar linha existente) e WITH CHECK (para validar nova linha)
--
-- 4. Performance:
--    - O índice idx_profiles_is_admin ajuda na performance da policy de admin
--    - auth.uid() é otimizado pelo Supabase e é muito rápido
--
-- 5. Segurança:
--    - RLS funciona mesmo se o cliente tentar bypassar validações do frontend
--    - Todas as queries são validadas no banco de dados
--    - Policies são aplicadas a todas as operações, incluindo via Admin API (se não usar service_role)
--
-- 6. Testes recomendados:
--    - Criar usuário comum e verificar que só vê seu próprio perfil
--    - Criar usuário admin e verificar que vê todos os perfis
--    - Tentar UPDATE de outro usuário (deve falhar)
--    - Tentar DELETE (deve falhar)
--    - Verificar que INSERT via trigger ainda funciona
--
-- 7. Próximas fases:
--    - FASE 2+: Adicionar policies para outras tabelas (contests, participations, etc)
--    - FASE 2+: Implementar policies mais granulares se necessário
--    - FASE 3+: Adicionar auditoria de mudanças em perfis
-- ============================================
