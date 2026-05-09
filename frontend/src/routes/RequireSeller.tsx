/**
 * MODIFIQUEI AQUI — rota apenas para usuário autenticado com profiles.is_seller = true.
 * Usuários comuns são redirecionados ao catálogo; ADM também pode ser vendedor e passa aqui normalmente.
 */
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { normalizeIsSellerFlag } from '../services/profilesService'

export default function RequireSeller({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mb-4"></div>
          <p className="text-[#1F1F1F]">Carregando…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!normalizeIsSellerFlag(profile?.is_seller)) {
    return <Navigate to="/contests" replace />
  }

  return <>{children}</>
}
