/**
 * Componente de rota protegida para administradores
 * FASE 1: Autenticação administrativa
 * 
 * Verifica se o usuário está autenticado e é administrador
 * antes de renderizar o conteúdo protegido
 */
import { Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedAdminRouteProps {
  children: React.ReactNode
}

export default function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { user, isAdmin, loading, profile } = useAuth()

  // Debug: Log do estado
  useEffect(() => {
    console.log('ProtectedAdminRoute - Estado:', {
      user: user?.id,
      profile: profile?.id,
      isAdmin,
      loading,
      profileData: profile
    })
  }, [user, profile, isAdmin, loading])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mb-4"></div>
          <p className="text-[#1F1F1F]">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#E5E5E5] p-8 shadow-xl text-center">
          <div className="mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#1F1F1F] mb-2">Acesso Negado</h2>
          <p className="text-[#1F1F1F]/70 mb-4">
            Você não tem permissão para acessar esta área. Apenas administradores podem acessar o painel administrativo.
          </p>
          {profile && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <p className="font-semibold">Debug Info:</p>
              <p>Perfil encontrado: Sim</p>
              <p>is_admin: {profile.is_admin ? 'true' : 'false'}</p>
            </div>
          )}
          {!profile && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <p className="font-semibold">⚠️ Problema detectado:</p>
              <p>Perfil não encontrado no banco de dados.</p>
              <p className="mt-2">Verifique se existe um registro na tabela `profiles` com o ID do usuário logado.</p>
            </div>
          )}
          <a
            href="/contests"
            className="inline-block px-6 py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors"
          >
            Voltar para Concursos
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
