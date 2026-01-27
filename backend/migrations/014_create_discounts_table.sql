-- ============================================
-- Migração 014: Tabela de Descontos e Promoções
-- FASE 1: Painel Administrativo - Financeiro
-- ============================================
-- 
-- Esta migração cria a tabela de descontos e promoções
-- para permitir gestão de cupons e descontos nos concursos
-- ============================================

-- ============================================
-- TABELA: discounts
-- Descontos e promoções aplicáveis a concursos
-- ============================================
CREATE TABLE IF NOT EXISTS discounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identificação
  code TEXT NOT NULL UNIQUE, -- Código do cupom (ex: PROMO2025, DESCONTO10)
  name TEXT NOT NULL, -- Nome da promoção
  description TEXT, -- Descrição da promoção
  
  -- Tipo de desconto
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')), -- 'percentage' = percentual, 'fixed' = valor fixo
  discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0), -- Valor do desconto (percentual ou fixo)
  
  -- Aplicação
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE, -- NULL = desconto global (aplicável a todos os concursos)
  
  -- Validade
  start_date TIMESTAMP WITH TIME ZONE NOT NULL, -- Data de início da promoção
  end_date TIMESTAMP WITH TIME ZONE NOT NULL, -- Data de término da promoção
  
  -- Limites
  max_uses INTEGER, -- Número máximo de usos (NULL = ilimitado)
  current_uses INTEGER DEFAULT 0 NOT NULL, -- Número atual de usos
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE NOT NULL, -- Se a promoção está ativa
  
  -- Metadados
  created_by UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Validações
  CONSTRAINT check_end_after_start CHECK (end_date > start_date),
  CONSTRAINT check_max_uses CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT check_percentage_range CHECK (discount_type != 'percentage' OR (discount_value > 0 AND discount_value <= 100))
);

-- Índices para discounts
CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code);
CREATE INDEX IF NOT EXISTS idx_discounts_contest_id ON discounts(contest_id);
CREATE INDEX IF NOT EXISTS idx_discounts_is_active ON discounts(is_active);
CREATE INDEX IF NOT EXISTS idx_discounts_dates ON discounts(start_date, end_date);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_discounts_updated_at BEFORE UPDATE ON discounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE discounts IS 'Descontos e promoções aplicáveis a concursos ou globalmente';
COMMENT ON COLUMN discounts.code IS 'Código único do cupom/promoção (ex: PROMO2025, DESCONTO10)';
COMMENT ON COLUMN discounts.discount_type IS 'Tipo de desconto: percentage (percentual) ou fixed (valor fixo)';
COMMENT ON COLUMN discounts.discount_value IS 'Valor do desconto: se percentage, valor entre 0-100; se fixed, valor em reais';
COMMENT ON COLUMN discounts.contest_id IS 'ID do concurso específico (NULL = desconto global aplicável a todos)';
COMMENT ON COLUMN discounts.max_uses IS 'Número máximo de usos permitidos (NULL = ilimitado)';
COMMENT ON COLUMN discounts.current_uses IS 'Número atual de usos do desconto';

-- ============================================
-- RLS Policies para discounts
-- ============================================
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

-- Política: Administradores podem fazer tudo
CREATE POLICY "Admins can manage discounts"
  ON discounts
  FOR ALL
  TO authenticated
  USING (
    public.is_admin(auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
  );

-- Política: Usuários autenticados podem visualizar descontos ativos
CREATE POLICY "Users can view active discounts"
  ON discounts
  FOR SELECT
  TO authenticated
  USING (
    is_active = TRUE
    AND start_date <= NOW()
    AND end_date >= NOW()
    AND (max_uses IS NULL OR current_uses < max_uses)
  );

-- ============================================
-- FUNÇÃO RPC: Incrementar usos de desconto
-- ============================================
CREATE OR REPLACE FUNCTION increment_discount_uses(discount_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE discounts
  SET current_uses = current_uses + 1
  WHERE id = discount_id
    AND (max_uses IS NULL OR current_uses < max_uses);
END;
$$;
