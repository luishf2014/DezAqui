-- Migração 022: Adicionar campo numbers_count à tabela draws
-- Permite que cada sorteio tenha uma quantidade diferente de números
-- Se NULL, usa o valor de numbers_per_participation do concurso (comportamento padrão)

-- Adicionar coluna numbers_count (opcional, permite NULL)
ALTER TABLE public.draws
  ADD COLUMN IF NOT EXISTS numbers_count INTEGER;

-- Comentário explicativo
COMMENT ON COLUMN public.draws.numbers_count IS 'Quantidade de números para este sorteio específico. Se NULL, usa numbers_per_participation do concurso.';
