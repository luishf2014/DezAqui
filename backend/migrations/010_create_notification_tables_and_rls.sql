-- ============================================
-- Migração 010: Tabelas de notificações e preferências
-- ============================================
-- Deve executar ANTES de 024+ (triggers e funções que inserem em notifications).
-- Requer: 001 (profiles, contests, participations) e 003 (is_admin) para a política de admin.
-- ============================================

-- Preferências do utilizador
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notify_draw_done BOOLEAN NOT NULL DEFAULT true,
  notify_contest_finished BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_preferences IS 'Preferências de notificação in-app e canais.';

-- Notificações in-app
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(user_id) WHERE read_at IS NULL;

COMMENT ON TABLE public.notifications IS 'Notificações exibidas no sininho e em /notifications.';

-- RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Preferências: só o próprio utilizador
DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notificações: leitura e update do próprio
DROP POLICY IF EXISTS "Users select own notifications" ON public.notifications;
CREATE POLICY "Users select own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin pode criar notificações para utilizadores (ex.: painel Admin)
DROP POLICY IF EXISTS "Admin insert notifications" ON public.notifications;
CREATE POLICY "Admin insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Inserções a partir de triggers SECURITY DEFINER: conforme o dono da função no Supabase, podem contornar RLS.
