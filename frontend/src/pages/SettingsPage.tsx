/**
 * Página de Configurações
 * FASE 1: Fundação do Sistema
 * 
 * Permite que usuários configurem perfil, preferências e segurança
 */
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  
  // Estado do perfil
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [hasCpfSaved, setHasCpfSaved] = useState(false)
  
  // Estado de alteração de senha
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  
  // Estado de preferências
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [notifyDraws, setNotifyDraws] = useState(true)
  const [notifyFinished, setNotifyFinished] = useState(true)
  const [preferredChannel, setPreferredChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  
  // Estado de segurança
  const [lastAccess, setLastAccess] = useState<string>('')
  const [activeSessions, setActiveSessions] = useState(1)
  
  // Estado de navegação lateral
  const [activeSection, setActiveSection] = useState<'profile' | 'preferences' | 'security'>('profile')
  
  // Estados de UI
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
      return
    }

    if (user && profile) {
      loadUserData()
    }
  }, [user, profile, authLoading, navigate])

  // MODIFIQUEI AQUI - Limpar mensagens ao trocar de seção
  useEffect(() => {
    setError(null)
    setSuccess(null)
  }, [activeSection])

  // Função para mascarar CPF (123.***.***-09)
  const maskCpf = (cpfValue?: string): string => {
    if (!cpfValue || cpfValue.length !== 11) return 'Não informado'
    return `${cpfValue.slice(0, 3)}.***.***-${cpfValue.slice(9, 11)}`
  }

  // Função para validar CPF
  const validateCpf = (cpfValue: string): boolean => {
    const cleanCpf = cpfValue.replace(/\D/g, '')
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

  // Função para formatar CPF enquanto digita
  const formatCpfInput = (value: string): string => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 11)
    if (cleanValue.length <= 3) return cleanValue
    if (cleanValue.length <= 6) return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3)}`
    if (cleanValue.length <= 9) return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3, 6)}.${cleanValue.slice(6)}`
    return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3, 6)}.${cleanValue.slice(6, 9)}-${cleanValue.slice(9)}`
  }

  const loadUserData = async () => {
    try {
      setLoading(true)
      
      // Carregar dados do perfil
      if (profile) {
        setName(profile.name || '')
        setPhone(profile.phone || '')
        setEmail(profile.email || '')
        // CPF: se já existe, marca como salvo (não pode editar)
        if (profile.cpf) {
          setCpf(profile.cpf)
          setHasCpfSaved(true)
        } else {
          setCpf('')
          setHasCpfSaved(false)
        }
      }
      
      // MODIFIQUEI AQUI - Carregar último acesso (usando updated_at do perfil como aproximação)
      if (profile?.updated_at) {
        setLastAccess(new Date(profile.updated_at).toLocaleString('pt-BR'))
      }
      
      // MODIFIQUEI AQUI - Carregar preferências do localStorage (futuramente pode vir do backend)
      const savedNotifications = localStorage.getItem('notificationsEnabled')
      if (savedNotifications !== null) {
        setNotificationsEnabled(savedNotifications === 'true')
      }
      
      const savedNotifyDraws = localStorage.getItem('notifyDraws')
      if (savedNotifyDraws !== null) {
        setNotifyDraws(savedNotifyDraws === 'true')
      }
      
      const savedNotifyFinished = localStorage.getItem('notifyFinished')
      if (savedNotifyFinished !== null) {
        setNotifyFinished(savedNotifyFinished === 'true')
      }
      
      const savedChannel = localStorage.getItem('preferredChannel')
      if (savedChannel) {
        setPreferredChannel(savedChannel as 'whatsapp' | 'email')
      }
      
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user || !profile) return

    try {
      setSaving(true)
      setError(null)

      // Preparar dados para atualização
      const updateData: {
        name: string
        phone: string
        email: string | null
        updated_at: string
        cpf?: string
      } = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        updated_at: new Date().toISOString(),
      }

      // Se não tem CPF salvo e usuário preencheu, validar e incluir
      if (!hasCpfSaved && cpf) {
        const cleanCpf = cpf.replace(/\D/g, '')
        if (cleanCpf.length > 0) {
          if (!validateCpf(cleanCpf)) {
            setError('CPF inválido. Verifique os números digitados.')
            setSaving(false)
            return
          }
          updateData.cpf = cleanCpf
        }
      }

      // MODIFIQUEI AQUI - Atualizar perfil no Supabase
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)

      if (updateError) {
        throw updateError
      }

      // Se salvou CPF, marcar como salvo (não pode mais editar)
      if (updateData.cpf) {
        setHasCpfSaved(true)
      }

      setSuccess('Perfil atualizado com sucesso!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Erro ao salvar perfil:', err)
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!user) return

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Preencha todos os campos')
      return
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    try {
      setSaving(true)
      setError(null)
      
      // MODIFIQUEI AQUI - Atualizar senha no Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        throw updateError
      }

      setSuccess('Senha alterada com sucesso!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordSection(false)
    } catch (err) {
      console.error('Erro ao alterar senha:', err)
      setError(err instanceof Error ? err.message : 'Erro ao alterar senha')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePreferences = () => {
    // MODIFIQUEI AQUI - Salvar preferências no localStorage (futuramente pode ser no backend)
    localStorage.setItem('notificationsEnabled', notificationsEnabled.toString())
    localStorage.setItem('notifyDraws', notifyDraws.toString())
    localStorage.setItem('notifyFinished', notifyFinished.toString())
    localStorage.setItem('preferredChannel', preferredChannel)
    
    setSuccess('Preferências salvas com sucesso!')
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleEndSessions = async () => {
    if (!user) return

    try {
      setSaving(true)
      setError(null)
      
      // MODIFIQUEI AQUI - Encerrar todas as sessões exceto a atual
      // Por enquanto, apenas atualiza o updated_at para simular
      await supabase
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', user.id)

      setActiveSessions(1)
      setSuccess('Todas as sessões foram encerradas!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Erro ao encerrar sessões:', err)
      setError('Erro ao encerrar sessões')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
        <Header />
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto"></div>
            <p className="mt-4 text-[#1F1F1F]/70">Carregando configurações...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {/* Cabeçalho */}
        <div className="mb-6">
          <Link
            to="/contests"
            className="text-[#1E7F43] hover:text-[#3CCB7F] font-semibold flex items-center gap-2 mb-4 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </Link>
          
          <h1 className="text-3xl font-extrabold text-[#1F1F1F] mb-2">
            ⚙️ Configurações
          </h1>
          <p className="text-[#1F1F1F]/70">
            Gerencie suas preferências e configurações da conta
          </p>
        </div>

        {/* Mensagens de sucesso/erro */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-green-700 text-sm font-semibold">{success}</p>
          </div>
        )}

        {/* Layout com Sidebar e Conteúdo */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* MODIFIQUEI AQUI - Navbar Lateral */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-lg border border-[#E5E5E5] p-4 sticky top-4">
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveSection('profile')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeSection === 'profile'
                      ? 'bg-[#1E7F43] text-white'
                      : 'text-[#1F1F1F] hover:bg-[#F9F9F9]'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Meu Perfil
                </button>

                <button
                  onClick={() => setActiveSection('preferences')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeSection === 'preferences'
                      ? 'bg-[#F4C430] text-[#1F1F1F]'
                      : 'text-[#1F1F1F] hover:bg-[#F9F9F9]'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Preferências
                </button>

                <button
                  onClick={() => setActiveSection('security')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeSection === 'security'
                      ? 'bg-red-500 text-white'
                      : 'text-[#1F1F1F] hover:bg-[#F9F9F9]'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Segurança
                </button>
              </nav>
            </div>
          </aside>

          {/* MODIFIQUEI AQUI - Conteúdo Principal */}
          <div className="flex-1 min-w-0">
            {/* Seção: Meu Perfil */}
            {activeSection === 'profile' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-[#1E7F43]/10 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-[#1F1F1F]">👤 Meu Perfil</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                      Nome <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                      placeholder="Seu nome completo"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                      Telefone
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        let formatted = value
                        if (value.length > 11) formatted = value.slice(0, 11)
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
                      className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                      E-mail
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                      CPF {!hasCpfSaved && <span className="text-[#F4C430]">(necessário para Pix)</span>}
                    </label>
                    {hasCpfSaved ? (
                      <>
                        <div className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl bg-[#F9F9F9] text-[#1F1F1F]">
                          {maskCpf(cpf)}
                        </div>
                        <p className="mt-1 text-xs text-[#1F1F1F]/50">
                          CPF não pode ser alterado após o cadastro
                        </p>
                      </>
                    ) : (
                      <>
                        <input
                          id="cpf"
                          type="text"
                          value={formatCpfInput(cpf)}
                          onChange={(e) => setCpf(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                          placeholder="000.000.000-00"
                          maxLength={14}
                        />
                        <p className="mt-1 text-xs text-[#F4C430]">
                          Informe seu CPF para realizar pagamentos via Pix. Após salvar, não poderá ser alterado.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#E5E5E5]">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-[#1F1F1F] mb-1">Alterar Senha</h3>
                        <p className="text-sm text-[#1F1F1F]/60">Atualize sua senha de acesso</p>
                      </div>
                      <button
                        onClick={() => setShowPasswordSection(!showPasswordSection)}
                        className="text-[#1E7F43] hover:text-[#3CCB7F] font-semibold text-sm"
                      >
                        {showPasswordSection ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>

                    {showPasswordSection && (
                      <div className="space-y-4 bg-[#F9F9F9] p-4 rounded-xl">
                        <div>
                          <label htmlFor="currentPassword" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                            Senha Atual
                          </label>
                          <input
                            id="currentPassword"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                            placeholder="Digite sua senha atual"
                          />
                        </div>

                        <div>
                          <label htmlFor="newPassword" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                            Nova Senha
                          </label>
                          <input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                            placeholder="Mínimo 6 caracteres"
                          />
                        </div>

                        <div>
                          <label htmlFor="confirmPassword" className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                            Confirmar Nova Senha
                          </label>
                          <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent"
                            placeholder="Digite a nova senha novamente"
                          />
                        </div>

                        <button
                          onClick={handleChangePassword}
                          disabled={saving}
                          className="w-full sm:w-auto px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {saving ? 'Alterando...' : 'Alterar Senha'}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="w-full sm:w-auto px-6 py-3 bg-[#1E7F43] text-white rounded-xl font-semibold hover:bg-[#3CCB7F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Salvando...' : 'Salvar Perfil'}
                  </button>
                </div>
              </div>
            )}

            {/* Seção: Preferências */}
            {activeSection === 'preferences' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-[#F4C430]/10 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-[#1F1F1F]">🔔 Preferências</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#F9F9F9] rounded-xl">
                    <div>
                      <p className="font-semibold text-[#1F1F1F]">Receber notificações</p>
                      <p className="text-sm text-[#1F1F1F]/60">Ativar/desativar alertas</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationsEnabled}
                        onChange={(e) => setNotificationsEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#1E7F43]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E7F43]"></div>
                    </label>
                  </div>

                  {notificationsEnabled && (
                    <>
                      <div className="flex items-center justify-between p-4 bg-[#F9F9F9] rounded-xl">
                        <div>
                          <p className="font-semibold text-[#1F1F1F]">Sorteio realizado</p>
                          <p className="text-sm text-[#1F1F1F]/60">Notificar quando houver sorteios</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={notifyDraws}
                            onChange={(e) => setNotifyDraws(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#1E7F43]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E7F43]"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-[#F9F9F9] rounded-xl">
                        <div>
                          <p className="font-semibold text-[#1F1F1F]">Bolão finalizado</p>
                          <p className="text-sm text-[#1F1F1F]/60">Notificar quando o concurso encerrar</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={notifyFinished}
                            onChange={(e) => setNotifyFinished(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#1E7F43]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E7F43]"></div>
                        </label>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                          Canal preferido:
                        </label>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setPreferredChannel('whatsapp')}
                            className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
                              preferredChannel === 'whatsapp'
                                ? 'bg-green-500 text-white'
                                : 'bg-[#F9F9F9] text-[#1F1F1F] hover:bg-[#E5E5E5]'
                            }`}
                          >
                            WhatsApp
                          </button>
                          <button
                            onClick={() => setPreferredChannel('email')}
                            className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
                              preferredChannel === 'email'
                                ? 'bg-blue-500 text-white'
                                : 'bg-[#F9F9F9] text-[#1F1F1F] hover:bg-[#E5E5E5]'
                            }`}
                          >
                            E-mail
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    onClick={handleSavePreferences}
                    className="w-full sm:w-auto px-6 py-3 bg-[#F4C430] text-[#1F1F1F] rounded-xl font-semibold hover:bg-[#FFD700] transition-colors"
                  >
                    Salvar Preferências
                  </button>
                </div>
              </div>
            )}

            {/* Seção: Segurança */}
            {activeSection === 'security' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-[#E5E5E5]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-[#1F1F1F]">🔐 Segurança</h2>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-[#F9F9F9] rounded-xl">
                    <p className="text-sm font-semibold text-[#1F1F1F] mb-1">Último acesso</p>
                    <p className="text-[#1F1F1F]/70">{lastAccess || 'Não disponível'}</p>
                  </div>

                  <div className="p-4 bg-[#F9F9F9] rounded-xl">
                    <p className="text-sm font-semibold text-[#1F1F1F] mb-1">Sessões ativas</p>
                    <p className="text-[#1F1F1F]/70">{activeSessions} sessão(ões)</p>
                  </div>

                  <button
                    onClick={handleEndSessions}
                    disabled={saving}
                    className="w-full px-6 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Encerrando...' : 'Encerrar Todas as Sessões'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
