import { invalidateCache, request } from './http'

export interface PlaceOrderRequest {
  fullName: string
  phone: string
  city: string
  branch: string
  payment: 'card' | 'cash-on-delivery'
  comment: string | null
  productIds: string[]
}

export interface PlacedOrder {
  number: number
  subtotal: number
  discount: number
  total: number
}

export async function placeOrder(body: PlaceOrderRequest): Promise<PlacedOrder> {
  try {
    return await request<PlacedOrder>('/orders', { method: 'POST', body: JSON.stringify(body) })
  } finally {
    // Успіх чи 409 — у будь-якому разі статуси речей могли змінитися.
    invalidateCache()
  }
}
