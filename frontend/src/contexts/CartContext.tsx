/**
 * Cart Context - Contexto do Carrinho de Apostas
 *
 * Gerencia o estado do carrinho de compras para permitir múltiplas participações
 * antes de finalizar o pagamento.
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Contest } from '../types'

// Interface para item do carrinho
export interface CartItem {
  id: string // ID único do item no carrinho
  contestId: string
  contestName: string
  contestCode?: string
  selectedNumbers: number[]
  price: number
  addedAt: number // Timestamp
}

// Interface do contexto
interface CartContextType {
  items: CartItem[]
  addItem: (contest: Contest, numbers: number[]) => void
  removeItem: (itemId: string) => void
  clearCart: () => void
  getItemCount: () => number
  getTotalPrice: () => number
  hasItemForContest: (contestId: string) => boolean
  reloadCart: () => void // MODIFIQUEI AQUI - Função para recarregar carrinho do localStorage
}

// Criar contexto
const CartContext = createContext<CartContextType | undefined>(undefined)

// Chave do localStorage
const CART_STORAGE_KEY = 'dezaqui_cart'

// Provider do carrinho
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // MODIFIQUEI AQUI - Função para carregar carrinho do localStorage
  const loadCartFromStorage = useCallback(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY)
      if (savedCart) {
        const parsed = JSON.parse(savedCart) as CartItem[]
        // Filtrar itens muito antigos (mais de 24 horas)
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
        const validItems = parsed.filter(item => item.addedAt > oneDayAgo)
        setItems(validItems)
        console.log('[CartContext] Carrinho carregado do localStorage:', validItems.length, 'itens')
        return validItems
      } else {
        setItems([])
        return []
      }
    } catch (err) {
      console.error('[CartContext] Erro ao carregar carrinho:', err)
      setItems([])
      return []
    }
  }, [])

  // Carregar carrinho do localStorage ao iniciar
  useEffect(() => {
    loadCartFromStorage()
    setIsLoaded(true)
  }, [loadCartFromStorage])

  // MODIFIQUEI AQUI - Recarregar carrinho quando a página recebe foco (útil após logout/login)
  useEffect(() => {
    const handleFocus = () => {
      if (isLoaded) {
        const savedCart = localStorage.getItem(CART_STORAGE_KEY)
        if (savedCart) {
          try {
            const parsed = JSON.parse(savedCart) as CartItem[]
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
            const validItems = parsed.filter(item => item.addedAt > oneDayAgo)
            // Só atualizar se houver diferença
            if (validItems.length !== items.length || 
                JSON.stringify(validItems.map(i => i.id).sort()) !== JSON.stringify(items.map(i => i.id).sort())) {
              setItems(validItems)
              console.log('[CartContext] Carrinho sincronizado do localStorage:', validItems.length, 'itens')
            }
          } catch (err) {
            console.error('[CartContext] Erro ao sincronizar carrinho:', err)
          }
        }
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [isLoaded, items])

  // Salvar carrinho no localStorage sempre que mudar
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
      } catch (err) {
        console.error('[CartContext] Erro ao salvar carrinho:', err)
      }
    }
  }, [items, isLoaded])

  // Adicionar item ao carrinho
  const addItem = useCallback((contest: Contest, numbers: number[]) => {
    const newItem: CartItem = {
      id: `${contest.id}-${Date.now()}`, // ID único
      contestId: contest.id,
      contestName: contest.name,
      contestCode: contest.contest_code ?? undefined,
      selectedNumbers: [...numbers].sort((a, b) => a - b),
      price: contest.participation_value || 0,
      addedAt: Date.now(),
    }

    setItems(prev => [...prev, newItem])
    console.log('[CartContext] Item adicionado ao carrinho:', newItem)
  }, [])

  // Remover item do carrinho
  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId))
    console.log('[CartContext] Item removido do carrinho:', itemId)
  }, [])

  // Limpar carrinho
  const clearCart = useCallback(() => {
    setItems([])
    console.log('[CartContext] Carrinho limpo')
  }, [])

  // Obter quantidade de itens
  const getItemCount = useCallback(() => {
    return items.length
  }, [items])

  // Obter preço total
  const getTotalPrice = useCallback(() => {
    return items.reduce((total, item) => total + item.price, 0)
  }, [items])

  // Verificar se já tem item para um concurso específico
  const hasItemForContest = useCallback((contestId: string) => {
    return items.some(item => item.contestId === contestId)
  }, [items])

  // MODIFIQUEI AQUI - Função para recarregar carrinho do localStorage
  const reloadCart = useCallback(() => {
    console.log('[CartContext] Recarregando carrinho do localStorage...')
    loadCartFromStorage()
  }, [loadCartFromStorage])

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        clearCart,
        getItemCount,
        getTotalPrice,
        hasItemForContest,
        reloadCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

// Hook para usar o contexto
export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart deve ser usado dentro de um CartProvider')
  }
  return context
}
