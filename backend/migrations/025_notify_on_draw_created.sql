-- ============================================
-- Migração 025: Notificação automática quando sorteio é criado
-- ============================================
-- Inclui no início DROP idempotente da função/trigger (reexecução segura).
-- ============================================

DROP TRIGGER IF EXISTS trigger_notify_on_draw_created ON public.draws;
DROP FUNCTION IF EXISTS public.notify_on_draw_created();

-- Função que cria notificações quando um sorteio é criado
-- SECURITY DEFINER permite que a função execute com privilégios do criador,
-- necessário para contornar RLS ao inserir notificações
CREATE OR REPLACE FUNCTION notify_on_draw_created()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contest_name TEXT;
  contest_participants UUID[];
  allowed_user_ids UUID[];
BEGIN
  -- Buscar nome do concurso
  SELECT name INTO contest_name
  FROM contests
  WHERE id = NEW.contest_id;
  
  -- Buscar todos os participantes do concurso (user_ids únicos)
  SELECT ARRAY_AGG(DISTINCT user_id)
  INTO contest_participants
  FROM participations
  WHERE contest_id = NEW.contest_id
    AND status = 'active'
    AND user_id IS NOT NULL;
  
  -- Se não há participantes, não fazer nada
  IF contest_participants IS NULL OR array_length(contest_participants, 1) = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Filtrar participantes que têm notificação de sorteio habilitada
  SELECT ARRAY_AGG(user_id)
  INTO allowed_user_ids
  FROM notification_preferences
  WHERE user_id = ANY(contest_participants)
    AND enabled = true
    AND notify_draw_done = true;
  
  -- Se não há usuários com notificação habilitada, não fazer nada
  IF allowed_user_ids IS NULL OR array_length(allowed_user_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Criar notificações para todos os participantes habilitados
  -- MODIFIQUEI AQUI - Usar apenas campos que sempre existem na tabela draws
  -- O campo 'code' é opcional e não será incluído para evitar erros se a migração 014 (código do sorteio) não foi executada
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
    'draw_done',
    '🎯 Sorteio realizado!',
    COALESCE(contest_name, 'Um concurso') || ' teve um novo sorteio realizado. Confira os números sorteados!',
    '/contests/' || NEW.contest_id::text,
    jsonb_build_object(
      'contest_id', NEW.contest_id,
      'contest_name', contest_name,
      'draw_id', NEW.id,
      'draw_date', NEW.draw_date
    ),
    NULL,
    NOW()
  FROM unnest(allowed_user_ids) AS uid;
  
  -- Log para debug
  RAISE NOTICE 'Notificações criadas para % participantes do concurso % (sorteio criado)', 
    array_length(allowed_user_ids, 1), NEW.contest_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger AFTER INSERT na tabela draws
CREATE TRIGGER trigger_notify_on_draw_created
  AFTER INSERT ON draws
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_draw_created();

-- Comentários explicativos
COMMENT ON FUNCTION notify_on_draw_created() IS 
  'Cria notificações automáticas para participantes quando um novo sorteio é criado';

COMMENT ON TRIGGER trigger_notify_on_draw_created ON draws IS 
  'Trigger que cria notificações quando um novo sorteio é inserido na tabela draws';
