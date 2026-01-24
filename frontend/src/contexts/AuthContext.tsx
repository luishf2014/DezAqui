/**
 * Contexto de Autenticação
 * 
 * Gerencia o estado de autenticação do usuário.
 * FASE 1: Estrutura base + verificação de admin
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getUserProfileById } from '../services/profilesService'
import { User as ProfileUser } from '../types'

interface AuthContextType {
  user: User | null
  profile: ProfileUser | null
  isAdmin: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileUser | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId: string | undefined) => {
    if (!userId) {
      console.log('loadProfile: userId não fornecido')
      setProfile(null)
      return
    }

    try {
      console.log('Carregando perfil para userId:', userId)
      const userProfile = await getUserProfileById(userId)
      console.log('Perfil carregado:', userProfile)
      setProfile(userProfile)
    } catch (error) {
      console.error('Erro ao carregar perfil:', error)
      setProfile(null)
    }
  }

  useEffect(() => {
    // Verificar sessão atual
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      await loadProfile(session?.user?.id)
      setLoading(false)
    })

    // Escutar mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      await loadProfile(session?.user?.id)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const isAdmin = profile?.is_admin ?? false

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}