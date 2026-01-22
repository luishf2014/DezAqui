-- ============================================
-- Migração 004: Row Level Security (RLS) - Draws
-- FASE 2: Segurança e Autenticação
-- ============================================
-- 
-- Esta migração habilita Row Level Security (RLS) na tabela draws,
-- garantindo que usuários só possam visualizar sorteios de concursos ativos,
-- enquanto administradores podem criar sorteios e visualizar todos.
-- 
-- Objetivo:
-- Implementar segurança em nível de linha para proteger eventos históricos
-- de sorteios, garantindo imutabilidade após inserção e controle de acesso
-- baseado no status do concurso relacionado.
--
-- Regras de acesso:
-- 1. Usuários autenticados comuns podem SELECT apenas draws de concursos com status = 'active'
-- 2. Administradores podem SELECT todos os draws e INSERT novos draws
-- 3. UPDATE e DELETE são bloqueados para todos (imutabilidade)
-- 4. Usuários não autenticados não podem acessar a tabela
--
-- Imutabilidade:
-- - Draws são eventos históricos e não devem ser alterados ou deletados
-- - A ausência de policies de UPDATE e DELETE garante imutabilidade
-- - Apenas INSERT é permitido (para administradores criar novos sorteios)
--
-- Respeitando o modelo de domínio definido em docs/01_domain_model.md
-- ============================================

-- ============================================
-- HABILITAR ROW LEVEL SECURITY
-- ============================================
-- 
-- Habilita RLS na tabela draws.
-- Após habilitar, todas as operações serão bloqueadas por padrão,
-- exceto aquelas explicitamente permitidas pelas policies abaixo.
-- ============================================
ALTER TABLE public.draws
  ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICY: SELECT draws de concursos ativos (Usuário comum)
-- ============================================
-- 
-- Permite que usuários autenticados visualizem apenas sorteios de concursos ativos.
-- 
-- Condição:
-- - O concurso relacionado (contest_id) deve ter status = 'active'
-- 
-- Motivo:
-- - Usuários só precisam ver sorteios de concursos em que podem participar
-- - Sorteios de concursos finalizados ou cancelados não são relevantes para usuários comuns
-- - Protege dados históricos de concursos não ativos
-- 
-- Uso:
-- - Visualização de sorteios em concursos ativos
-- - Histórico de sorteios para concursos em andamento
-- ============================================
DROP POLICY IF EXISTS "Users can view draws from active contests" ON public.draws;

CREATE POLICY "Users can view draws from active contests"
  ON public.draws
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contests
      WHERE contests.id = draws.contest_id
        AND contests.status = 'active'
    )
  );

-- ============================================
-- POLICY: SELECT todos os draws (Admin)
-- ============================================
-- 
-- Permite que administradores visualizem todos os sorteios do sistema.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu perfil
-- 
-- Motivo:
-- - Administradores precisam gerenciar todos os sorteios
-- - Necessário para painel administrativo e relatórios históricos
-- - Permite visualização de sorteios de concursos em qualquer status
-- 
-- Uso:
-- - Painel administrativo lista todos os sorteios
-- - Administradores podem visualizar qualquer sorteio para gestão
-- ============================================
DROP POLICY IF EXISTS "Admins can view all draws" ON public.draws;

CREATE POLICY "Admins can view all draws"
  ON public.draws
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
-- POLICY: INSERT draws (Admin)
-- ============================================
-- 
-- Permite que apenas administradores criem novos sorteios.
-- 
-- Condição:
-- - O usuário autenticado deve ter is_admin = true em seu perfil
-- 
-- Motivo:
-- - Criação de sorteios é uma operação administrativa sensível
-- - Apenas administradores devem ter permissão para lançar sorteios
-- - Garante controle sobre eventos históricos do sistema
-- 
-- Uso:
-- - Lançamento de sorteios no painel administrativo
-- - Criação de sorteios programados ou manuais
-- ============================================
DROP POLICY IF EXISTS "Admins can insert draws" ON public.draws;

CREATE POLICY "Admins can insert draws"
  ON public.draws
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
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. UPDATE não tem policy:
--    - Nenhuma policy de UPDATE foi criada
--    - UPDATE está bloqueado para todos os usuários (incluindo admins)
--    - Draws são eventos históricos imutáveis após criação
--    - Se correção for necessária, considere criar um novo draw ou usar funções específicas
--
-- 2. DELETE não tem policy:
--    - Nenhuma policy de DELETE foi criada
--    - DELETE está bloqueado para todos os usuários (incluindo admins)
--    - Draws são eventos históricos e não devem ser deletados
--    - Se exclusão for necessária, use soft delete ou funções administrativas específicas
--
-- 3. Políticas de SELECT:
--    - Policies são avaliadas em OR (qualquer uma que passar permite acesso)
--    - Usuários comuns só veem draws de concursos 'active'
--    - Admins veem todos os draws (incluindo os de concursos ativos)
--    - O índice idx_draws_contest_id otimiza a query de usuários comuns
--    - O índice idx_contests_status otimiza a verificação de status
--
-- 4. Verificação de Admin:
--    - Todas as policies de admin usam a mesma subquery
--    - Verifica se o usuário atual tem is_admin = true em profiles
--    - O índice idx_profiles_is_admin otimiza essa verificação
--
-- 5. Verificação de Concurso Ativo:
--    - A policy de SELECT para usuários comuns usa EXISTS com join em contests
--    - Verifica se o concurso relacionado tem status = 'active'
--    - Garante que apenas sorteios de concursos ativos sejam visíveis
--
-- 6. Usuários não autenticados:
--    - Não há policies para role 'anon' ou 'public'
--    - Usuários não autenticados não podem acessar draws
--    - Isso garante que apenas usuários logados vejam sorteios
--
-- 7. Performance:
--    - O índice idx_draws_contest_id ajuda na policy de SELECT para usuários comuns
--    - O índice idx_contests_status ajuda na verificação de status
--    - O índice idx_profiles_is_admin ajuda na verificação de admin
--    - auth.uid() é otimizado pelo Supabase
--
-- 8. Segurança:
--    - RLS funciona mesmo se o cliente tentar bypassar validações do frontend
--    - Todas as queries são validadas no banco de dados
--    - Policies são aplicadas a todas as operações, incluindo via Admin API (se não usar service_role)
--    - Imutabilidade é garantida pela ausência de policies de UPDATE/DELETE
--
-- 9. Testes recomendados:
--    - Criar usuário comum e verificar que só vê draws de concursos 'active'
--    - Criar concurso 'active' e 'finished', criar draws para ambos
--    - Verificar que usuário comum só vê draws do concurso 'active'
--    - Criar usuário admin e verificar que vê todos os draws
--    - Criar usuário admin e verificar que pode INSERT draws
--    - Tentar UPDATE como qualquer usuário (deve falhar - sem policy)
--    - Tentar DELETE como qualquer usuário (deve falhar - sem policy)
--    - Verificar que usuário não autenticado não acessa draws
--
-- 10. Próximas fases:
--     - FASE 4: Implementar lógica de sorteios automáticos
--     - FASE 4: Adicionar validações de números sorteados
--     - FASE 4: Implementar recálculo de pontuação após novos sorteios
-- ============================================
