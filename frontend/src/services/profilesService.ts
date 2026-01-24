/**
 * Serviço de acesso a dados de perfis
 * FASE 1: Autenticação administrativa
 * 
 * Funções para buscar e verificar permissões de usuários
 */
import { supabase } from '../lib/supabase'
import { User } from '../types'

/**
 * Busca o perfil completo do usuário logado
 * Inclui informações de is_admin
 */
export async function getCurrentUserProfile(): Promise<User | null> {
  try {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('Erro ao obter usuário autenticado:', authError)
      return null
    }
    
    if (!authUser) {
      console.log('Nenhum usuário autenticado')
      return null
    }

    return await getUserProfileById(authUser.id)
  } catch (error) {
    console.error('Erro inesperado ao buscar perfil:', error)
    return null
  }
}

/**
 * Busca o perfil de um usuário por ID
 * Útil quando já temos o userId disponível
 */
export async function getUserProfileById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Perfil não encontrado
        console.warn('Perfil não encontrado para o usuário:', userId)
        return null
      }
      console.error('Erro ao buscar perfil:', error)
      throw new Error(`Erro ao buscar perfil: ${error.message}`)
    }

    console.log('Perfil carregado com sucesso:', { id: data?.id, is_admin: data?.is_admin })
    return data
  } catch (error) {
    console.error('Erro inesperado ao buscar perfil por ID:', error)
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
