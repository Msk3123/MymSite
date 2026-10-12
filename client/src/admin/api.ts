import { invalidateCache, request } from '../api/http'
import type { Category, Condition, Gender, ProductStatus, Season } from '../data/catalog'

// ---------- Типи відповідей /api/admin ----------

export type AdminProductStatus = ProductStatus | 'draft'
export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'completed' | 'cancelled'
export type ProductAction = 'publish' | 'unpublish' | 'mark-sold'
export type OrderAction = 'confirm' | 'ship' | 'complete' | 'cancel'
export type BulkAction = 'hide' | 'discount10' | 'delete'

export interface Me {
  login: string
  ownerName: string
  /** Кличний відмінок: «Ларисо» */
  greetingName: string
}

export interface Summary {
  localTime: string
  ordersToday: number
  revenueToday: number
  ordersThisMonth: number
  revenueThisMonth: number
  newOrders: number
  confirmedOrders: number
  shippedOrders: number
  completedOrders: number
  cancelledOrders: number
  itemsOnSale: number
  itemsReserved: number
  itemsSold: number
  drafts: number
  itemsSoldThisMonth: number
  valueOnSale: number
  weeklySales: { weekStart: string; orders: number; total: number }[]
  staleItems: { id: string; name: string; brand: string; sizeCm: number; sizeNote: string | null; price: number; daysOnSite: number; coverUrl: string | null }[]
}

export interface AdminProductListItem {
  id: string
  slug: string
  sku: string
  name: string
  brand: string
  gender: Gender
  category: Category
  condition: Condition
  sizeCm: number
  sizeNote: string | null
  price: number
  oldPrice: number | null
  status: AdminProductStatus
  coverUrl: string | null
  createdAtUtc: string
  storageLocation: string | null
  hasDefect: boolean
  lotContents: string | null
}

export interface Photo {
  id: string
  url: string
  caption: string | null
  isDefect: boolean
}

export interface AdminProduct extends Omit<AdminProductListItem, 'hasDefect'> {
  title: string
  season: Season
  description: string
  seasonNote: string | null
  composition: string | null
  insulation: string | null
  fitNote: string | null
  defectNote: string | null
  measurements: { label: string; shortLabel: string; valueCm: number }[]
  photos: Photo[]
}

export interface ProductInput {
  name: string
  title: string | null
  brand: string | null
  gender: Gender
  category: Category
  season: Season
  condition: Condition
  sizeCm: number
  price: number
  oldPrice: number | null
  description: string | null
  sizeNote: string | null
  seasonNote: string | null
  composition: string | null
  insulation: string | null
  fitNote: string | null
  defectNote: string | null
  lotContents: string | null
  measurements: { label: string; shortLabel: string | null; valueCm: number }[]
  storageLocation: string | null
}

export interface OrderItem {
  productId: string
  slug: string
  sku: string
  name: string
  sizeCm: number
  condition: Condition
  price: number
  coverUrl?: string | null
  storageLocation?: string | null
}

export interface Order {
  id: string
  number: number
  createdAtUtc: string
  status: OrderStatus
  customerName: string
  phone: string
  city: string
  branch: string
  payment: 'card' | 'cash-on-delivery'
  comment: string | null
  adminNote: string | null
  trackingNumber: string | null
  subtotal: number
  discount: number
  total: number
  items: OrderItem[]
  /** Лише в деталях замовлення */
  customerHistory?: { orders: number; total: number } | null
}

export interface Page<T> {
  items: T[]
  totalCount: number
  hasNextPage: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

/** Що помічник побачив на фото. uncertain — поля, які треба перевірити. */
export interface ProductSuggestion {
  name: string
  brand: string | null
  gender: Gender
  category: Category
  season: Season
  condition: Condition
  sizeCm: number | null
  sizeNote: string | null
  composition: string | null
  insulation: string | null
  description: string
  defectNote: string | null
  conditionNote: string | null
  uncertain: string[]
}

export type AssistantActionKind =
  | 'update-product' | 'publish-product' | 'hide-product' | 'mark-product-sold' | 'delete-product'
  | 'confirm-order' | 'ship-order' | 'complete-order' | 'cancel-order'

/** Дія, яку помічник підготував у «Режимі дій». Виконується лише після «Так» (adminApi.executeAction). */
export interface AssistantAction {
  kind: AssistantActionKind
  summary: string
  sku?: string | null
  orderNumber?: number | null
  price?: number | null
  oldPrice?: number | null
  removeOldPrice?: boolean
  name?: string | null
  description?: string | null
  storageLocation?: string | null
  trackingNumber?: string | null
}

export interface PriceHint {
  min: number
  max: number
  soldCount: number
  count: number
}

// ---------- Підписи для людей ----------

export const PRODUCT_STATUS: Record<AdminProductStatus, { label: string; dot: string; bg: string; fg: string }> = {
  draft: { label: 'Чернетка', dot: '#b5532f', bg: '#f6e1d6', fg: '#9a4122' },
  available: { label: 'В наявності', dot: '#4e6b4a', bg: '#e4ebdf', fg: '#4e6b4a' },
  reserved: { label: 'Заброньовано', dot: '#7a5a2e', bg: '#f5ead8', fg: '#7a5a2e' },
  sold: { label: 'Продано', dot: '#94867a', bg: '#ece7e0', fg: '#625a52' },
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tab: string; bg: string; fg: string }> = {
  new: { label: 'Нове', tab: 'Нові', bg: '#f6e1d6', fg: '#9a4122' },
  confirmed: { label: 'Відправити', tab: 'Відправити', bg: '#f5ead8', fg: '#7a5a2e' },
  shipped: { label: 'В дорозі', tab: 'В дорозі', bg: '#e8eef4', fg: '#3f5a73' },
  completed: { label: 'Завершене', tab: 'Завершені', bg: '#e4ebdf', fg: '#4e6b4a' },
  cancelled: { label: 'Скасоване', tab: 'Скасовані', bg: '#ece7e0', fg: '#625a52' },
}

// ---------- Запити ----------

const json = (body: unknown) => JSON.stringify(body)

// Будь-яка зміна в адмінці може змінити каталог — скидаємо кеш публічних сторінок.
async function mutate<T>(path: string, init: RequestInit): Promise<T> {
  try {
    return await request<T>(path, init)
  } finally {
    invalidateCache()
  }
}

export const adminApi = {
  me: () => request<Me>('/admin/me'),
  login: (login: string, password: string) => request<Me>('/admin/login', { method: 'POST', body: json({ login, password }) }),
  logout: () => request<void>('/admin/logout', { method: 'POST' }),

  summary: () => request<Summary>('/admin/summary'),

  products: (status: AdminProductStatus | null, search: string, page = 1, pageSize = 30) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (status) params.set('status', status)
    if (search.trim()) params.set('search', search.trim())
    return request<Page<AdminProductListItem>>(`/admin/products?${params}`)
  },
  product: (id: string) => request<AdminProduct>(`/admin/products/${id}`),
  createProduct: (input: ProductInput) => mutate<AdminProduct>('/admin/products', { method: 'POST', body: json(input) }),
  updateProduct: (id: string, input: ProductInput) =>
    mutate<AdminProduct>(`/admin/products/${id}`, { method: 'PUT', body: json(input) }),
  productStatus: (id: string, action: ProductAction) =>
    mutate<AdminProduct>(`/admin/products/${id}/status`, { method: 'POST', body: json({ action }) }),
  deleteProduct: (id: string) => mutate<void>(`/admin/products/${id}`, { method: 'DELETE' }),
  bulk: (ids: string[], action: BulkAction) =>
    mutate<{ changed: number; skipped: number }>('/admin/products/bulk', { method: 'POST', body: json({ ids, action }) }),
  priceHint: (category: Category) => request<{ hint: PriceHint | null }>(`/admin/products/price-hint?category=${category}`),

  uploadPhoto: (id: string, file: Blob, opts: { isDefect?: boolean; caption?: string } = {}) => {
    const form = new FormData()
    form.append('file', file, 'photo.jpg')
    form.append('isDefect', String(!!opts.isDefect))
    if (opts.caption) form.append('caption', opts.caption)
    return mutate<AdminProduct>(`/admin/products/${id}/photos`, { method: 'POST', body: form })
  },
  deletePhoto: (id: string, photoId: string) =>
    mutate<AdminProduct>(`/admin/products/${id}/photos/${photoId}`, { method: 'DELETE' }),
  makeCover: (id: string, photoId: string) =>
    mutate<AdminProduct>(`/admin/products/${id}/photos/${photoId}/cover`, { method: 'POST' }),

  orders: (status: OrderStatus | null, search: string, page = 1) => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (status) params.set('status', status)
    if (search.trim()) params.set('search', search.trim())
    return request<Page<Order>>(`/admin/orders?${params}`)
  },
  order: (number: number) => request<Order>(`/admin/orders/${number}`),
  orderStatus: (number: number, action: OrderAction, trackingNumber?: string) =>
    mutate<Order>(`/admin/orders/${number}/status`, { method: 'POST', body: json({ action, trackingNumber }) }),
  orderNote: (number: number, note: string) =>
    request<Order>(`/admin/orders/${number}/note`, { method: 'PUT', body: json({ note }) }),

  assistantEnabled: () => request<{ enabled: boolean }>('/admin/assistant'),
  ask: (messages: ChatMessage[], context: string, allowActions: boolean) =>
    request<{ text: string; actions: AssistantAction[]; products: AdminProductListItem[] }>('/admin/assistant', {
      method: 'POST',
      body: json({ messages, context, allowActions }),
    }),
  executeAction: (action: AssistantAction) =>
    mutate<{ message: string }>('/admin/assistant/actions', { method: 'POST', body: json(action) }),
  describe: (photos: Blob[], tagIndex: number | null) => {
    const form = new FormData()
    photos.forEach((p, i) => form.append('files', p, `photo-${i}.jpg`))
    if (tagIndex !== null) form.append('tagIndex', String(tagIndex))
    return request<ProductSuggestion>('/admin/assistant/describe', { method: 'POST', body: form })
  },
}
