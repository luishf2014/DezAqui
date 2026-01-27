-- ============================================
-- Migração 013: Adicionar código único aos sorteios
-- FASE 4: Sorteios e Rateio
-- ============================================
-- 
-- Esta migração adiciona um campo code único na tabela draws
-- para facilitar identificação e geração de relatórios por sorteio.
-- 
-- Objetivo:
-- - Permitir que administradores identifiquem sorteios por código
-- - Facilitar geração de relatórios específicos por sorteio
-- - Suportar múltiplos sorteios no mesmo concurso
--
-- Formato do código: DRW-YYYYMMDD-XXXXXX (ex: DRW-20250124-A1B2C3)
-- ============================================

-- Adicionar coluna code
ALTER TABLE public.draws
  ADD COLUMN IF NOT EXISTS code TEXT;

-- Criar índice único para code (será preenchido após migração de dados existentes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_draws_code 
  ON public.draws(code)
  WHERE code IS NOT NULL;

-- Comentário da coluna
COMMENT ON COLUMN public.draws.code IS 
  'Código único do sorteio no formato DRW-YYYYMMDD-XXXXXX. Usado para identificação e geração de relatórios específicos.';

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. Códigos existentes:
--    - Sorteios existentes terão code NULL inicialmente
--    - Será necessário gerar códigos para registros existentes via script ou aplicação
--
-- 2. Geração de código:
--    - O código será gerado automaticamente no frontend ao criar sorteio
--    - Formato: DRW-YYYYMMDD-XXXXXX onde:
--      * DRW = prefixo fixo (Draw)
--      * YYYYMMDD = data de criação (formato compacto)
--      * XXXXXX = 6 caracteres alfanuméricos aleatórios
--
-- 3. Unicidade:
--    - O índice único garante que não haverá códigos duplicados
--    - Em caso de conflito, o frontend deve gerar novo código
--
-- 4. Uso:
--    - Admin pode buscar sorteios por código na página AdminReports
--    - Geração de relatórios específicos por sorteio
-- ============================================
