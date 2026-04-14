/**
 * Página de Login/Cadastro
 * FASE 1: Autenticação Administrativa
 * 
 * Permite que usuários façam login ou criem uma nova conta
 */
import { useState, FormEvent, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/Header'
import Footer from '../components/Footer'
import MobilePhoneCountryInput from '../components/MobilePhoneCountryInput'
import logodezaqui from '../assets/logodezaqui.png'
import {
  BIRTH_DATE_MIN,
  brDigitsToIso,
  formatBirthDateMask,
  getMaxBirthDateForAdultsIso,
  isoDateToBrDigits,
  isValidAdultBirthDate,
} from '../utils/birthDate'

/** DDD + celular (9 após DDD) ou fixo (8 após DDD); teclado tel no mobile. */
function formatBrazilPhoneDisplay(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)
  if (rest.length === 0) return `${ddd} `
  const mobileFirst = rest[0] === '9'
  if (d.length === 11) {
    return `${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`
  }
  if (d.length === 10) {
    return `${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`
  }
  if (mobileFirst) {
    if (rest.length <= 5) return `${ddd} ${rest}`
    return `${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`
  }
  if (rest.length <= 4) return `${ddd} ${rest}`
  return `${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // MODIFIQUEI AQUI - Adicionado isAdmin e profile para redirect baseado em role
  const { user, isAdmin, profile, loading: authLoading } = useAuth()
  // MODIFIQUEI AQUI - Verificar se deve abrir em modo cadastro através da query string
  const searchParams = new URLSearchParams(location.search)
  const [isSignUp, setIsSignUp] = useState(searchParams.get('signup') === 'true')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  /** dd/mm/aaaa (8 dígitos internos). Mobile: também abre calendário nativo pelo botão. */
  const [birthDateDigits, setBirthDateDigits] = useState('')
  const birthDatePickerRef = useRef<HTMLInputElement>(null)
  const birthDatePickerValue = useMemo(
    () => brDigitsToIso(birthDateDigits) ?? '',
    [birthDateDigits]
  )
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  /** DDI numérico (ex.: 55). Só alterável no layout mobile (seletor). Desktop usa sempre 55. */
  const [countryDial, setCountryDial] = useState('55')
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobileViewport(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!isMobileViewport && countryDial !== '55') {
      setCountryDial('55')
      setPhone('')
    }
  }, [isMobileViewport, countryDial])

  // MODIFIQUEI AQUI - Função para converter telefone em e-mail interno (Supabase requer e-mail)
  const phoneToEmail = (phoneNumber: string): string => {
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    return `${cleanPhone}@dezaqui.local`
  }

  /** Dígitos para login/cadastro: BR sem DDI; demais países DDI + número local. */
  const getAuthPhoneDigits = (): string => {
    const n = phone.replace(/\D/g, '')
    if (countryDial === '55') return n
    return `${countryDial}${n}`
  }

  const validatePhone = (national: string, dial: string): boolean => {
    const clean = national.replace(/\D/g, '')
    if (dial === '55') {
      return clean.length >= 10 && clean.length <= 11
    }
    return clean.length >= 6 && clean.length <= 15
  }

  // Função para normalizar CPF (remover . e -)
  const normalizeCpf = (cpfValue: string): string => {
    return cpfValue.replace(/\D/g, '')
  }

  // Função para validar CPF completo (11 dígitos e dígitos verificadores)
  const validateCpf = (cpfValue: string): boolean => {
    const cleanCpf = normalizeCpf(cpfValue)
    if (cleanCpf.length !== 11) return false
    if (/^(\d)\1+$/.test(cleanCpf)) return false // CPFs com todos dígitos iguais

    let sum = 0
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCpf[i]) * (10 - i)
    }
    let remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0
    if (remainder !== parseInt(cleanCpf[9])) return false

    sum = 0
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCpf[i]) * (11 - i)
    }
    remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0
    if (remainder !== parseInt(cleanCpf[10])) return false

    return true
  }

  // Função para formatar CPF (000.000.000-00)
  const formatCpf = (cpfValue: string): string => {
    const cleanCpf = normalizeCpf(cpfValue)
    if (cleanCpf.length <= 3) return cleanCpf
    if (cleanCpf.length <= 6) return `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3)}`
    if (cleanCpf.length <= 9) return `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6)}`
    return `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9, 11)}`
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
    if (!validatePhone(phone, countryDial)) {
      setError(
        countryDial === '55'
          ? 'Por favor, informe um telefone válido (com DDD)'
          : 'Por favor, informe um número de telefone válido'
      )
      setLoading(false)
      return
    }

    try {
      const internalEmail = phoneToEmail(getAuthPhoneDigits())
      
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
    if (!validatePhone(phone, countryDial)) {
      setError(
        countryDial === '55'
          ? 'Por favor, informe um telefone válido (com DDD)'
          : 'Por favor, informe um número de telefone válido'
      )
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

    // MODIFIQUEI AQUI - Validar CPF obrigatório
    if (!cpf.trim()) {
      setError('Por favor, informe seu CPF')
      setLoading(false)
      return
    }

    if (!validateCpf(cpf)) {
      setError('CPF inválido. Verifique os números digitados.')
      setLoading(false)
      return
    }

    const birthIso = brDigitsToIso(birthDateDigits) ?? ''
    if (!birthIso) {
      setError('Por favor, informe uma data de nascimento válida (dd/mm/aaaa)')
      setLoading(false)
      return
    }
    if (!isValidAdultBirthDate(birthIso)) {
      setError('Data de nascimento inválida. É necessário ter pelo menos 18 anos.')
      setLoading(false)
      return
    }

    if (!acceptedTerms) {
      setError('Confirme que tem mais de 18 anos e aceite os termos e a política de privacidade.')
      setLoading(false)
      return
    }

    try {
      // MODIFIQUEI AQUI - Limpar telefone para formato padrão (apenas números) antes de enviar
      const cleanPhone = getAuthPhoneDigits()
      
      // MODIFIQUEI AQUI - Usar e-mail fornecido (agora obrigatório)
      const signUpEmail = phoneToEmail(cleanPhone)
      
      // MODIFIQUEI AQUI - Criar conta sem confirmação de e-mail
      // O trigger handle_new_user() criará o perfil automaticamente com os dados do metadata
      const normalizedCpf = normalizeCpf(cpf)
      
      // Debug: verificar se CPF está sendo enviado
      console.log('[LoginPage] Criando usuário com metadata:', {
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim(),
        cpf: normalizedCpf,
        cpfLength: normalizedCpf.length,
      })

      // Montar metadados (CPF é obrigatório)
      const userMetadata: Record<string, string> = {
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim(),
        cpf: normalizedCpf,
        birth_date: birthIso,
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: signUpEmail,
        password,
        options: {
          data: userMetadata,
          // Desabilitar confirmação de e-mail
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
        setPhone('')
        setCountryDial('55')
        setEmail('') // MODIFIQUEI AQUI - Limpar e-mail após cadastro
        setName('') // MODIFIQUEI AQUI - Limpar nome após cadastro
        setCpf('') // Limpar CPF após cadastro
        setBirthDateDigits('')
        setAcceptedTerms(false)
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
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F1F1F]/60">
                    Telefone <span className="text-red-500">*</span>
                  </div>
                  <div className="md:hidden">
                    <MobilePhoneCountryInput
                      phone={phone}
                      countryDial={countryDial}
                      onPhoneChange={setPhone}
                      onCountryDialChange={setCountryDial}
                      formatBrazil={formatBrazilPhoneDisplay}
                    />
                  </div>
                  <div className="hidden md:block">
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      aria-label="Telefone"
                      required
                      value={phone}
                      onChange={(e) => setPhone(formatBrazilPhoneDisplay(e.target.value))}
                      className="mt-2 block w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#1F1F1F] placeholder-[#1F1F1F]/40 shadow-sm focus:border-[#1E7F43] focus:outline-none focus:ring-2 focus:ring-[#3CCB7F]/40"
                      placeholder="11 96123-4567"
                      maxLength={14}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[#1F1F1F]/50">
                    Informe seu telefone com DDD (ex: 11 96123-4567)
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
                {isSignUp && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F1F1F]/60">
                      Data de nascimento <span className="text-red-500">*</span>
                    </div>
                    <div className="md:hidden mt-2 flex gap-2">
                      <input
                        id="birthDate-mobile"
                        name="birthDate"
                        type="text"
                        inputMode="numeric"
                        autoComplete="bday"
                        required={isMobileViewport}
                        value={formatBirthDateMask(birthDateDigits)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
                          setBirthDateDigits(digits)
                        }}
                        className="min-w-0 flex-1 rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#1F1F1F] placeholder-[#1F1F1F]/40 shadow-sm focus:border-[#1E7F43] focus:outline-none focus:ring-2 focus:ring-[#3CCB7F]/40"
                        placeholder="dd/mm/aaaa"
                        maxLength={10}
                      />
                      <input
                        ref={birthDatePickerRef}
                        type="date"
                        tabIndex={-1}
                        aria-hidden
                        className="sr-only"
                        value={birthDatePickerValue}
                        min={BIRTH_DATE_MIN}
                        max={getMaxBirthDateForAdultsIso()}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v) setBirthDateDigits(isoDateToBrDigits(v))
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const el = birthDatePickerRef.current
                          if (!el) return
                          if (typeof el.showPicker === 'function') {
                            void el.showPicker().catch(() => el.click())
                          } else {
                            el.click()
                          }
                        }}
                        className="flex shrink-0 items-center justify-center rounded-xl border border-[#E5E5E5] bg-white px-3 text-[#1E7F43] shadow-sm hover:bg-[#F9F9F9] focus:border-[#1E7F43] focus:outline-none focus:ring-2 focus:ring-[#3CCB7F]/40"
                        aria-label="Abrir calendário para escolher a data"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                    <div className="hidden md:block mt-2">
                      <input
                        id="birthDate-desktop"
                        name="birthDate"
                        type="text"
                        inputMode="numeric"
                        autoComplete="bday"
                        required={!isMobileViewport}
                        value={formatBirthDateMask(birthDateDigits)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
                          setBirthDateDigits(digits)
                        }}
                        className="block w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#1F1F1F] placeholder-[#1F1F1F]/40 shadow-sm focus:border-[#1E7F43] focus:outline-none focus:ring-2 focus:ring-[#3CCB7F]/40"
                        placeholder="dd/mm/aaaa"
                        maxLength={10}
                      />
                    </div>
                    <p className="mt-1 text-xs text-[#1F1F1F]/50">
                      É necessário ter pelo menos 18 anos.
                    </p>
                  </div>
                )}
                {isSignUp && (
                  <div>
                    <label htmlFor="cpf" className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F1F1F]/60">
                      CPF <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="cpf"
                      name="cpf"
                      type="text"
                      autoComplete="off"
                      required
                      value={cpf}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        if (value.length <= 11) {
                          setCpf(formatCpf(value))
                        }
                      }}
                      className="mt-2 block w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#1F1F1F] placeholder-[#1F1F1F]/40 shadow-sm focus:border-[#1E7F43] focus:outline-none focus:ring-2 focus:ring-[#3CCB7F]/40"
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                    <p className="mt-1 text-xs text-[#1F1F1F]/50">
                      CPF obrigatório e deve ser válido para pagamentos via Pix
                    </p>
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

                {isSignUp && (
                  <>
                    <div className="flex gap-3 pt-1">
                      <input
                        id="acceptTerms"
                        name="acceptTerms"
                        type="checkbox"
                        required
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        aria-required="true"
                        className="mt-1 h-4 w-4 shrink-0 rounded border-[#E5E5E5] text-[#1E7F43] focus:ring-[#3CCB7F]/40"
                      />
                      <label htmlFor="acceptTerms" className="text-sm text-[#1F1F1F]/90 leading-snug cursor-pointer">
                        Confirmo que <strong className="text-[#1F1F1F]">tenho mais de 18 anos</strong>, li e aceito os{' '}
                        <Link
                          to="/termos-de-uso"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline font-medium"
                        >
                          Termos e Condições de Uso
                        </Link>{' '}
                        e a{' '}
                        <Link
                          to="/politica-de-privacidade"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline font-medium"
                        >
                          Política de Privacidade
                        </Link>
                        .
                      </label>
                    </div>

                    <div
                      className="flex gap-3 rounded-xl border border-[#E8D9A8] bg-[#FFF9E6] px-3 py-3 sm:px-4 sm:py-3.5"
                      role="status"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1F1F1F] text-[11px] font-extrabold text-white leading-tight text-center"
                        aria-hidden
                      >
                        +18
                      </div>
                      <div className="min-w-0 flex-1 text-center sm:text-left">
                        <p className="text-sm font-bold text-[#1F1F1F]">
                          Proibido para menores de 18 anos.
                        </p>
                        <p className="text-sm text-[#1F1F1F]/85 mt-0.5">Jogue com responsabilidade.</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || (isSignUp && !acceptedTerms)}
                title={isSignUp && !acceptedTerms ? 'Marque a caixa para aceitar os termos e continuar' : undefined}
                className={`
                  group relative w-full rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-white shadow-lg transition
                  ${
                    loading || (isSignUp && !acceptedTerms)
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
                  setPhone('')
                  setCountryDial('55')
                  if (isSignUp) {
                    setEmail('') // MODIFIQUEI AQUI - Limpar e-mail apenas ao sair do cadastro
                    setName('') // MODIFIQUEI AQUI - Limpar nome apenas ao sair do cadastro
                    setCpf('') // Limpar CPF obrigatório ao sair do cadastro
                    setBirthDateDigits('')
                  }
                  setAcceptedTerms(false)
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
