-- ============================================
-- Migração 017: Percentuais de premiação configuráveis por concurso
-- FASE 4: Sorteios e Rateio
-- ============================================
-- 
-- Esta migração adiciona campos na tabela contests para permitir
-- configuração de percentuais de premiação por concurso.
-- 
-- Valores padrão (65/10/7/18) são baseados no README.md
-- ============================================

-- Adicionar colunas de percentuais de premiação
ALTER TABLE contests
  ADD COLUMN IF NOT EXISTS first_place_pct DECIMAL(5, 2) DEFAULT 65.00 NOT NULL,
  ADD COLUMN IF NOT EXISTS second_place_pct DECIMAL(5, 2) DEFAULT 10.00 NOT NULL,
  ADD COLUMN IF NOT EXISTS lowest_place_pct DECIMAL(5, 2) DEFAULT 7.00 NOT NULL,
  ADD COLUMN IF NOT EXISTS admin_fee_pct DECIMAL(5, 2) DEFAULT 18.00 NOT NULL;

-- Adicionar constraint para garantir que a soma seja 100%
ALTER TABLE contests
  ADD CONSTRAINT check_prize_percentages_sum CHECK (
    (first_place_pct + second_place_pct + lowest_place_pct + admin_fee_pct) = 100.00
  );

-- Adicionar constraint para garantir valores não negativos
ALTER TABLE contests
  ADD CONSTRAINT check_prize_percentages_non_negative CHECK (
    first_place_pct >= 0 AND
    second_place_pct >= 0 AND
    lowest_place_pct >= 0 AND
    admin_fee_pct >= 0
  );

-- Comentários explicativos
COMMENT ON COLUMN contests.first_place_pct IS 'Percentual de premiação para maior pontuação (padrão: 65%)';
COMMENT ON COLUMN contests.second_place_pct IS 'Percentual de premiação para segunda maior pontuação (padrão: 10%)';
COMMENT ON COLUMN contests.lowest_place_pct IS 'Percentual de premiação para menor pontuação (padrão: 7%)';
COMMENT ON COLUMN contests.admin_fee_pct IS 'Taxa administrativa (padrão: 18%)';
