-- ============================================
-- Migração 021: Adicionar CPF ao perfil
-- FASE 1: Fundação do Sistema
-- ============================================
-- 
-- Esta migração adiciona o campo CPF à tabela profiles,
-- necessário para integração com Asaas (pagamentos PIX).
-- 
-- CPF:
-- - Armazenado como TEXT (somente números, normalizado)
-- - Valor único por usuário
-- - Obrigatório para pagamentos PIX
-- ============================================

-- Adicionar coluna cpf na tabela profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Criar índice único para CPF (permite NULL, mas garante unicidade quando preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf_unique 
ON profiles(cpf) 
WHERE cpf IS NOT NULL;

-- Comentário da coluna
COMMENT ON COLUMN profiles.cpf IS 'CPF do usuário (somente números, normalizado). Obrigatório para pagamentos PIX.';

-- ============================================
-- RECRIAR TRIGGER para incluir CPF
-- ============================================
-- 
-- O trigger handle_new_user precisa ser recriado para incluir
-- o campo CPF que foi adicionado nesta migração.
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
    cpf,
    is_admin,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,                                    -- ID do usuário do auth.users
    -- usar o email real enviado no metadata (fallback para NEW.email)
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'email', ''),  -- email real digitado no cadastro
      NEW.email                                       -- fallback: email do auth (telefone@dezaqui.local)
    ),                                 -- Email do usuário
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',   -- Nome do metadata (enviado pelo frontend)
      NEW.raw_user_meta_data->>'name',        -- Fallback para 'name' se 'full_name' não existir
      ''                                       -- String vazia se nenhum existir
    ),
    NEW.raw_user_meta_data->>'phone',         -- Telefone do metadata (pode ser NULL)
    NULLIF(NEW.raw_user_meta_data->>'cpf', ''), -- CPF do metadata (normalizado, somente números) - NULL se vazio
    FALSE,                                     -- Por padrão, não é administrador
    NOW(),                                     -- Timestamp de criação
    NOW()                                      -- Timestamp de atualização
  )
  ON CONFLICT (id) DO NOTHING;                -- Evita erro se o perfil já existir
  
  RETURN NEW;
END;
$$;
