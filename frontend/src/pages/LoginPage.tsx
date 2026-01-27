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
import Header from '../components/Header'
import Footer from '../components/Footer'
import logodezaqui from '../assets/logodezaqui.png'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // CHATGPT: alterei aqui - Adicionado isAdmin e profile para redirect baseado em role
  const { user, isAdmin, profile, loading: authLoading } = useAuth()
  // MODIFIQUEI AQUI - Verificar se deve abrir em modo cadastro através da query string
  const searchParams = new URLSearchParams(location.search)
  const [isSignUp, setIsSignUp] = useState(searchParams.get('signup') === 'true')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // MODIFIQUEI AQUI - Função para converter telefone em e-mail interno (Supabase requer e-mail)
  const phoneToEmail = (phoneNumber: string): string => {
    // Remove caracteres não numéricos
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    return `${cleanPhone}@dezaqui.local`
  }

  // MODIFIQUEI AQUI - Função para validar formato de telefone brasileiro
  const validatePhone = (phoneNumber: string): boolean => {
    // Remove caracteres não numéricos
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    // Aceita telefone com DDD (10 ou 11 dígitos)
    return cleanPhone.length >= 10 && cleanPhone.length <= 11
  }


  // MODIFIQUEI AQUI - Sincronizar modo sign up com query string
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    setIsSignUp(searchParams.get('signup') === 'true')
  }, [location.search])

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

    // MODIFIQUEI AQUI - Validar telefone antes de fazer login
    if (!validatePhone(phone)) {
      setError('Por favor, informe um telefone válido (com DDD)')
      setLoading(false)
      return
    }

    try {
      // MODIFIQUEI AQUI - Converter telefone para e-mail interno para autenticação no Supabase
      const internalEmail = phoneToEmail(phone)
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password,
      })

      if (signInError) {
        // MODIFIQUEI AQUI - Mensagens de erro mais amigáveis
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Telefone ou senha incorretos')
        } else {
          setError(signInError.message || 'Erro ao fazer login')
        }
        setLoading(false)
        return
      }

      if (data.user) {
        // Resetar loading imediatamente após login bem-sucedido
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

    // MODIFIQUEI AQUI - Validar telefone antes de criar conta
    if (!validatePhone(phone)) {
      setError('Por favor, informe um telefone válido (com DDD)')
      setLoading(false)
      return
    }

    if (!name.trim()) {
      setError('Por favor, informe seu nome completo')
      setLoading(false)
      return
    }

    // MODIFIQUEI AQUI - Validar e-mail obrigatório
    if (!email.trim()) {
      setError('Por favor, informe seu e-mail')
      setLoading(false)
      return
    }

    // MODIFIQUEI AQUI - Validar formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('Por favor, informe um e-mail válido')
      setLoading(false)
      return
    }

    try {
      // MODIFIQUEI AQUI - Limpar telefone para formato padrão (apenas números) antes de enviar
      const cleanPhone = phone.replace(/\D/g, '')
      
      // MODIFIQUEI AQUI - Usar e-mail fornecido (agora obrigatório)
      const signUpEmail = phoneToEmail(cleanPhone)
      
      // MODIFIQUEI AQUI - Criar conta sem confirmação de e-mail
      // O trigger handle_new_user() criará o perfil automaticamente com os dados do metadata
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: signUpEmail,
        password,
        options: {
          data: {
            name: name.trim(), // MODIFIQUEI AQUI - Nome será usado pelo trigger para criar o perfil
            phone: cleanPhone, // MODIFIQUEI AQUI - Telefone limpo (sem formatação) será usado pelo trigger
            email: email.trim(), // MODIFIQUEI AQUI - E-mail obrigatório será usado pelo trigger
          },
          // MODIFIQUEI AQUI - Desabilitar confirmação de e-mail
          emailRedirectTo: undefined,
        },
      })

      if (signUpError) {
        // MODIFIQUEI AQUI - Mensagens de erro mais amigáveis
        if (signUpError.message.includes('already registered')) {
          setError('Este telefone já está cadastrado. Faça login ou use outro telefone.')
        } else {
          setError(signUpError.message || 'Erro ao criar conta')
        }
        setLoading(false)
        return
      }

      if (data.user) {
        // MODIFIQUEI AQUI - O trigger handle_new_user() criará o perfil automaticamente
        // com os dados do metadata: full_name, phone, email e is_admin
        // Aguardar um pouco para garantir que o trigger execute
        await new Promise(resolve => setTimeout(resolve, 300))
        
        console.log('[LoginPage] Usuário criado com sucesso. Perfil será criado automaticamente pelo trigger.')
        
        setSuccess('Conta criada com sucesso! Você já pode fazer login.')
        setIsSignUp(false)
        setPassword('')
        setShowPassword(false)
        setPhone('') // MODIFIQUEI AQUI - Limpar telefone após cadastro
        setEmail('') // MODIFIQUEI AQUI - Limpar e-mail após cadastro
        setName('') // MODIFIQUEI AQUI - Limpar nome após cadastro
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao criar conta')
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
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
                      Nome completo <span className="text-red-500">*</span>
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
                  <label htmlFor="phone" className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F1F1F]/60">
                    Telefone <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => {
                      // MODIFIQUEI AQUI - Formatar telefone enquanto digita
                      const value = e.target.value.replace(/\D/g, '')
                      let formatted = value
                      
                      if (value.length > 11) {
                        formatted = value.slice(0, 11)
                      }
                      
                      // Formatar: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
                      if (formatted.length > 10) {
                        formatted = `(${formatted.slice(0, 2)}) ${formatted.slice(2, 7)}-${formatted.slice(7)}`
                      } else if (formatted.length > 6) {
                        formatted = `(${formatted.slice(0, 2)}) ${formatted.slice(2, 6)}-${formatted.slice(6)}`
                      } else if (formatted.length > 2) {
                        formatted = `(${formatted.slice(0, 2)}) ${formatted.slice(2)}`
                      } else if (formatted.length > 0) {
                        formatted = `(${formatted}`
                      }
                      
                      setPhone(formatted)
                    }}
                    className="mt-2 block w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#1F1F1F] placeholder-[#1F1F1F]/40 shadow-sm focus:border-[#1E7F43] focus:outline-none focus:ring-2 focus:ring-[#3CCB7F]/40"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                  <p className="mt-1 text-xs text-[#1F1F1F]/50">
                    Informe seu telefone com DDD (ex: (11) 98765-4321)
                  </p>
                </div>
                {isSignUp && (
                  <div>
                    <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F1F1F]/60">
                      E-mail <span className="text-red-500">*</span>
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
                      placeholder="seu@email.com"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F1F1F]/60">
                    Senha <span className="text-red-500">*</span>
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
            </div>            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  // MODIFIQUEI AQUI - Atualizar URL ao alternar entre login e cadastro
                  const newSignUp = !isSignUp
                  setIsSignUp(newSignUp)
                  setError(null)
                  setSuccess(null)
                  setShowPassword(false)
                  setPhone('') // MODIFIQUEI AQUI - Limpar telefone ao alternar entre login e cadastro
                  if (isSignUp) {
                    setEmail('') // MODIFIQUEI AQUI - Limpar e-mail apenas ao sair do cadastro
                    setName('') // MODIFIQUEI AQUI - Limpar nome apenas ao sair do cadastro
                  }
                  navigate(newSignUp ? '/login?signup=true' : '/login', { replace: true })
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
      <Footer />
    </div>
  )
}
