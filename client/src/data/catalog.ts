export type Gender = 'boy' | 'girl' | 'unisex'
export type Season = 'autumn-winter' | 'spring-summer' | 'all-season'
export type Condition = 'new' | 'like-new' | 'very-good' | 'good'
export type Category = 'outerwear' | 'tops' | 'pants' | 'dresses' | 'shoes' | 'hats' | 'sleepwear' | 'lots'

export const GENDERS: Record<Gender, { label: string; title: string }> = {
  boy: { label: 'Хлопчик', title: 'Для хлопчика' },
  girl: { label: 'Дівчинка', title: 'Для дівчинки' },
  unisex: { label: 'Унісекс', title: 'Унісекс' },
}

export const SEASONS: Record<Season, string> = {
  'autumn-winter': 'Осінь–зима',
  'spring-summer': 'Весна–літо',
  'all-season': 'Всесезон',
}

// rank — позиція на шкалі стану «N з 4» на сторінці товару.
export const CONDITIONS: Record<Condition, { label: string; bg: string; fg: string; rank: number }> = {
  new: { label: 'Нове з біркою', bg: '#e4ebdf', fg: '#4e6b4a', rank: 4 },
  'like-new': { label: 'Як нове', bg: '#f5e3df', fg: '#9a4f4a', rank: 3 },
  'very-good': { label: 'Дуже добрий', bg: '#f5ead8', fg: '#7a5a2e', rank: 2 },
  good: { label: 'Добрий', bg: '#ffffff', fg: '#6b5f54', rank: 1 },
}

export const SOLD_BADGE = { label: 'Продано', bg: '#ece7e0', fg: '#625a52' }
export const RESERVED_BADGE = { label: 'Заброньовано', bg: '#ece7e0', fg: '#625a52' }

export const CATEGORIES: Record<Category, string> = {
  outerwear: 'Верхній одяг',
  tops: 'Кофти і світшоти',
  pants: 'Штани',
  dresses: 'Сукні',
  shoes: 'Взуття',
  hats: 'Шапки',
  sleepwear: 'Боді і піжами',
  lots: 'Комплекти',
}

export interface SizeInfo {
  cm: number
  age: string
  ageLong: string
}

export const SIZES: SizeInfo[] = [
  { cm: 56, age: '0–1 міс', ageLong: '0–1 місяць' },
  { cm: 62, age: '1–3 міс', ageLong: '1–3 місяці' },
  { cm: 68, age: '3–6 міс', ageLong: '3–6 місяців' },
  { cm: 74, age: '6–9 міс', ageLong: '6–9 місяців' },
  { cm: 80, age: '9–12 міс', ageLong: '9–12 місяців' },
  { cm: 86, age: '1–1,5 р', ageLong: '1–1,5 року' },
  { cm: 92, age: '1,5–2 р', ageLong: '1,5–2 роки' },
  { cm: 98, age: '2–3 р', ageLong: '2–3 роки' },
  { cm: 104, age: '3–4 р', ageLong: '3–4 роки' },
  { cm: 110, age: '4–5 р', ageLong: '4–5 років' },
  { cm: 116, age: '5–6 р', ageLong: '5–6 років' },
  { cm: 122, age: '6–7 р', ageLong: '6–7 років' },
  { cm: 128, age: '7–8 р', ageLong: '7–8 років' },
  { cm: 134, age: '8–9 р', ageLong: '8–9 років' },
  { cm: 140, age: '9–10 р', ageLong: '9–10 років' },
]

export const sizeInfo = (cm: number) => SIZES.find((s) => s.cm === cm)

export interface Measurement {
  label: string
  short: string
  value: number
}

export interface ProductPhoto {
  url: string
  caption?: string
  isDefect: boolean
}

export type ProductStatus = 'available' | 'reserved' | 'sold'

export interface Product {
  /** slug — він же адреса сторінки: /product/msh-0412 */
  id: string
  /** id у базі — потрібен для замовлення */
  uid: string
  sku: string
  name: string
  title: string
  brand: string
  gender: Gender
  size: number
  /** Як розмір написано на бірці, якщо це не зріст: «р. 26», «48–50 см». */
  sizeNote?: string
  season: Season
  category: Category
  condition: Condition
  price: number
  oldPrice?: number
  status: ProductStatus
  /** Замовити не можна: продано або вже хтось забронював. */
  sold: boolean
  /** Для комплектів: «Комбінезон, 2 шапки… — 6 речей». */
  lotContents?: string
  /** Головне фото; немає — малюємо силует (lib/placeholderArt). */
  coverUrl?: string
  // Далі — лише на сторінці товару.
  photos?: ProductPhoto[]
  description?: string
  seasonNote?: string
  composition?: string
  insulation?: string
  measurements?: Measurement[]
  fitNote?: string
  defect?: string
}

export const REVIEWS = [
  { text: 'Куртка прийшла чиста, пахне свіжістю. Потертість на рукаві — рівно така, як на фото, не більше. Замовлю ще на весну.', who: 'Ірина, Київ · купила 4 речі' },
  { text: 'Лариса підібрала комплект на 92 см за пів години в Telegram. Відправила наступного ранку.', who: 'Марта, Львів · лот «Перша зима»' },
  { text: 'Брала комбінезон Next як нове — так і є, навіть бірка на запасному ґудзику ціла.', who: 'Наталія, Одеса · купила 2 речі' },
]
