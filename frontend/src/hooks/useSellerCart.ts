import { useCallback, useState } from 'react'

export type SellerCartItem = {
  id: string
  contestId: string
  contestName: string
  contestCode?: string | null
  contestStartDate?: string | null
  selectedNumbers: number[]
  price: number
  addedAt: number
}

function newCartItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `sc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function useSellerCart() {
  const [items, setItems] = useState<SellerCartItem[]>([])

  const addItem = useCallback((item: Omit<SellerCartItem, 'id' | 'addedAt'>) => {
    setItems((prev) => [
      ...prev,
      {
        ...item,
        id: newCartItemId(),
        addedAt: Date.now(),
      },
    ])
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const getTotalPrice = useCallback(() => {
    return items.reduce((sum, it) => sum + it.price, 0)
  }, [items])

  return {
    items,
    addItem,
    removeItem,
    clearCart,
    getTotalPrice,
    itemCount: items.length,
  }
}
