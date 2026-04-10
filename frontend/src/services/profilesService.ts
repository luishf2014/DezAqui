/**
 * Serviço de acesso a dados de perfis
 * FASE 1: Autenticação administrativa
 * 
 * Funções para buscar e verificar permissões de usuários
 */
import { supabase } from '../lib/supabase'
import { User } from '../types'

// MODIFIQUEI AQUI - Interface para tipar erros do Supabase
interface SupabaseError {
  code?: string
  message?: string
  details?: string
  hint?: string
}

/**
 * Busca o perfil completo do usuário logado
 * Inclui informações de is_admin
 * MODIFIQUEI AQUI - Usa uma abordagem mais direta que funciona melhor com RLS
 */
export async function getCurrentUserProfile(): Promise<User | null> {
  try {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('[profilesService] Erro ao obter usuário autenticado:', authError)
      return null
    }
    
    if (!authUser) {
      console.log('[profilesService] Nenhum usuário autenticado')
      return null
    }

    // MODIFIQUEI AQUI - Buscar usando o ID do usuário autenticado
    // A política RLS permite que usuários vejam seu próprio perfil quando id = auth.uid()
    console.log('[profilesService] Buscando perfil do usuário atual usando RLS...')
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, phone, cpf, birth_date, is_admin, created_at, updated_at')
      .eq('id', authUser.id)
      .maybeSingle()
    
    if (error) {
      console.error('[profilesService] Erro ao buscar perfil do usuário atual:', error)
      return await getUserProfileById(authUser.id)
    }
    
    if (!data) {
      console.warn('[profilesService] Perfil não encontrado para o usuário atual')
      return await getUserProfileById(authUser.id)
    }
    
    // Normalizar is_admin
    const normalizedData = {
      ...data,
      is_admin: typeof data.is_admin === 'string' 
        ? data.is_admin.toLowerCase() === 'true' 
        : Boolean(data.is_admin)
    }
    
    console.log('[profilesService] ✅ Perfil do usuário atual carregado:', normalizedData)
    return normalizedData
  } catch (error) {
    console.error('[profilesService] Erro inesperado ao buscar perfil:', error)
    return null
  }
}

/**
 * Busca o perfil de um usuário por ID.
 * No cliente, use normalmente o ID da sessão (`auth.getUser()` / `user.id` do AuthContext).
 * Administradores podem ler qualquer perfil via RLS; telas como Configurações devem passar
 * apenas o ID do usuário logado para não expor dados de terceiros por engano.
 */
export async function getUserProfileById(userId: string): Promise<User | null> {
  try {
    console.log('[profilesService] Buscando perfil para userId:', userId)
    
    // MODIFIQUEI AQUI - Busca principal pelo id do profile
    const byId = await supabase
      .from('profiles')
      .select('id, email, name, phone, cpf, birth_date, is_admin, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle()
    
    // MODIFIQUEI AQUI - Logar o RESULTADO COMPLETO após maybeSingle()
    console.log('[profilesService] byId', { userId, data: byId.data, error: byId.error })

    if (byId.data) {
      // MODIFIQUEI AQUI - Normalizar is_admin para boolean
      const normalized = {
        ...byId.data,
        is_admin: typeof byId.data.is_admin === 'string' 
          ? byId.data.is_admin.toLowerCase() === 'true' 
          : Boolean(byId.data.is_admin)
      }
      console.log('[profilesService] ✅ Perfil encontrado por id:', normalized)
      return normalized
    }

    // MODIFIQUEI AQUI - Removido fallback para user_id (coluna não existe no schema)
    // O schema usa apenas 'id' como chave primária que referencia auth.users(id)

    console.warn('[profilesService] ⚠️ Perfil não encontrado para userId:', userId)
    
    // MODIFIQUEI AQUI - Log detalhado do erro para diagnóstico
    if (byId.error) {
      const error = byId.error as SupabaseError
      console.error('[profilesService] Erro detalhado:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      // MODIFIQUEI AQUI - Se for erro de recursão infinita, indicar que precisa corrigir RLS
      if (error.code === '42P17' || error.message?.includes('infinite recursion')) {
        console.error('[profilesService] 🚨 ERRO DE RECURSÃO INFINITA NA POLÍTICA RLS!')
        console.error('[profilesService] A política RLS está causando recursão infinita.')
        console.error('[profilesService] Execute o SQL de correção em backend/migrations/007_fix_rls_profiles_select.sql')
      }
    }
    
    return null
  } catch (error) {
    console.error('[profilesService] Erro inesperado ao buscar perfil por ID:', error)
    return null
  }
}

/**
 * Verifica se o usuário atual é administrador
 * Retorna false se não houver usuário logado ou se não for admin
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const profile = await getCurrentUserProfile()
  return profile?.is_admin ?? false
}

/**
 * Busca todos os usuários cadastrados no sistema
 * Função para administradores listarem todos os perfis
 */
export async function listAllUsers(): Promise<User[]> {
  try {
    console.log('[profilesService] Buscando todos os usuários...')
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, phone, cpf, birth_date, is_admin, created_at, updated_at')
      .order('name')
    
    if (error) {
      console.error('[profilesService] Erro ao buscar todos os usuários:', error)
      throw new Error(`Erro ao carregar usuários: ${error.message}`)
    }
    
    // Normalizar is_admin para todos os usuários
    const normalizedUsers = (data || []).map(user => ({
      ...user,
      is_admin: typeof user.is_admin === 'string' 
        ? user.is_admin.toLowerCase() === 'true' 
        : Boolean(user.is_admin)
    }))
    
    console.log('[profilesService] ✅ Usuários carregados:', normalizedUsers.length)
    return normalizedUsers
  } catch (error) {
    console.error('[profilesService] Erro inesperado ao buscar todos os usuários:', error)
    throw error
  }
}
