-- ============================================
-- Migração 007: Correção RLS - SELECT próprio profile
-- FASE 1: Correção de bug de autenticação
-- ============================================
-- 
-- Esta migração corrige a recursão infinita na política RLS
-- e garante que usuários possam fazer SELECT do seu próprio perfil.
-- 
-- Problema resolvido:
-- - Profile vem null após SIGNED_IN
-- - Erro: "infinite recursion detected in policy for relation profiles"
-- - A política "Admins can view all profiles" causa recursão ao consultar profiles dentro de profiles
-- ============================================

-- Garantir que RLS está habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas que causam recursão
DROP POLICY IF EXISTS "read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- MODIFIQUEI AQUI - Criar policy definitiva para SELECT do próprio profile (sem recursão)
CREATE POLICY "read own profile"
ON public.profiles
FOR SELECT
USING (id = auth.uid());

-- MODIFIQUEI AQUI - Criar policy para admins usando a função is_admin() que é SECURITY DEFINER
-- Isso evita recursão infinita porque a função não é afetada por RLS
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Comentários das policies
COMMENT ON POLICY "read own profile" ON public.profiles IS 
  'Permite que usuários autenticados visualizem apenas seu próprio perfil (id = auth.uid())';

COMMENT ON POLICY "Admins can view all profiles" ON public.profiles IS 
  'Permite que administradores visualizem todos os perfis usando a função is_admin() que evita recursão';
