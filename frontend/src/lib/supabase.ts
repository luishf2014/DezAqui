/**
 * ============================================
 * Cliente Supabase
 * FASE 1: Fundação do Sistema
 * ============================================
 * 
 * Este arquivo é responsável pela configuração e inicialização
 * do cliente Supabase para conexão com o backend.
 * 
 * Responsabilidades:
 * - Ler variáveis de ambiente (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY)
 * - Validar que as variáveis estão configuradas
 * - Criar e exportar o cliente Supabase para uso na aplicação
 * 
 * IMPORTANTE:
 * - Nunca hardcodar credenciais neste arquivo
 * - As variáveis devem estar no arquivo .env.local (desenvolvimento)
 * - O arquivo .env.local está no .gitignore e não será commitado
 * - Para produção, configure as variáveis no ambiente do servidor
 * 
 * Próximas fases:
 * - FASE 2: Autenticação será implementada usando este cliente
 * ============================================
 */

import { createClient } from '@supabase/supabase-js'

// Leitura das variáveis de ambiente do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validação: garantir que as variáveis estão configuradas
// Isso evita erros silenciosos e fornece feedback claro ao desenvolvedor
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '❌ Variáveis de ambiente do Supabase não configuradas.\n\n' +
    'Por favor, verifique:\n' +
    '1. O arquivo .env.local existe na raiz do projeto frontend/\n' +
    '2. As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidas\n' +
    '3. O servidor de desenvolvimento foi reiniciado após criar/editar o .env.local\n\n' +
    'Consulte o arquivo ENV_SETUP.md para mais detalhes.'
  )
}

// Criação e exportação do cliente Supabase
// Este cliente será usado em toda a aplicação para acessar o backend
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/**
 * Com o separador em segundo plano, o browser atrasa timers e o refresh do token pode falhar.
 * Ao voltar, a sessão fica “stale” e os pedidos podem falhar ou parecer timeout.
 * Padrão recomendado pelo Supabase para SPAs.
 */
if (typeof document !== 'undefined') {
  const syncAuthAutoRefresh = () => {
    try {
      if (document.visibilityState === 'visible') {
        void supabase.auth.startAutoRefresh()
      } else {
        supabase.auth.stopAutoRefresh()
      }
    } catch {
      // ignora ambientes estranhos (SSR, WebView, etc.)
    }
  }
  document.addEventListener('visibilitychange', syncAuthAutoRefresh)
  syncAuthAutoRefresh()
}
