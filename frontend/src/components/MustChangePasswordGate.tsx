import { useState, FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { normalizeIsSellerFlag } from '../services/profilesService'

export default function MustChangePasswordGate() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSeller = normalizeIsSellerFlag(profile?.is_seller)
  const isAdmin = profile?.is_admin === true
  const mustChange =
    !loading &&
    !!user &&
    !isAdmin &&
    !isSeller &&
    user.user_metadata?.must_change_password === true

  if (!mustChange) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    setSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      })
      if (updateError) throw updateError

      await supabase.auth.refreshSession()
      await refreshProfile()
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao redefinir senha')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#1F1F1F]/70 backdrop-blur-sm px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="must-change-password-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[#EEF1F6] bg-gradient-to-br from-[#F0FDF4] to-white">
          <h2 id="must-change-password-title" className="text-xl font-bold text-[#1F1F1F]">
            Redefina sua senha
          </h2>
          <p className="mt-2 text-sm text-[#4B5563] leading-relaxed">
            Sua conta foi criada pelo cambista com uma senha provisória. Por segurança, defina uma{' '}
            <strong>nova senha pessoal</strong> antes de continuar a usar a plataforma.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
              Nova senha
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full min-h-[48px] border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-[#111827] focus:ring-2 focus:ring-[#1E7F43]/25 focus:border-[#1E7F43]"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
              Confirmar nova senha
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full min-h-[48px] border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-[#111827] focus:ring-2 focus:ring-[#1E7F43]/25 focus:border-[#1E7F43]"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] rounded-xl bg-[#1E7F43] text-white font-bold hover:bg-[#196c3a] disabled:opacity-60 transition-colors"
          >
            {submitting ? 'A guardar…' : 'Redefinir senha e continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}
