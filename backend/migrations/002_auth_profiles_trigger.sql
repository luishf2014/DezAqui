-- ============================================
-- Migração 002: Sincronização Auth -> Profiles
-- FASE 1: Fundação do Sistema
-- ============================================
-- 
-- Esta migração cria um sistema automático de sincronização entre
-- Supabase Auth (auth.users) e a tabela de perfis (public.profiles).
-- 
-- Objetivo:
-- Garantir que todo usuário criado no Supabase Auth tenha automaticamente
-- um registro correspondente na tabela profiles, seguindo o padrão oficial:
-- - auth.users = identidade e autenticação
-- - public.profiles = dados do domínio da aplicação
--
-- Arquitetura:
-- - Função handle_new_user: cria o perfil automaticamente
-- - Trigger on_auth_user_created: executa após INSERT em auth.users
--
-- Respeitando o modelo de domínio definido em docs/01_domain_model.md
-- ============================================

-- ============================================
-- FUNÇÃO: handle_new_user
-- ============================================
-- 
-- Esta função é executada automaticamente quando um novo usuário
-- é criado no Supabase Auth (auth.users).
-- 
-- Responsabilidades:
-- - Extrair dados do usuário criado (NEW)
-- - Inserir registro correspondente na tabela profiles
-- - Preencher campos com valores padrão quando necessário
--
-- SECURITY DEFINER:
-- Permite que a função execute com privilégios do criador da função,
-- necessário para inserir na tabela profiles mesmo quando executada
-- pelo trigger do sistema de autenticação.
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    phone,
    is_admin,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,                                    -- ID do usuário do auth.users
    NEW.email,                                 -- Email do usuário
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',   -- Nome do metadata (enviado pelo frontend)
      NEW.raw_user_meta_data->>'name',        -- Fallback para 'name' se 'full_name' não existir
      ''                                       -- String vazia se nenhum existir
    ),
    NEW.raw_user_meta_data->>'phone',         -- Telefone do metadata (pode ser NULL)
    FALSE,                                     -- Por padrão, não é administrador
    NOW(),                                     -- Timestamp de criação
    NOW()                                      -- Timestamp de atualização
  )
  ON CONFLICT (id) DO NOTHING;                -- Evita erro se o perfil já existir
  
  RETURN NEW;
END;
$$;

-- Comentário da função
COMMENT ON FUNCTION public.handle_new_user() IS 
  'Função que cria automaticamente um perfil em public.profiles quando um usuário é criado em auth.users';

-- ============================================
-- TRIGGER: on_auth_user_created
-- ============================================
-- 
-- Este trigger é executado automaticamente após cada INSERT
-- na tabela auth.users do Supabase Auth.
-- 
-- Comportamento:
-- - AFTER INSERT: executa após o registro ser inserido
-- - FOR EACH ROW: executa uma vez para cada linha inserida
-- - Chama a função handle_new_user() para criar o perfil
--
-- Importante:
-- - O trigger é criado no schema auth (padrão do Supabase)
-- - Funciona automaticamente para todos os métodos de criação de usuário:
--   * Sign up via email/senha
--   * OAuth (Google, GitHub, etc)
--   * Magic links
--   * Criação manual via Admin API
-- ============================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Comentário do trigger
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 
  'Trigger que sincroniza automaticamente novos usuários do auth.users com a tabela profiles';

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. Sincronização Automática:
--    - Todo usuário criado no Supabase Auth terá um perfil automaticamente
--    - Não é necessário criar o perfil manualmente no frontend
--
-- 2. Dados do Metadata:
--    - O nome é extraído de raw_user_meta_data->>'full_name' (enviado pelo frontend)
--    - Se não existir, tenta raw_user_meta_data->>'name'
--    - Se nenhum existir, usa string vazia (campo name é NOT NULL)
--    - O telefone é extraído de raw_user_meta_data->>'phone'
--    - Se não existir, fica NULL (campo phone é opcional)
--
-- 3. Segurança:
--    - A função usa SECURITY DEFINER para ter privilégios necessários
--    - O search_path é definido explicitamente para evitar problemas de segurança
--    - ON CONFLICT garante idempotência (não falha se executada múltiplas vezes)
--
-- 4. Próximas Fases:
--    - FASE 2: Implementar RLS (Row Level Security) na tabela profiles
--    - FASE 2: Permitir que usuários atualizem seus próprios perfis
--    - FASE 2+: Implementar lógica de atualização de perfis existentes
--
-- 5. Teste:
--    - Após aplicar esta migração, crie um usuário de teste
--    - Verifique se o registro aparece automaticamente em public.profiles
--    - Confirme que os campos estão preenchidos corretamente
-- ============================================
