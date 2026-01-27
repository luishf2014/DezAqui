-- ============================================
-- Migração 011: Adicionar código/ticket único às participações
-- FASE 1: Fundação do Sistema
-- ============================================
-- 
-- Esta migração adiciona um campo ticket_code único na tabela participations
-- para facilitar rastreamento e identificação de participações tanto para
-- pagamentos Pix quanto para pagamentos em dinheiro.
-- 
-- Objetivo:
-- - Permitir que usuários e administradores identifiquem participações por código
-- - Facilitar busca e rastreamento de participações
-- - Suportar ambos os métodos de pagamento (Pix e Dinheiro)
--
-- Formato do código: TKT-YYYYMMDD-XXXXXX (ex: TKT-20250124-A1B2C3)
-- ============================================

-- Adicionar coluna ticket_code
ALTER TABLE public.participations
  ADD COLUMN IF NOT EXISTS ticket_code TEXT;

-- Criar índice único para ticket_code (será preenchido após migração de dados existentes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_participations_ticket_code 
  ON public.participations(ticket_code)
  WHERE ticket_code IS NOT NULL;

-- Comentário da coluna
COMMENT ON COLUMN public.participations.ticket_code IS 
  'Código único da participação no formato TKT-YYYYMMDD-XXXXXX. Usado para rastreamento e identificação em pagamentos Pix e Dinheiro.';

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. Códigos existentes:
--    - Participações existentes terão ticket_code NULL inicialmente
--    - Será necessário gerar códigos para registros existentes via script ou aplicação
--
-- 2. Geração de código:
--    - O código será gerado automaticamente no frontend ao criar participação
--    - Formato: TKT-YYYYMMDD-XXXXXX onde:
--      * TKT = prefixo fixo
--      * YYYYMMDD = data de criação (formato compacto)
--      * XXXXXX = 6 caracteres alfanuméricos aleatórios
--
-- 3. Unicidade:
--    - O índice único garante que não haverá códigos duplicados
--    - Em caso de conflito, o frontend deve gerar novo código
--
-- 4. Busca:
--    - Admin pode buscar participações por código na página AdminActivations
--    - Usuário pode ver seu código na página "Meus Tickets"
-- ============================================
