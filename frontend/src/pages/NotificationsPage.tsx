/**
 * Página de Notificações Internas
 *
 * Lista notificações do usuário e permite marcar como lida.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Notif = {
  id: string
  title: string
  message: string
  link: string | null
  read_at: string | null
  created_at: string
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)

  // MODIFIQUEI AQUI - controle do dropdown do sino (sem mexer no Header global)
  const [isBellOpen, setIsBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement | null>(null)

  // MODIFIQUEI AQUI - pendentes (badge)
  const unreadCount = useMemo(() => items.filter((n) => !n.read_at).length, [items])

  useEffect(() => {
    async function load() {
      try {
        if (!user?.id) {
          setItems([])
          return
        }
        setLoading(true)

        // MODIFIQUEI AQUI - buscar somente notificações do usuário
        const { data, error } = await supabase
          .from('notifications')
          .select('id,title,message,link,read_at,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error

        setItems((data ?? []) as Notif[])
      } catch (e) {
        console.error('[NotificationsPage] Erro ao carregar notificações:', e)
        setItems([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id])

  // MODIFIQUEI AQUI - fechar dropdown ao clicar fora
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!isBellOpen) return
      const target = e.target as Node
      if (bellRef.current && !bellRef.current.contains(target)) {
        setIsBellOpen(false)
      }
    }
    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [isBellOpen])

  async function markAsRead(id: string) {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', id)
      .eq('user_id', user?.id ?? '')

    if (!error) {
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read_at: now } : x)))
    }
    return now
  }

  async function markAllAsRead() {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id)
    if (ids.length === 0) return
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user?.id ?? '')
      .in('id', ids)

    if (!error) {
      setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })))
    }
  }

  async function openNotif(n: Notif) {
    // MODIFIQUEI AQUI - marca como lido antes de navegar
    if (!n.read_at) {
      await markAsRead(n.id)
    }
    if (n.link) navigate(n.link)
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
      <Header />

      <div className="container mx-auto px-2 sm:px-4 pb-6 sm:pb-8 flex-1 max-w-5xl">
        <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-4 sm:p-6 md:p-8 shadow-xl mt-4 sm:mt-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1F1F1F]">Notificações</h1>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-[#1E7F43] hover:bg-[#1E7F43]/10 transition border border-[#1E7F43]"
              >
                Marcar todas como lidas
              </button>
            )}

            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setIsBellOpen((v) => !v)}
                className="relative rounded-2xl border border-[#E5E5E5] bg-white px-4 py-2 font-bold text-[#1F1F1F] shadow-sm hover:shadow-md transition flex items-center gap-2"
                title="Abrir notificações"
              >
                <span className="text-lg">🔔</span>
                <span className="hidden sm:inline">Caixa</span>

                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[24px] h-6 px-2 rounded-full bg-red-500 text-white text-xs font-extrabold flex items-center justify-center shadow">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* MODIFIQUEI AQUI - dropdown */}
              {isBellOpen && (
                <div className="absolute right-0 mt-2 w-[340px] max-w-[90vw] rounded-3xl border border-[#E5E5E5] bg-white shadow-2xl overflow-hidden z-50">
                  <div className="p-4 border-b border-[#E5E5E5] flex items-center justify-between">
                    <div className="font-extrabold text-[#1F1F1F]">Pendentes</div>
                    <div className="text-xs text-[#1F1F1F]/50">{unreadCount} não lida(s)</div>
                  </div>

                  <div className="max-h-[360px] overflow-auto">
                    {items.filter((n) => !n.read_at).length === 0 ? (
                      <div className="p-4 text-sm text-[#1F1F1F]/70">Sem notificações pendentes 🎉</div>
                    ) : (
                      <div className="p-2 space-y-2">
                        {items
                          .filter((n) => !n.read_at)
                          .slice(0, 8)
                          .map((n) => (
                            <button
                              key={n.id}
                              onClick={() => {
                                setIsBellOpen(false)
                                openNotif(n)
                              }}
                              className="w-full text-left rounded-2xl border border-[#F4C430] bg-[#F4C430]/10 p-3 hover:bg-[#F4C430]/15 transition"
                            >
                              <div className="font-extrabold text-[#1F1F1F] text-sm">{n.title}</div>
                              <div className="text-xs text-[#1F1F1F]/70 mt-1 line-clamp-2">{n.message}</div>
                              <div className="text-[11px] text-[#1F1F1F]/40 mt-2">
                                {new Date(n.created_at).toLocaleString()}
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3 border-t border-[#E5E5E5] flex justify-end">
                    <button
                      onClick={() => setIsBellOpen(false)}
                      className="rounded-xl px-3 py-2 text-sm font-bold text-[#1F1F1F]/70 hover:bg-black/5 transition"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-[#1F1F1F]/70">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="text-[#1F1F1F]/70">Você não tem notificações no momento.</div>
          ) : (
            <div className="space-y-3">
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    n.read_at ? 'border-[#E5E5E5] bg-white' : 'border-[#F4C430] bg-[#F4C430]/10'
                  }`}
                >
                  <button
                    onClick={() => openNotif(n)}
                    className="block w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-extrabold text-[#1F1F1F]">{n.title}</div>
                      {!n.read_at && (
                        <span className="text-[11px] font-extrabold px-2 py-1 rounded-full bg-[#F4C430] text-[#1F1F1F]">
                          NOVA
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-[#1F1F1F]/70 mt-1">{n.message}</div>
                    <div className="text-xs text-[#1F1F1F]/40 mt-2">{new Date(n.created_at).toLocaleString()}</div>
                  </button>

                  {!n.read_at && (
                    <div className="mt-3 pt-3 border-t border-[#E5E5E5]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(n.id)
                        }}
                        className="text-sm font-semibold text-[#1E7F43] hover:text-[#3CCB7F] transition"
                      >
                        Marcar como lida
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
