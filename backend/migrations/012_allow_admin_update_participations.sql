-- ============================================
-- Migração 012: Permitir UPDATE de participações para admins
-- FASE 1: Fundação do Sistema
-- ============================================
-- 
-- Esta migração adiciona uma policy RLS para permitir que administradores
-- atualizem participações, necessário para ativação manual de participações
-- pendentes após registro de pagamento em dinheiro.
-- 
-- Objetivo:
-- - Permitir que admins atualizem o status de participações (pending -> active)
-- - Necessário para funcionalidade de ativação manual na página AdminActivations
-- - Manter segurança: apenas admins podem fazer UPDATE
--
-- Contexto:
-- - A migração 006_rls_participations.sql bloqueou UPDATE para todos
-- - Agora precisamos permitir UPDATE apenas para administradores
-- ============================================

-- ============================================
-- POLICY: UPDATE participações (Admin)
-- ============================================
-- 
-- Permite que apenas administradores atualizem participações.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu perfil
-- 
-- Motivo:
-- - Administradores precisam ativar participações após registro de pagamento
-- - Necessário para mudança de status (pending -> active)
-- - Permite atualização de outros campos se necessário (ex: current_score)
-- 
-- Uso:
-- - Ativação manual de participações na página AdminActivations
-- - Atualização de status após pagamento em dinheiro
-- - Correção de dados de participações quando necessário
-- ============================================
DROP POLICY IF EXISTS "Admins can update participations" ON public.participations;

CREATE POLICY "Admins can update participations"
  ON public.participations
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
  );

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. Segurança:
--    - Apenas administradores podem fazer UPDATE
--    - Usuários comuns continuam sem permissão de UPDATE
--    - Mantém o princípio de menor privilégio
--
-- 2. Campos que podem ser atualizados:
--    - status: Status da participação (pending, active, cancelled)
--    - current_score: Pontuação atual da participação
--    - updated_at: Atualizado automaticamente via trigger
--    - ticket_code: Código único da participação (se necessário)
--
-- 3. Uso principal:
--    - Ativação de participações após pagamento em dinheiro
--    - Atualização de pontuação após sorteios
--    - Correção de dados administrativos
-- ============================================
