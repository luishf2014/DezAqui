-- ============================================
-- Migração 005: Row Level Security (RLS) - Payments
-- FASE 2: Segurança e Autenticação
-- ============================================
-- 
-- Esta migração habilita Row Level Security (RLS) na tabela payments,
-- garantindo que usuários só possam visualizar pagamentos relacionados
-- às suas próprias participações, enquanto administradores têm acesso
-- completo para gestão financeira.
-- 
-- Objetivo:
-- Implementar segurança em nível de linha para proteger dados financeiros,
-- garantindo auditabilidade (sem DELETE) e controle de acesso baseado
-- na relação entre pagamentos e participações do usuário.
--
-- Regras de acesso:
-- 1. Usuários autenticados comuns podem SELECT apenas pagamentos de suas próprias participações
-- 2. Administradores podem SELECT, INSERT e UPDATE todos os pagamentos
-- 3. DELETE é bloqueado para todos (auditabilidade)
-- 4. Usuários não autenticados não podem acessar a tabela
--
-- Relação de dados:
-- - payments.participation_id -> participations.id -> participations.user_id = auth.uid()
-- - Usuários só veem pagamentos de participações que lhes pertencem
--
-- Auditabilidade:
-- - Pagamentos são eventos financeiros e não devem ser deletados
-- - A ausência de policy de DELETE garante auditabilidade completa
-- - Apenas UPDATE é permitido para admins (atualização de status, confirmação, etc.)
--
-- Respeitando o modelo de domínio definido em docs/01_domain_model.md
-- ============================================

-- ============================================
-- HABILITAR ROW LEVEL SECURITY
-- ============================================
-- 
-- Habilita RLS na tabela payments.
-- Após habilitar, todas as operações serão bloqueadas por padrão,
-- exceto aquelas explicitamente permitidas pelas policies abaixo.
-- ============================================
ALTER TABLE public.payments
  ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICY: SELECT próprios pagamentos (Usuário comum)
-- ============================================
-- 
-- Permite que usuários autenticados visualizem apenas pagamentos
-- relacionados às suas próprias participações.
-- 
-- Condição:
-- - O pagamento deve estar associado a uma participação (participation_id)
-- - A participação deve pertencer ao usuário autenticado (participations.user_id = auth.uid())
-- 
-- Motivo:
-- - Usuários não devem ver pagamentos de outros usuários
-- - Protege dados financeiros sensíveis de outros participantes
-- - Permite que usuários acompanhem o status de seus próprios pagamentos
-- 
-- Uso:
-- - Usuário visualiza seus próprios pagamentos
-- - Listagem de pagamentos do usuário logado
-- - Acompanhamento de status de pagamento
-- ============================================
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;

CREATE POLICY "Users can view own payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.participations
      WHERE participations.id = payments.participation_id
        AND participations.user_id = auth.uid()
    )
  );

-- ============================================
-- POLICY: SELECT todos os pagamentos (Admin)
-- ============================================
-- 
-- Permite que administradores visualizem todos os pagamentos do sistema.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu perfil
-- 
-- Motivo:
-- - Administradores precisam gerenciar todos os pagamentos
-- - Necessário para painel administrativo e relatórios financeiros
-- - Permite visualização completa para auditoria e gestão
-- 
-- Uso:
-- - Painel administrativo lista todos os pagamentos
-- - Administradores podem visualizar qualquer pagamento para gestão
-- - Relatórios financeiros e auditoria
-- ============================================
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;

CREATE POLICY "Admins can view all payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- ============================================
-- POLICY: INSERT pagamentos (Admin)
-- ============================================
-- 
-- Permite que apenas administradores criem novos pagamentos.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu perfil
-- 
-- Motivo:
-- - Criação de pagamentos é uma operação administrativa sensível
-- - Apenas administradores devem ter permissão para criar registros financeiros
-- - Garante controle sobre eventos financeiros do sistema
-- 
-- Uso:
-- - Criação manual de pagamentos no painel administrativo
-- - Registro de pagamentos offline ou em dinheiro
-- - Correção de dados ou migração de informações
-- ============================================
DROP POLICY IF EXISTS "Admins can insert payments" ON public.payments;

CREATE POLICY "Admins can insert payments"
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- ============================================
-- POLICY: UPDATE pagamentos (Admin)
-- ============================================
-- 
-- Permite que apenas administradores atualizem pagamentos existentes.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu perfil
-- 
-- Motivo:
-- - Atualização de pagamentos é necessária para gestão financeira
-- - Permite atualizar status, confirmação de pagamento, dados externos, etc.
-- - Apenas administradores devem modificar registros financeiros
-- 
-- Campos que podem ser atualizados:
-- - status: Status do pagamento (pending, paid, cancelled, refunded)
-- - paid_at: Data e hora do pagamento confirmado
-- - external_id: ID do pagamento na API externa (ex: Asaas)
-- - external_data: Dados adicionais do pagamento externo
-- - updated_at: Atualizado automaticamente via trigger
-- 
-- Uso:
-- - Confirmação de pagamento via webhook
-- - Atualização manual de status no painel administrativo
-- - Correção de dados de pagamento
-- ============================================
DROP POLICY IF EXISTS "Admins can update payments" ON public.payments;

CREATE POLICY "Admins can update payments"
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. DELETE não tem policy:
--    - Nenhuma policy de DELETE foi criada
--    - DELETE está bloqueado para todos os usuários (incluindo admins)
--    - Pagamentos são eventos financeiros e não devem ser deletados
--    - A ausência de DELETE garante auditabilidade completa
--    - Se exclusão for necessária, use soft delete (status = 'cancelled') ou funções específicas
--
-- 2. Políticas de SELECT:
--    - Policies são avaliadas em OR (qualquer uma que passar permite acesso)
--    - Usuários comuns só veem pagamentos de suas próprias participações
--    - Admins veem todos os pagamentos (incluindo os dos usuários comuns)
--    - O índice em participation_id otimiza a query de usuários comuns
--    - O índice idx_participations_user_id otimiza a verificação de propriedade
--
-- 3. Verificação de Admin:
--    - Todas as policies de admin usam a mesma subquery
--    - Verifica se o usuário atual tem is_admin = true em profiles
--    - O índice idx_profiles_is_admin otimiza essa verificação
--
-- 4. Relação com Participations:
--    - A policy de SELECT para usuários comuns usa EXISTS com join em participations
--    - Verifica se a participação pertence ao usuário autenticado
--    - Garante que apenas pagamentos de participações próprias sejam visíveis
--
-- 5. UPDATE Policy:
--    - Usa USING (para verificar linha existente) e WITH CHECK (para validar nova linha)
--    - Ambos verificam se o usuário é admin
--    - Garante que apenas admins podem modificar pagamentos
--
-- 6. Usuários não autenticados:
--    - Não há policies para role 'anon' ou 'public'
--    - Usuários não autenticados não podem acessar payments
--    - Isso garante que apenas usuários logados vejam dados financeiros
--
-- 7. Performance:
--    - O índice em participation_id ajuda na policy de SELECT para usuários comuns
--    - O índice idx_participations_user_id ajuda na verificação de propriedade
--    - O índice idx_profiles_is_admin ajuda na verificação de admin
--    - auth.uid() é otimizado pelo Supabase
--
-- 8. Segurança:
--    - RLS funciona mesmo se o cliente tentar bypassar validações do frontend
--    - Todas as queries são validadas no banco de dados
--    - Policies são aplicadas a todas as operações, incluindo via Admin API (se não usar service_role)
--    - Usuários não podem modificar participation_id para ver pagamentos de outros
--
-- 9. Auditabilidade:
--    - A ausência de policy de DELETE garante que todos os pagamentos sejam preservados
--    - Histórico completo de transações financeiras é mantido
--    - Facilita auditoria e compliance
--    - Permite rastreabilidade completa de eventos financeiros
--
-- 10. Testes recomendados:
--     - Criar usuário comum e verificar que só vê pagamentos de suas próprias participações
--     - Criar participação para usuário A e pagamento associado
--     - Verificar que usuário B não vê o pagamento do usuário A
--     - Criar usuário admin e verificar que vê todos os pagamentos
--     - Criar usuário admin e verificar que pode INSERT e UPDATE pagamentos
--     - Tentar DELETE como qualquer usuário (deve falhar - sem policy)
--     - Verificar que usuário não autenticado não acessa payments
--
-- 11. Próximas fases:
--     - FASE 3: Integração com API Asaas para pagamentos Pix
--     - FASE 3: Webhooks para confirmação automática de pagamento
--     - FASE 3: Ativação automática de participação após pagamento confirmado
--     - FASE 3+: Implementar soft delete se necessário (status = 'cancelled')
-- ============================================
