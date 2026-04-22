-- ============================================
-- Migração 020: Adicionar código único aos concursos
-- FASE 1: Fundação do Sistema
-- ============================================
-- 
-- Esta migração adiciona um campo contest_code único na tabela contests
-- para facilitar identificação pública dos concursos.
-- 
-- Objetivo:
-- - Permitir que usuários e administradores identifiquem concursos por código
-- - Facilitar busca e rastreamento de concursos
-- - Formato padronizado: SIGLA-XXXXXX onde SIGLA é extraída do nome do concurso
--
-- Formato do código: SIGLA-XXXXXX (ex: CO-A1B2C3 para "CONCURSO" ou MG-A1B2C3 para "MEGA GIRO")
-- ============================================

-- Adicionar coluna contest_code
ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS contest_code TEXT;

-- Criar índice único para contest_code (será preenchido após migração de dados existentes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contests_contest_code 
  ON public.contests(contest_code)
  WHERE contest_code IS NOT NULL;

-- Comentário da coluna
COMMENT ON COLUMN public.contests.contest_code IS 
  'Código único do concurso no formato SIGLA-XXXXXX onde SIGLA é extraída do nome (ex: CO-A1B2C3 para "CONCURSO" ou MG-A1B2C3 para "MEGA GIRO"). Usado para identificação pública do concurso.';

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. Códigos existentes:
--    - Concursos existentes terão contest_code NULL inicialmente
--    - Será necessário gerar códigos para registros existentes via script ou aplicação
--
-- 2. Geração de código:
--    - O código será gerado automaticamente no frontend ao criar concurso
--    - Formato: SIGLA-XXXXXX onde:
--      * SIGLA = extraída do nome do concurso:
--        - Se uma palavra: 2 primeiras letras (ex: CONCURSO -> CO)
--        - Se 2+ palavras: primeira letra de cada palavra (ex: MEGA GIRO -> MG)
--      * XXXXXX = 6 caracteres alfanuméricos aleatórios
--
-- 3. Unicidade:
--    - O índice único garante que não haverá códigos duplicados
--    - Se houver colisão, o sistema deve gerar novo código automaticamente
