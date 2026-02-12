/**
 * Componente Header reutilizável
 * 
 * Header com logo e menu de perfil para todas as páginas autenticadas.
 * Gerencia navegação, menu de perfil do usuário e logout.
 * 
 * @component
 * @returns {JSX.Element | null} Header component ou null se usuário não autenticado
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { supabase } from '../lib/supabase' // MODIFIQUEI AQUI - Supabase para buscar notificações
import logodezaqui from '../assets/logodezaqui.png'

// Constantes
const MENU_ANIMATION_DURATION = 200

// MODIFIQUEI AQUI - Tipagem das notificações (mesma da NotificationsPage)
type Notif = {
  id: string
  title: string
  message: string
  link: string | null
  read_at: string | null
  created_at: string
}

export default function Header() {
  const navigate = useNavigate()
  const { user, isAdmin, logout, profile } = useAuth()
  const { getItemCount } = useCart()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  // MODIFIQUEI AQUI - Só contar itens quando estiver logado
  const cartItemCount = user ? getItemCount() : 0

  // MODIFIQUEI AQUI - Estados das notificações (sino + dropdown)
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [notifItems, setNotifItems] = useState<Notif[]>([])
  const [notifUnreadCount, setNotifUnreadCount] = useState(0)
  const notifMenuRef = useRef<HTMLDivElement>(null)


  // MODIFIQUEI AQUI - Formatar telefone para exibição
  const formatPhone = useCallback((phone: string | undefined | null): string => {
    if (!phone) return ''
    const clean = phone.replace(/\D/g, '')
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
    } else if (clean.length === 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`
    }
    return phone
  }, [])

  /**
   * MODIFIQUEI AQUI - Obtém o nome de exibição do usuário (prioriza telefone do profile)
   */
  const getUserDisplayName = useCallback(() => {
    // Se tiver telefone no profile, usar telefone formatado
    if (profile?.phone) {
      const firstName = profile.name?.trim().split(' ')[0]
      return firstName || 'Usuário'
    }
    // Se não tiver telefone, usar nome do profile
    if (profile?.name) {
      return profile.name
    }
    // Fallback para email (caso ainda exista)
    if (user?.email && !user.email.includes('@dezaqui.local')) {
      return user.email.split('@')[0]
    }
    return 'Usuário'
  }, [user, profile, formatPhone])

  /**
   * MODIFIQUEI AQUI - Obtém a inicial do usuário para o avatar (prioriza nome)
   */
  const getUserInitial = useCallback(() => {
    if (profile?.name) {
      return profile.name.charAt(0).toUpperCase()
    }
    if (profile?.phone) {
      return profile.phone.charAt(0).toUpperCase()
    }
    if (user?.email && !user.email.includes('@dezaqui.local')) {
      return user.email.charAt(0).toUpperCase()
    }
    return 'U'
  }, [user, profile])

  /**
   * Fecha o menu de perfil
   */
  const closeProfileMenu = useCallback(() => {
    setShowProfileMenu(false)
  }, [])

  /**
   * Alterna a visibilidade do menu de perfil
   */
  const toggleProfileMenu = useCallback(() => {
    setShowProfileMenu((prev) => !prev)
  }, [])

  // MODIFIQUEI AQUI - Toggle do menu de notificações
  const toggleNotifMenu = useCallback(() => {
    setShowNotifMenu((prev) => !prev)
  }, [])

  // MODIFIQUEI AQUI - Carrega contador e últimas notificações
  const loadNotifications = useCallback(async () => {
    try {
      if (!user?.id) return

      const [{ count: unreadCount }, { data }] = await Promise.all([
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .is('read_at', null),
        supabase
          .from('notifications')
          .select('id,title,message,link,read_at,created_at')
          .order('created_at', { ascending: false })
          .limit(8),
      ])

      const list = (data ?? []) as Notif[]
      setNotifItems(list)
      setNotifUnreadCount(unreadCount ?? 0)
    } catch (e) {
      // Silencioso: não quebra o header
      console.error('[Header] Erro ao carregar notificações:', e)
    }
  }, [user?.id])

  // MODIFIQUEI AQUI - Carregar notificações ao entrar / trocar usuário
  useEffect(() => {
    if (!user?.id) return
    loadNotifications()
  }, [user?.id, loadNotifications])

  // Marcar todas as notificações como lidas
  const markAllAsRead = useCallback(async () => {
    if (!user?.id || notifUnreadCount === 0) return
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null)

    if (!error) {
      setNotifItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })))
      setNotifUnreadCount(0)
    }
  }, [user?.id, notifUnreadCount])

  // MODIFIQUEI AQUI - Marcar uma notificação como lida e navegar
  const openNotif = useCallback(
    async (n: Notif) => {
      try {
        if (!n.read_at) {
          const now = new Date().toISOString()
          await supabase.from('notifications').update({ read_at: now }).eq('id', n.id)

          setNotifItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)))
          setNotifUnreadCount((prev) => Math.max(0, prev - 1))
        }
      } finally {
        setShowNotifMenu(false)
        if (n.link) navigate(n.link)
      }
    },
    [navigate]
  )

  /**
   * MODIFIQUEI AQUI - Manipula o logout do usuário com transições suaves
   */
  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true)

      // MODIFIQUEI AQUI - Fechar menu com animação suave
      closeProfileMenu()

      // MODIFIQUEI AQUI - Pequeno delay para animação do menu fechar
      await new Promise(resolve => setTimeout(resolve, 150))

      // MODIFIQUEI AQUI - Iniciar fade-out da página
      setIsFadingOut(true)

      // MODIFIQUEI AQUI - Aguardar animação de fade-out
      await new Promise(resolve => setTimeout(resolve, 300))

      // MODIFIQUEI AQUI - Usar função logout do AuthContext
      await logout()

      // MODIFIQUEI AQUI - Redirecionar para /contests após logout bem-sucedido
      navigate('/contests', { replace: true })
    } catch (error) {
      console.error('[Header] Erro ao fazer logout:', error)
      // Mesmo com erro, redirecionar para /contests
      navigate('/contests', { replace: true })
    } finally {
      setIsLoggingOut(false)
      setIsFadingOut(false)
    }
  }, [navigate, closeProfileMenu, logout])

  /**
   * Navega para a página de configurações (Meu Perfil)
   * MODIFIQUEI AQUI - Handler para clique em Meu Perfil redireciona para configurações
   */
  const handleProfileClick = useCallback(() => {
    closeProfileMenu()
    navigate('/settings')
  }, [closeProfileMenu, navigate])

  /**
   * Navega para a página de configurações
   * MODIFIQUEI AQUI - Handler para clique em configurações
   */
  const handleSettingsClick = useCallback(() => {
    closeProfileMenu()
    navigate('/settings')
  }, [closeProfileMenu, navigate])

  /**
   * Fecha o menu ao clicar fora dele
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        closeProfileMenu()
      }

      // MODIFIQUEI AQUI - Fechar menu de notificações ao clicar fora
      if (
        notifMenuRef.current &&
        !notifMenuRef.current.contains(event.target as Node)
      ) {
        setShowNotifMenu(false)
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showProfileMenu) {
        closeProfileMenu()
      }
      if (event.key === 'Escape' && showNotifMenu) {
        setShowNotifMenu(false)
      }
    }

    if (showProfileMenu || showNotifMenu) {
      // Pequeno delay para evitar fechamento imediato ao abrir
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscapeKey)
      }, MENU_ANIMATION_DURATION)

      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleEscapeKey)
      }
    }
  }, [showProfileMenu, showNotifMenu, closeProfileMenu])

  return (
    <>
      {/* MODIFIQUEI AQUI - Overlay de fade-out durante logout */}
      {isFadingOut && (
        <div
          className="fixed inset-0 bg-white z-[9999] transition-opacity duration-300 ease-out opacity-100"
          aria-hidden="true"
        />
      )}

      <header
        className={`relative sticky top-0 z-50 shadow-2xl transition-opacity duration-300 ${isFadingOut ? 'opacity-0' : 'opacity-100'
          }`}
        role="banner"
        aria-label="Cabeçalho principal"
      >
        {/* Gradiente de fundo com overlay sutil */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E7F43] via-[#1E7F43] to-[#3CCB7F]" aria-hidden="true"></div>
        <div className="absolute inset-0 bg-black/5" aria-hidden="true"></div>

        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center justify-between" role="navigation" aria-label="Navegação principal">
            {/* Logo e Nome da Plataforma */}
            <Link
              to={user ? "/contests" : "/"}
              className="flex items-center gap-3 hover:opacity-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 rounded-xl px-2 py-1 -ml-2"
              aria-label={user ? "Ir para página de concursos" : "Ir para página inicial"}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-xl ring-2 ring-white/20" aria-hidden="true">
                <img
                  src={logodezaqui}
                  alt="Logo DezAqui"
                  className="h-11 w-11"
                  loading="eager"
                />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-extrabold text-white tracking-tight">DezAqui</h1>
                <p className="text-xs text-white/95 font-medium">Concursos numéricos</p>
              </div>
            </Link>

            {/* Carrinho e Notificações - Visível apenas em mobile (< md) */}
            <div className="flex md:hidden items-center gap-2 flex-1 justify-end">
              {user && (
                <>
                  <Link
                    to="/cart"
                    className="relative p-2.5 text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition-all"
                    title="Carrinho"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {cartItemCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 bg-[#F4C430] text-[#1F1F1F] text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                        {cartItemCount > 9 ? '9+' : cartItemCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/notifications"
                    className="relative p-2.5 mr-3 text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition-all"
                    title="Notificações"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {notifUnreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 bg-[#F4C430] text-[#1F1F1F] text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                        {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
                      </span>
                    )}
                  </Link>
                </>
              )}
            </div>

            {/* Links de Navegação - Visíveis em desktop (>= md) */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                to="/contests"
                className="px-4 py-2 text-white/90 hover:text-white font-semibold text-sm rounded-lg hover:bg-white/10 transition-all"
              >
                Concursos
              </Link>

              {/* MODIFIQUEI AQUI - Link "Rankings" visível apenas quando autenticado */}
              {user && (
                <Link
                  to="/rankings"
                  className="px-4 py-2 text-white/90 hover:text-white font-semibold text-sm rounded-lg hover:bg-white/10 transition-all"
                >
                  Rankings
                </Link>
              )}

              {/* Link "Meus Tickets" visível apenas quando autenticado */}
              {user && (
                <Link
                  to="/my-tickets"
                  className="px-4 py-2 text-white/90 hover:text-white font-semibold text-sm rounded-lg hover:bg-white/10 transition-all"
                >
                  Meus Tickets
                </Link>
              )}

              {/* Link "Última Compra" visível apenas quando autenticado */}
              {user && (
                <Link
                  to="/ultima-compra"
                  className="px-4 py-2 text-white/90 hover:text-white font-semibold text-sm rounded-lg hover:bg-white/10 transition-all"
                >
                  Última Compra
                </Link>
              )}

              {/* Apenas link "Dashboard" quando admin e autenticado */}
              {user && isAdmin && (
                <Link
                  to="/admin"
                  className="px-4 py-2 text-white/90 hover:text-white font-semibold text-sm rounded-lg hover:bg-white/10 transition-all"
                >
                  Dashboard
                </Link>
              )}

              {/* MODIFIQUEI AQUI - Sino de Notificações (somente quando autenticado) */}
              {user && (
                <div className="relative" ref={notifMenuRef}>
                  <button
                    type="button"
                    onClick={async () => {
                      toggleNotifMenu()
                      await loadNotifications()
                    }}
                    aria-expanded={showNotifMenu}
                    aria-haspopup="true"
                    aria-label="Abrir notificações"
                    className="relative px-3 py-2 text-white/90 hover:text-white font-semibold text-sm rounded-lg hover:bg-white/10 transition-all"
                    title="Notificações"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>

                    {notifUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[#F4C430] text-[#1F1F1F] text-xs font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center">
                        {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifMenu && (
                    <div
                      className="absolute right-0 mt-3 w-80 rounded-2xl border border-[#E5E5E5] bg-white shadow-2xl z-50 overflow-hidden animate-[slideDown_0.2s_ease-out]"
                      role="menu"
                      aria-orientation="vertical"
                    >
                      <div className="p-4 bg-gradient-to-br from-[#F9F9F9] to-white border-b border-[#E5E5E5] flex items-center justify-between">
                        <div>
                          <div className="text-sm font-extrabold text-[#1F1F1F]">Notificações</div>
                          <div className="text-xs text-[#1F1F1F]/60 font-medium">
                            {notifUnreadCount > 0 ? `${notifUnreadCount} pendente(s)` : 'Tudo em dia ✅'}
                          </div>
                        </div>
                        {notifUnreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs font-bold text-[#1E7F43] hover:text-[#3CCB7F]"
                          >
                            Marcar todas como lidas
                          </button>
                        )}
                      </div>

                      <div className="max-h-[360px] overflow-auto">
                        {notifItems.length === 0 ? (
                          <div className="p-4 text-sm text-[#1F1F1F]/70">Você não tem notificações no momento.</div>
                        ) : (
                          <div className="p-2 space-y-2">
                            {notifItems.slice(0, 6).map((n) => (
                              <button
                                key={n.id}
                                onClick={() => openNotif(n)}
                                className={`w-full text-left rounded-2xl border p-3 transition-all ${n.read_at ? 'border-[#E5E5E5] bg-white hover:bg-[#F9F9F9]' : 'border-[#F4C430] bg-[#F4C430]/10 hover:bg-[#F4C430]/15'
                                  }`}
                              >
                                <div className="font-extrabold text-[#1F1F1F] text-sm">{n.title}</div>
                                <div className="text-xs text-[#1F1F1F]/70 mt-1 line-clamp-2">{n.message}</div>
                                <div className="text-[11px] text-[#1F1F1F]/40 mt-2">
                                  {new Date(n.created_at).toLocaleString('pt-BR')}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-t border-[#E5E5E5] p-3">
                        <Link
                          to="/notifications"
                          onClick={() => setShowNotifMenu(false)}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#1E7F43] text-white font-extrabold hover:bg-[#3CCB7F] transition-colors"
                        >
                          Ver todas
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Icone do Carrinho */}
              <Link
                to="/cart"
                className="relative px-3 py-2 text-white/90 hover:text-white font-semibold text-sm rounded-lg hover:bg-white/10 transition-all"
                title="Carrinho de Apostas"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#F4C430] text-[#1F1F1F] text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
              </Link>
            </div>

            {/* Mostrar botoes de Login/Cadastro quando nao autenticado */}
            {!user ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-white/90 hover:text-white font-semibold text-sm rounded-lg hover:bg-white/10 transition-all border border-white/30"
                >
                  Login
                </Link>
                <Link
                  to="/login?signup=true"
                  className="px-4 py-2 bg-white text-[#1E7F43] font-semibold text-sm rounded-lg hover:bg-white/90 transition-all shadow-lg"
                >
                  Cadastrar
                </Link>
              </div>
            ) : (
              // MODIFIQUEI AQUI - Menu de Perfil do Usuário - Visível apenas quando autenticado
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={toggleProfileMenu}
                  disabled={isLoggingOut}
                  aria-expanded={showProfileMenu}
                  aria-haspopup="true"
                  aria-label={`Menu de perfil do usuário ${getUserDisplayName()}`}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/40 bg-white/15 hover:bg-white/25 transition-all duration-200 backdrop-blur-md shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#1E7F43]"
                >
                  {/* Avatar do usuário */}
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1E7F43] text-sm font-bold shadow-lg ring-2 ring-white/30"
                    aria-hidden="true"
                  >
                    {getUserInitial()}
                  </div>

                  {/* Informações do usuário (ocultas em telas pequenas) */}
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-bold text-white leading-tight">
                      {getUserDisplayName()}
                    </p>
                    <p className="text-xs text-white/95 font-medium">Perfil</p>
                  </div>

                  {/* Ícone de dropdown */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 text-white transition-transform duration-300 ${showProfileMenu ? 'rotate-180' : ''
                      }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Menu Dropdown do Perfil */}
                {showProfileMenu && (
                  <div
                    className="absolute right-0 mt-3 w-56 sm:w-64 rounded-2xl border border-[#E5E5E5] bg-white shadow-2xl z-50 overflow-hidden animate-[slideDown_0.2s_ease-out]"
                    role="menu"
                    aria-orientation="vertical"
                  >
                    {/* Cabeçalho do menu com informações do usuário */}
                    <div className="p-5 bg-gradient-to-br from-[#F9F9F9] to-white border-b border-[#E5E5E5]">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1E7F43] text-white text-sm font-bold shadow-md">
                          {getUserInitial()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#1F1F1F] truncate" aria-label="Informações do usuário">
                            {profile?.name || getUserDisplayName() || 'Usuário'}
                          </p>
                          {profile?.phone && (
                            <p className="text-xs text-[#1F1F1F]/60 font-medium">
                              {formatPhone(profile.phone)}
                            </p>
                          )}
                          {!profile?.phone && (
                            <p className="text-xs text-[#1F1F1F]/60 font-medium">Perfil do usuário</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Itens do menu */}
                    <div className="p-2" role="group">
                      {/* Painel Administrativo (admin) */}
                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={closeProfileMenu}
                          role="menuitem"
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#1E7F43] hover:bg-[#1E7F43]/10 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1E7F43]/20 group"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                          Painel Administrativo
                        </Link>
                      )}

                      {/* Concursos (admin) - Gerenciar e Criar acima de Meus Tickets */}
                      {isAdmin && (
                        <>
                          <Link
                            to="/admin/contests"
                            onClick={closeProfileMenu}
                            role="menuitem"
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#1E7F43] hover:bg-[#1E7F43]/10 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1E7F43]/20 group"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Gerenciar Concursos
                          </Link>
                          <Link
                            to="/admin/contests/new"
                            onClick={closeProfileMenu}
                            role="menuitem"
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#1E7F43] hover:bg-[#1E7F43]/10 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1E7F43]/20 group"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Criar Novo Concurso
                          </Link>
                        </>
                      )}

                      <div className="my-2 border-t border-[#E5E5E5]" role="separator"></div>

                      <Link
                        to="/contests"
                        onClick={closeProfileMenu}
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#1F1F1F] hover:bg-[#F9F9F9] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1E7F43]/20 group"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1F1F1F]/60 group-hover:text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Concursos
                      </Link>

                      <Link
                        to="/settings"
                        onClick={handleProfileClick}
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#1F1F1F] hover:bg-[#F9F9F9] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1E7F43]/20 group"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1F1F1F]/60 group-hover:text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Meu Perfil
                      </Link>


                      {/* Link para Meus Tickets */}
                      <Link
                        to="/my-tickets"
                        onClick={closeProfileMenu}
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#1F1F1F] hover:bg-[#F9F9F9] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1E7F43]/20 group"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1F1F1F]/60 group-hover:text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                        Meus Tickets
                      </Link>

                      {/* Link para Última Compra */}
                      <Link
                        to="/ultima-compra"
                        onClick={closeProfileMenu}
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#1F1F1F] hover:bg-[#F9F9F9] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1E7F43]/20 group"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1F1F1F]/60 group-hover:text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Última Compra
                      </Link>

                      {/* MODIFIQUEI AQUI - Link para Rankings */}
                      <Link
                        to="/rankings"
                        onClick={closeProfileMenu}
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#1F1F1F] hover:bg-[#F9F9F9] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1E7F43]/20 group"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1F1F1F]/60 group-hover:text-[#F4C430]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                        Rankings
                      </Link>

                      <button
                        type="button"
                        onClick={handleSettingsClick}
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#1F1F1F] hover:bg-[#F9F9F9] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1E7F43]/20 group"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1F1F1F]/60 group-hover:text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Configurações
                      </button>

                      <div className="my-2 border-t border-[#E5E5E5]" role="separator"></div>

                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-200 group"
                      >
                        {isLoggingOut ? (
                          <>
                            {/* MODIFIQUEI AQUI - Spinner animado durante logout */}
                            <svg
                              className="animate-spin h-5 w-5 text-red-600"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            <span className="animate-pulse">Saindo...</span>
                          </>
                        ) : (
                          <>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 group-hover:scale-110 transition-transform duration-200"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Sair</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      </header>
    </>
  )
}
