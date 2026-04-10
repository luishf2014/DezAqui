-- ============================================
-- Migração 039: Data de nascimento em profiles
-- ============================================
-- Campo usado no cadastro e em Configurações.
-- Trigger handle_new_user recriado para preencher birth_date a partir do metadata.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN public.profiles.birth_date IS 'Data de nascimento do usuário.';

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
    birth_date,
    is_admin,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'email', ''),
      NEW.email
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    NEW.raw_user_meta_data->>'phone',
    NULLIF(NEW.raw_user_meta_data->>'cpf', ''),
    CASE
      WHEN (NEW.raw_user_meta_data->>'birth_date') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (NEW.raw_user_meta_data->>'birth_date')::date
      ELSE NULL
    END,
    FALSE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Cria perfil em public.profiles ao registrar usuário em auth.users (inclui birth_date quando enviado no metadata).';
