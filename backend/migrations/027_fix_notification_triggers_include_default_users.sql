-- ============================================
-- Migração 027: Corrigir notificações para usuários sem preferências
-- ============================================
--
-- Problema: Usuários não recebiam notificações de "sorteio realizado" e
-- "concurso finalizado" porque os triggers só incluíam quem tinha uma linha
-- em notification_preferences com enabled=true e notify_X=true.
-- Usuários que nunca acessaram Configurações não têm linha → não recebiam.
--
-- Solução: Incluir participantes que:
-- (a) NÃO têm linha em notification_preferences (recebem por padrão), OU
-- (b) Têm enabled=true E notify_draw_done/notify_contest_finished=true
--
-- Excluir apenas quem explicitamente desativou (enabled=false ou notify_X=false).
--
-- ============================================

-- ============================================
-- Sorteio realizado
-- ============================================
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
  SELECT name INTO contest_name
  FROM contests
  WHERE id = NEW.contest_id;
  
  SELECT ARRAY_AGG(DISTINCT user_id)
  INTO contest_participants
  FROM participations
  WHERE contest_id = NEW.contest_id
    AND status = 'active'
    AND user_id IS NOT NULL;
  
  IF contest_participants IS NULL OR array_length(contest_participants, 1) = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Incluir: sem preferências OU com enabled=true e notify_draw_done=true
  -- Excluir: enabled=false OU notify_draw_done=false
  SELECT ARRAY_AGG(uid)
  INTO allowed_user_ids
  FROM unnest(contest_participants) AS uid
  WHERE NOT EXISTS (
    SELECT 1 FROM notification_preferences np
    WHERE np.user_id = uid
  )
  OR EXISTS (
    SELECT 1 FROM notification_preferences np
    WHERE np.user_id = uid
      AND np.enabled = true
      AND np.notify_draw_done = true
  );
  
  IF allowed_user_ids IS NULL OR array_length(allowed_user_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;
  
  INSERT INTO notifications (
    user_id, type, title, message, link, data, read_at, created_at
  )
  SELECT
    uid, 'draw_done', '🎯 Sorteio realizado!',
    COALESCE(contest_name, 'Um concurso') || ' teve um novo sorteio realizado. Confira os números sorteados!',
    '/contests/' || NEW.contest_id::text,
    jsonb_build_object('contest_id', NEW.contest_id, 'contest_name', contest_name, 'draw_id', NEW.id, 'draw_date', NEW.draw_date),
    NULL, NOW()
  FROM unnest(allowed_user_ids) AS uid;
  
  RAISE NOTICE 'Notificações criadas para % participantes (sorteio criado)', array_length(allowed_user_ids, 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Concurso finalizado
-- ============================================
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
  IF NEW.status = 'finished' AND (OLD.status IS NULL OR OLD.status != 'finished') THEN
    SELECT name INTO contest_name
    FROM contests
    WHERE id = NEW.id;
    
    SELECT ARRAY_AGG(DISTINCT user_id)
    INTO contest_participants
    FROM participations
    WHERE contest_id = NEW.id
      AND status = 'active'
      AND user_id IS NOT NULL;
    
    IF contest_participants IS NULL OR array_length(contest_participants, 1) = 0 THEN
      RETURN NEW;
    END IF;
    
    -- Incluir: sem preferências OU com enabled=true e notify_contest_finished=true
    SELECT ARRAY_AGG(uid)
    INTO allowed_user_ids
    FROM unnest(contest_participants) AS uid
    WHERE NOT EXISTS (
      SELECT 1 FROM notification_preferences np
      WHERE np.user_id = uid
    )
    OR EXISTS (
      SELECT 1 FROM notification_preferences np
      WHERE np.user_id = uid
        AND np.enabled = true
        AND np.notify_contest_finished = true
    );
    
    IF allowed_user_ids IS NULL OR array_length(allowed_user_ids, 1) = 0 THEN
      RETURN NEW;
    END IF;
    
    INSERT INTO notifications (
      user_id, type, title, message, link, data, read_at, created_at
    )
    SELECT
      uid, 'contest_finished', '🏆 Concurso Finalizado!',
      COALESCE(contest_name, 'Um concurso') || ' foi finalizado. Confira o resultado!',
      '/contests/' || NEW.id::text || '/ranking',
      jsonb_build_object('contest_id', NEW.id, 'contest_name', contest_name, 'finished_at', NOW()),
      NULL, NOW()
    FROM unnest(allowed_user_ids) AS uid;
    
    RAISE NOTICE 'Notificações criadas para % participantes (concurso finalizado)', array_length(allowed_user_ids, 1);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
