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
import logodezaqui from '../assets/logodezaqui.png'

// Constantes
const MENU_ANIMATION_DURATION = 200

export default function Header() {
  const navigate = useNavigate()
  const { user, isAdmin, logout } = useAuth()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  /**
   * Obtém o nome de exibição do usuário a partir do email
   */
  const getUserDisplayName = useCallback(() => {
    if (!user?.email) return 'Usuário'
    return user.email.split('@')[0]
  }, [user])

  /**
   * Obtém a inicial do usuário para o avatar
   */
  const getUserInitial = useCallback(() => {
    if (!user?.email) return 'U'
    return user.email.charAt(0).toUpperCase()
  }, [user])

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
   * Navega para a página de perfil (quando implementada)
   */
  const handleProfileClick = useCallback(() => {
    closeProfileMenu()
    // TODO: Implementar navegação para página de perfil
    // navigate('/profile')
  }, [closeProfileMenu])

  /**
   * Navega para a página de configurações (quando implementada)
   */
  const handleSettingsClick = useCallback(() => {
    closeProfileMenu()
    // TODO: Implementar navegação para página de configurações
    // navigate('/settings')
  }, [closeProfileMenu])

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
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showProfileMenu) {
        closeProfileMenu()
      }
    }

    if (showProfileMenu) {
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
  }, [showProfileMenu, closeProfileMenu])

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
        className={`relative sticky top-0 z-50 shadow-2xl transition-opacity duration-300 ${
          isFadingOut ? 'opacity-0' : 'opacity-100'
        }`}
        role="banner"
        aria-label="Cabeçalho principal"
      >
      {/* Gradiente de fundo com overlay sutil */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1E7F43] via-[#1E7F43] to-[#3CCB7F]" aria-hidden="true"></div>
      <div className="absolute inset-0 bg-black/5" aria-hidden="true"></div>
      
      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex items-center justify-between" role="navigation" aria-label="Navegação principal">
          {/* MODIFIQUEI AQUI - Logo e Nome da Plataforma */}
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

          {/* Links de Navegação - Visíveis para todos */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/contests"
              className="px-4 py-2 text-white/90 hover:text-white font-semibold text-sm rounded-lg hover:bg-white/10 transition-all"
            >
              Concursos
            </Link>
            
            {/* Apenas link "Dashboard" quando admin e autenticado */}
            {user && isAdmin && (
              <Link
                to="/admin"
                className="px-4 py-2 text-white/90 hover:text-white font-semibold text-sm rounded-lg hover:bg-white/10 transition-all"
              >
                Dashboard
              </Link>
            )}
          </div>

          {/* MODIFIQUEI AQUI - Mostrar botões de Login/Cadastro quando não autenticado */}
          {!user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 text-white/90 hover:text-white font-semibold text-sm rounded-lg hover:bg-white/10 transition-all border border-white/30"
              >
                Login
              </Link>
              <Link
                to="/login"
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
                className={`h-4 w-4 text-white transition-transform duration-300 ${
                  showProfileMenu ? 'rotate-180' : ''
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
                      <p className="text-sm font-bold text-[#1F1F1F] truncate" aria-label="Email do usuário">
                        {user.email || 'Usuário'}
                      </p>
                      <p className="text-xs text-[#1F1F1F]/60 font-medium">Perfil do usuário</p>
                    </div>
                  </div>
                </div>
                
                {/* Itens do menu */}
                <div className="p-2" role="group">
                  {/* CHATGPT: alterei aqui - Links admin atualizados no dropdown do perfil */}
                  {isAdmin && (
                    <>
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
                      <div className="my-2 border-t border-[#E5E5E5]" role="separator"></div>
                    </>
                  )}
                  
                  <button
                    type="button"
                    onClick={handleProfileClick}
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#1F1F1F] hover:bg-[#F9F9F9] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1E7F43]/20 group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1F1F1F]/60 group-hover:text-[#1E7F43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Meu Perfil
                  </button>
                  
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
