import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { lookupProducts } from '../api/products'
import type { Product } from '../data/catalog'
import { SHOP } from '../config'
import { useAsync } from '../lib/useAsync'

const STORAGE_KEY = 'mamyna-shafa:cart'

interface CartValue {
  items: Product[]
  /** Речі, які лежали в кошику, але їх уже продали чи забронювали — вони прибрані. */
  dropped: Product[]
  /** Дані з сервера ще не прийшли */
  loading: boolean
  count: number
  subtotal: number
  discount: number
  total: number
  has: (id: string) => boolean
  add: (id: string) => void
  remove: (id: string) => void
  clear: () => void
  /** Перечитати статуси речей (після помилки «вже замовили») */
  refresh: () => void
}

const CartContext = createContext<CartValue | null>(null)

function loadIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const ids: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(loadIds)
  const [dropped, setDropped] = useState<Product[]>([])
  const [version, setVersion] = useState(0)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    } catch {
      // приватний режим — кошик просто не переживе перезавантаження
    }
  }, [ids])

  // Ціни й статуси завжди беремо з сервера: у localStorage лише slug-и.
  const key = ids.length ? `${ids.join(',')}#${version}` : null
  const { data: loaded, loading } = useAsync(key, () => lookupProducts(ids), { keepPrevious: true })

  // Річ зникла з бази або її вже хтось замовив — прибираємо з кошика й кажемо про це.
  useEffect(() => {
    if (!loaded || loading) return
    const known = new Map(loaded.map((p) => [p.id, p]))
    const gone = ids.filter((id) => !known.get(id) || known.get(id)!.sold)
    if (!gone.length) return
    setDropped((prev) => [...prev, ...gone.map((id) => known.get(id)).filter((p): p is Product => !!p)])
    setIds((prev) => prev.filter((id) => !gone.includes(id)))
  }, [loaded, loading, ids])

  // Кожна річ в одному екземплярі, тому кошик — це просто набір id.
  const add = useCallback((id: string) => setIds((prev) => (prev.includes(id) ? prev : [...prev, id])), [])
  const remove = useCallback((id: string) => setIds((prev) => prev.filter((x) => x !== id)), [])
  const clear = useCallback(() => {
    setIds([])
    setDropped([])
  }, [])
  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  const value = useMemo<CartValue>(() => {
    const items = ids.map((id) => loaded?.find((p) => p.id === id)).filter((p): p is Product => !!p && !p.sold)
    const subtotal = items.reduce((sum, p) => sum + p.price, 0)
    const { minItems, percent } = SHOP.bulkDiscount
    const discount = items.length >= minItems ? Math.round((subtotal * percent) / 100) : 0
    const pending = ids.length > 0 && (loading || !loaded)
    return {
      items,
      dropped,
      loading: pending,
      // Поки дані вантажаться, значок кошика показує збережену кількість — без блимання нуля.
      count: pending ? ids.length : items.length,
      subtotal,
      discount,
      total: subtotal - discount,
      has: (id) => ids.includes(id),
      add,
      remove,
      clear,
      refresh,
    }
  }, [ids, loaded, loading, dropped, add, remove, clear, refresh])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
