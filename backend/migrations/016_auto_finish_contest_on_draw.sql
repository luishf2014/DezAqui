-- ============================================
-- Migração 016: Finalização automática de concursos ao criar sorteio
-- CHATGPT: alterei aqui - Trigger para atualizar status do concurso para 'finished' quando primeiro sorteio é criado
-- ============================================
-- 
-- Esta migração cria uma trigger que automaticamente atualiza o status
-- de um concurso para 'finished' quando o primeiro sorteio é criado.
-- 
-- Garantia adicional ao código do frontend (drawsService.ts) para garantir
-- consistência mesmo se houver inserção direta no banco.
-- ============================================

-- Função que verifica se é o primeiro sorteio e atualiza o status do concurso
CREATE OR REPLACE FUNCTION auto_finish_contest_on_first_draw()
RETURNS TRIGGER AS $$
DECLARE
  draw_count INTEGER;
BEGIN
  -- Contar quantos sorteios existem para este concurso (incluindo o que acabou de ser inserido)
  SELECT COUNT(*) INTO draw_count
  FROM draws
  WHERE contest_id = NEW.contest_id;

  -- Se este é o primeiro sorteio (count = 1), atualizar status do concurso para 'finished'
  IF draw_count = 1 THEN
    UPDATE contests
    SET status = 'finished',
        updated_at = NOW()
    WHERE id = NEW.contest_id
      AND status != 'finished'; -- Evitar atualizações desnecessárias se já estiver finalizado
    
    -- Log para debug (opcional, pode ser removido em produção)
    RAISE NOTICE 'Concurso % finalizado automaticamente após criação do primeiro sorteio', NEW.contest_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger AFTER INSERT na tabela draws
CREATE TRIGGER trigger_auto_finish_contest_on_draw
  AFTER INSERT ON draws
  FOR EACH ROW
  EXECUTE FUNCTION auto_finish_contest_on_first_draw();

-- Comentário explicativo
COMMENT ON FUNCTION auto_finish_contest_on_first_draw() IS 
  'Atualiza automaticamente o status do concurso para finished quando o primeiro sorteio é criado';

COMMENT ON TRIGGER trigger_auto_finish_contest_on_draw ON draws IS 
  'Trigger que finaliza automaticamente o concurso quando o primeiro sorteio é inserido';
