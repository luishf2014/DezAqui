/**
 * Guard de rota para proteger rotas administrativas
 * 
 * Verifica se o usuário está autenticado e é administrador.
 * Se não for admin, redireciona para /contests.
 * Se não estiver autenticado, redireciona para /login.
 */
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function RequireAdmin() {
  const { user, isAdmin, loading } = useAuth()

  // Aguarda carregamento antes de verificar
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

  // Redireciona para login se não autenticado
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Redireciona para /contests se não for admin
  if (!isAdmin) {
    return <Navigate to="/contests" replace />
  }

  // Renderiza rotas filhas se for admin
  return <Outlet />
}
