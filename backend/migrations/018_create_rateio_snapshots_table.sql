-- ============================================
-- Migração 018: Tabela de snapshots de rateio
-- FASE 4: Sorteios e Rateio
-- ============================================
-- 
-- Esta migração cria uma tabela para armazenar snapshots de rateio
-- calculados após cada sorteio, permitindo auditoria e histórico.
-- 
-- Cada snapshot representa o estado do rateio após um sorteio específico.
-- ============================================

CREATE TABLE IF NOT EXISTS rateio_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE NOT NULL,
  draw_id UUID REFERENCES draws(id) ON DELETE CASCADE NOT NULL,
  
  -- Valores financeiros
  total_arrecadado DECIMAL(10, 2) NOT NULL,
  taxa_administrativa DECIMAL(10, 2) NOT NULL,
  valor_premiacao DECIMAL(10, 2) NOT NULL,
  
  -- Configuração de percentuais usada no cálculo
  first_place_pct DECIMAL(5, 2) NOT NULL,
  second_place_pct DECIMAL(5, 2) NOT NULL,
  lowest_place_pct DECIMAL(5, 2) NOT NULL,
  admin_fee_pct DECIMAL(5, 2) NOT NULL,
  
  -- Distribuição calculada (armazenada como JSONB para flexibilidade)
  distribuicao JSONB NOT NULL,
  
  -- Lista de ganhadores (armazenada como JSONB)
  ganhadores JSONB NOT NULL,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índices para consultas rápidas
CREATE INDEX idx_rateio_snapshots_contest_id ON rateio_snapshots(contest_id);
CREATE INDEX idx_rateio_snapshots_draw_id ON rateio_snapshots(draw_id);
CREATE INDEX idx_rateio_snapshots_created_at ON rateio_snapshots(created_at DESC);

-- Comentário explicativo
COMMENT ON TABLE rateio_snapshots IS 'Snapshots de rateio calculados após cada sorteio para auditoria e histórico';

-- RLS: Apenas admins podem inserir/visualizar snapshots
ALTER TABLE rateio_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Admins podem visualizar todos os snapshots
CREATE POLICY "Admins can view rateio snapshots"
  ON rateio_snapshots
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Policy: Admins podem inserir snapshots
CREATE POLICY "Admins can insert rateio snapshots"
  ON rateio_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Snapshots são imutáveis após criação (sem UPDATE/DELETE)
