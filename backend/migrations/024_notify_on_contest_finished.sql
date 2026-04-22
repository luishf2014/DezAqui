-- ============================================
-- Migração 024: Notificação automática quando concurso é finalizado
-- ============================================
-- 
-- Esta migração cria uma trigger que automaticamente cria notificações
-- para todos os participantes quando um concurso é finalizado (status = 'finished').
-- 
-- A notificação só é criada se:
-- 1. O status mudou de qualquer valor para 'finished'
-- 2. O participante tem notify_contest_finished = true nas preferências
-- 3. O participante tem enabled = true nas preferências
-- ============================================

-- Função que cria notificações quando um concurso é finalizado
-- SECURITY DEFINER permite que a função execute com privilégios do criador,
-- necessário para contornar RLS ao inserir notificações
CREATE OR REPLACE FUNCTION notify_on_contest_finished()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contest_name TEXT;
  contest_participants UUID[];
  allowed_user_ids UUID[];
BEGIN
  -- Só processar se o status mudou para 'finished'
  IF NEW.status = 'finished' AND (OLD.status IS NULL OR OLD.status != 'finished') THEN
    -- Buscar nome do concurso
    SELECT name INTO contest_name
    FROM contests
    WHERE id = NEW.id;
    
    -- Buscar todos os participantes do concurso (user_ids únicos)
    SELECT ARRAY_AGG(DISTINCT user_id)
    INTO contest_participants
    FROM participations
    WHERE contest_id = NEW.id
      AND status = 'active'
      AND user_id IS NOT NULL;
    
    -- Se não há participantes, não fazer nada
    IF contest_participants IS NULL OR array_length(contest_participants, 1) = 0 THEN
      RETURN NEW;
    END IF;
    
    -- Filtrar participantes que têm notificação de finalização habilitada
    SELECT ARRAY_AGG(user_id)
    INTO allowed_user_ids
    FROM notification_preferences
    WHERE user_id = ANY(contest_participants)
      AND enabled = true
      AND notify_contest_finished = true;
    
    -- Se não há usuários com notificação habilitada, não fazer nada
    IF allowed_user_ids IS NULL OR array_length(allowed_user_ids, 1) = 0 THEN
      RETURN NEW;
    END IF;
    
    -- Criar notificações para todos os participantes habilitados
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      link,
      data,
      read_at,
      created_at
    )
    SELECT
      uid,
      'contest_finished',
      '🏆 Concurso Finalizado!',
      COALESCE(contest_name, 'Um concurso') || ' foi finalizado. Confira o resultado!',
      '/contests/' || NEW.id::text || '/ranking',
      jsonb_build_object(
        'contest_id', NEW.id,
        'contest_name', contest_name,
        'finished_at', NOW()
      ),
      NULL,
      NOW()
    FROM unnest(allowed_user_ids) AS uid;
    
    -- Log para debug
    RAISE NOTICE 'Notificações criadas para % participantes do concurso % (finalizado)', 
      array_length(allowed_user_ids, 1), NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger AFTER UPDATE na tabela contests
CREATE TRIGGER trigger_notify_on_contest_finished
  AFTER UPDATE ON contests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_contest_finished();

-- Comentários explicativos
COMMENT ON FUNCTION notify_on_contest_finished() IS 
  'Cria notificações automáticas para participantes quando um concurso é finalizado';

COMMENT ON TRIGGER trigger_notify_on_contest_finished ON contests IS 
  'Trigger que cria notificações quando o status do concurso muda para finished';
