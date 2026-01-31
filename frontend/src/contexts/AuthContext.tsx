/**
 * Contexto de Autenticação
 * 
 * Gerencia o estado de autenticação do usuário.
 * FASE 1: Estrutura base + verificação de admin
 */
import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getUserProfileById } from '../services/profilesService'
import { User as ProfileUser } from '../types'

interface AuthContextType {
  user: User | null
  profile: ProfileUser | null
  isAdmin: boolean
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  logout: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileUser | null>(null)
  const [loading, setLoading] = useState(true)
  const isInitializedRef = useRef(false)

  const loadProfile = async (userId: string | undefined, retryCount = 0): Promise<void> => {
    if (!userId) {
      console.log('[AuthContext] loadProfile: userId não fornecido')
      setProfile(null)
      return
    }

    try {
      // MODIFIQUEI AQUI - Buscar perfil diretamente usando getUserProfileById
      const userProfile = await getUserProfileById(userId)
      
      // MODIFIQUEI AQUI - Logar o retorno completo do profilesService (mantido conforme solicitado)
      console.log('[AuthContext] Resultado do getUserProfileById:', { 
        userId,
        retornouNull: userProfile === null,
        retornouUndefined: userProfile === undefined,
        id: userProfile?.id, 
        email: userProfile?.email,
        is_admin: userProfile?.is_admin,
        tipoIsAdmin: typeof userProfile?.is_admin,
        fullProfile: userProfile,
        retryCount
      })
      
      if (userProfile === null || userProfile === undefined) {
        // MODIFIQUEI AQUI - Retry para novos usuários (perfil pode estar sendo criado pelo trigger)
        if (retryCount < 3) {
          console.log(`[AuthContext] Perfil não encontrado, tentando novamente em ${(retryCount + 1) * 500}ms... (tentativa ${retryCount + 1}/3)`)
          await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 500))
          return loadProfile(userId, retryCount + 1)
        }
        
        console.error('[AuthContext] ⚠️ ATENÇÃO: Não foi possível carregar o perfil após 3 tentativas!')
        console.error('[AuthContext] Isso pode acontecer se o trigger de criação de perfil ainda não executou.')
        setProfile(null)
        return
      }
      
      // MODIFIQUEI AQUI - Atualizar profile no state
      setProfile(userProfile)
    } catch (error) {
      // MODIFIQUEI AQUI - NÃO falhar silenciosamente
      console.error('[AuthContext] Erro ao carregar perfil:', error)
      
      // MODIFIQUEI AQUI - Retry em caso de erro também
      if (retryCount < 2) {
        console.log(`[AuthContext] Erro ao carregar perfil, tentando novamente em ${(retryCount + 1) * 500}ms... (tentativa ${retryCount + 1}/2)`)
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 500))
        return loadProfile(userId, retryCount + 1)
      }
      
      setProfile(null)
    }
  }

  useEffect(() => {
    let isMounted = true
    
    // MODIFIQUEI AQUI - Verificar sessão atual e carregar profile
    const initializeAuth = async () => {
      try {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!isMounted) return
        
        setUser(session?.user ?? null)
        
        if (session?.user?.id) {
          await loadProfile(session.user.id)
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.error('[AuthContext] Erro ao inicializar autenticação:', error)
        if (isMounted) {
          setProfile(null)
        }
      } finally {
        if (isMounted) {
          isInitializedRef.current = true
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // MODIFIQUEI AQUI - Escutar mudanças de autenticação e garantir que profile seja carregado SEMPRE após SIGNED_IN
    // Ignora o evento inicial se já foi processado pelo getSession
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[AuthContext] onAuthStateChange:', _event, { userId: session?.user?.id })
      
      if (!isMounted) return
      
      // MODIFIQUEI AQUI - Ignorar evento SIGNED_IN inicial se já foi processado pelo getSession
      // Isso evita carregar o profile duas vezes quando há sessão persistente
      if (_event === 'SIGNED_IN' && !isInitializedRef.current) {
        console.log('[AuthContext] Ignorando SIGNED_IN inicial, já processado por getSession')
        return
      }
      
      // MODIFIQUEI AQUI - Não resetar user se já está logado e é o mesmo usuário (evita perda de estado)
      const currentUserId = session?.user?.id
      const existingUserId = user?.id
      
      if (currentUserId === existingUserId && _event === 'TOKEN_REFRESHED') {
        // Token foi atualizado, mas é o mesmo usuário - não precisa recarregar tudo
        console.log('[AuthContext] Token atualizado para o mesmo usuário, mantendo estado')
        return
      }
      
      setUser(session?.user ?? null)
      
      // MODIFIQUEI AQUI - Só setar loading se realmente houver mudança de usuário ou logout
      if (currentUserId !== existingUserId) {
        setLoading(true)
      }
      
      try {
        if (session?.user?.id) {
          // MODIFIQUEI AQUI - Só recarregar perfil se for usuário diferente ou primeiro login
          if (currentUserId !== existingUserId || !profile) {
            // MODIFIQUEI AQUI - Pequeno delay após SIGNED_IN para dar tempo do trigger criar o perfil
            if (_event === 'SIGNED_IN') {
              await new Promise(resolve => setTimeout(resolve, 300))
            }
            await loadProfile(session.user.id)
          }
        } else {
          // Logout - limpar estado
          setProfile(null)
          setLoading(false)
        }
      } catch (error) {
        // MODIFIQUEI AQUI - NÃO falhar silenciosamente
        console.error('[AuthContext] Erro ao carregar perfil no onAuthStateChange:', error)
        if (isMounted) {
          setProfile(null)
        }
      } finally {
        // MODIFIQUEI AQUI - Garantir que loading finalize sempre após loadProfile terminar
        if (isMounted && currentUserId !== existingUserId) {
          setLoading(false)
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // MODIFIQUEI AQUI - Calcular isAdmin exclusivamente como profile?.is_admin === true
  // Se profile não existe ainda (novo usuário), assume que não é admin
  const isAdmin = profile?.is_admin === true

  // MODIFIQUEI AQUI - Função de logout centralizada
  const logout = async (): Promise<void> => {
    try {
      console.log('[AuthContext] Iniciando logout...')
      // Limpar estado local primeiro
      setUser(null)
      setProfile(null)
      setLoading(true)
      
      // Fazer signOut no Supabase
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('[AuthContext] Erro ao fazer logout:', error)
        throw error
      }
      
      console.log('[AuthContext] Logout realizado com sucesso')
    } catch (error) {
      console.error('[AuthContext] Erro inesperado ao fazer logout:', error)
      // Mesmo com erro, limpar o estado local
      setUser(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  // MODIFIQUEI AQUI - Log para debug do isAdmin
  useEffect(() => {
    if (user) {
      console.log('[AuthContext] Estado atual:', {
        userId: user.id,
        hasProfile: !!profile,
        profileId: profile?.id,
        is_admin: profile?.is_admin,
        isAdminCalculated: isAdmin,
        loading
      })
    }
  }, [user, profile, isAdmin, loading])

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}