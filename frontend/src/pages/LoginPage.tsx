/**
 * Página de Login/Cadastro
 * FASE 1: Autenticação Administrativa
 * 
 * Permite que usuários façam login ou criem uma nova conta
 */
import { useState, FormEvent, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import logodezaqui from '../assets/logodezaqui.png'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // CHATGPT: alterei aqui - Adicionado isAdmin e profile para redirect baseado em role
  const { user, isAdmin, profile, loading: authLoading } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // MODIFIQUEI AQUI - Redirecionar baseado em isAdmin: admin vai para /admin, usuário comum para /contests
  // Aguarda o carregamento completo do profile antes de redirecionar
  useEffect(() => {
    // MODIFIQUEI AQUI - Só redireciona quando:
    // 1. Não está carregando (authLoading === false) - indica que tentativa de carregar profile foi concluída
    // 2. Usuário está autenticado (user existe)
    // 3. Está na página de login
    // 4. Profile foi processado (pode existir ou não, mas a tentativa de carregar foi concluída)
    if (!authLoading && user && location.pathname === '/login') {
      // MODIFIQUEI AQUI - Determinar destino baseado no isAdmin correto (que depende do profile carregado)
      // Se profile não foi carregado mas user existe, ainda assim redireciona para /contests (usuário comum)
      const targetPath = isAdmin ? '/admin' : '/contests'
      
      console.log('[LoginPage] MODIFIQUEI AQUI - Redirecionando para:', targetPath, { 
        isAdmin, 
        user: user.id, 
        authLoading,
        hasProfile: !!profile,
        profileIsAdmin: profile?.is_admin,
        profileId: profile?.id
      })
      
      navigate(targetPath, { replace: true })
    }
  }, [user, isAdmin, authLoading, navigate, location.pathname, profile])

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message || 'Erro ao fazer login')
        setLoading(false)
        return
      }

      if (data.user) {
        // CHATGPT: alterei aqui - Resetar loading imediatamente após login bem-sucedido
        // O useEffect vai detectar a mudança de autenticação via AuthContext e navegar automaticamente
        setLoading(false)
        console.log('[LoginPage] Login bem-sucedido, aguardando AuthContext atualizar para redirecionamento...')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao fazer login')
      setLoading(false)
    }
  }

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message || 'Erro ao criar conta')
        return
      }

      if (data.user) {
        setSuccess('Conta criada com sucesso! Você já pode fazer login.')
        setIsSignUp(false)
        setPassword('')
        setShowPassword(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-[#1E7F43] via-[#1E7F43] to-[#3CCB7F] opacity-10 blur-2xl" />
        <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white px-4 py-8 sm:px-6 sm:py-10 shadow-xl">
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl bg-white">
                <img src={logodezaqui} alt="Logo DezAqui" className="h-16 w-16 sm:h-20 sm:w-20" />
              </div>
              <div className="text-center">
                {/* <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#3CCB7F]">DezAqui</p> */}
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F1F1F]">
                  {isSignUp ? 'Criar Conta' : 'Login'}
                </h2>
              </div>
            </div>
            <p className="text-center text-sm text-[#1F1F1F]/70">
              {isSignUp ? 'Crie sua conta para começar' : 'Acesse sua conta para continuar'}
            </p>
            <div className="rounded-full bg-[#F4C430]/20 px-4 py-1 text-xs font-semibold text-[#1F1F1F]">
              Sorte, confiança e praticidade
            </div>
          </div>

          <form className="mt-8 space-y-6" onSubmit={isSignUp ? handleSignUp : handleLogin}>
            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div></div>
            )}

            {success && (
              <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                <div className="text-sm text-green-700">{success}</div>
              </div>
            )}

            <div className="rounded-2xl border border-[#E5E5E5] bg-[#F9F9F9] p-4">
              <div className="space-y-4">
                {isSignUp && (
                  <div>
                    <label htmlFor="name" className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F1F1F]/60">
                      Nome completo
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-2 block w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#1F1F1F] placeholder-[#1F1F1F]/40 shadow-sm focus:border-[#1E7F43] focus:outline-none focus:ring-2 focus:ring-[#3CCB7F]/40"
                      placeholder="Nome completo"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F1F1F]/60">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2 block w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#1F1F1F] placeholder-[#1F1F1F]/40 shadow-sm focus:border-[#1E7F43] focus:outline-none focus:ring-2 focus:ring-[#3CCB7F]/40"
                    placeholder="Email"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F1F1F]/60">
                    Senha
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 pr-12 text-sm text-[#1F1F1F] placeholder-[#1F1F1F]/40 shadow-sm focus:border-[#1E7F43] focus:outline-none focus:ring-2 focus:ring-[#3CCB7F]/40"
                      placeholder={isSignUp ? 'Senha (mínimo 6 caracteres)' : 'Senha'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1F1F1F]/60 hover:text-[#1E7F43] focus:outline-none"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.729 2.929a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m13.42 13.42l-3.29-3.29M3 3l18 18"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`
                  group relative w-full rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-white shadow-lg transition
                  ${
                    loading
                      ? 'cursor-not-allowed bg-[#E5E5E5] text-[#1F1F1F]/60'
                      : 'bg-[#1E7F43] hover:bg-[#3CCB7F] focus:outline-none focus:ring-2 focus:ring-[#3CCB7F]/60 focus:ring-offset-2'
                  }
                `}
              >
                {loading ? (isSignUp ? 'Criando conta...' : 'Entrando...') : (isSignUp ? 'Criar Conta' : 'Entrar')}
              </button>
            </div><div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                  setSuccess(null)
                  setShowPassword(false)
                }}
                className="text-sm font-semibold text-[#1E7F43] transition hover:text-[#3CCB7F]"
              >
                {isSignUp ? 'Já tem uma conta? Faça login' : 'Não tem uma conta? Cadastre-se'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
