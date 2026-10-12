import { type Category, type Condition, type Gender, type Product, type ProductStatus, type Season } from '../data/catalog'
import type { CatalogFilters, SortKey } from '../lib/filters'
import { cachedGet } from './http'

// Форма відповідей бекенду (/api/products…).

interface ProductListItemDto {
  id: string
  slug: string
  sku: string
  name: string
  title: string
  brand: string
  gender: Gender
  category: Category
  season: Season
  condition: Condition
  sizeCm: number
  sizeNote: string | null
  price: number
  oldPrice: number | null
  status: ProductStatus
  lotContents: string | null
  coverUrl: string | null
}

interface ProductDto extends ProductListItemDto {
  description: string
  seasonNote: string | null
  composition: string | null
  insulation: string | null
  fitNote: string | null
  defectNote: string | null
  measurements: { label: string; shortLabel: string; valueCm: number }[]
  photos: { id: string; url: string; caption: string | null; isDefect: boolean }[]
}

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  hasNextPage: boolean
}

const orUndefined = <T,>(value: T | null) => value ?? undefined

function fromListItem(dto: ProductListItemDto): Product {
  return {
    id: dto.slug,
    uid: dto.id,
    sku: dto.sku,
    name: dto.name,
    title: dto.title,
    brand: dto.brand,
    gender: dto.gender,
    size: dto.sizeCm,
    sizeNote: orUndefined(dto.sizeNote),
    season: dto.season,
    category: dto.category,
    condition: dto.condition,
    price: dto.price,
    oldPrice: orUndefined(dto.oldPrice),
    status: dto.status,
    sold: dto.status !== 'available',
    lotContents: orUndefined(dto.lotContents),
    coverUrl: orUndefined(dto.coverUrl),
  }
}

function fromProduct(dto: ProductDto): Product {
  return {
    ...fromListItem(dto),
    description: dto.description,
    seasonNote: orUndefined(dto.seasonNote),
    composition: orUndefined(dto.composition),
    insulation: orUndefined(dto.insulation),
    fitNote: orUndefined(dto.fitNote),
    defect: orUndefined(dto.defectNote),
    photos: dto.photos.map((ph) => ({ url: ph.url, caption: orUndefined(ph.caption), isDefect: ph.isDefect })),
    measurements: dto.measurements.length
      ? dto.measurements.map((m) => ({ label: m.label, short: m.shortLabel, value: m.valueCm }))
      : undefined,
  }
}

const API_SORT: Record<SortKey, string> = { new: 'newest', cheap: 'price-asc', expensive: 'price-desc' }

export interface CatalogQuery {
  filters?: Partial<CatalogFilters>
  sort?: SortKey
  /** false — лише те, що можна замовити зараз */
  includeSold?: boolean
  page?: number
  pageSize?: number
}

/** Однакові фільтри → однаковий рядок, тож і кеш, і ключі useAsync збігаються. */
export function catalogQueryString({ filters = {}, sort = 'new', includeSold = true, page, pageSize }: CatalogQuery) {
  const params = new URLSearchParams()
  if (filters.gender) params.set('gender', filters.gender)
  if (filters.size) params.set('size', String(filters.size))
  if (filters.season) params.set('season', filters.season)
  if (filters.conditions?.length) params.set('conditions', [...filters.conditions].sort().join(','))
  if (filters.category) params.set('category', filters.category)
  if (filters.minPrice) params.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice))
  if (filters.q) params.set('search', filters.q)
  if (sort !== 'new') params.set('sort', API_SORT[sort])
  if (!includeSold) params.set('includeSold', 'false')
  if (page) params.set('page', String(page))
  if (pageSize) params.set('pageSize', String(pageSize))
  return params.toString()
}

export async function fetchProducts(query: CatalogQuery): Promise<Page<Product>> {
  const page = await cachedGet<Page<ProductListItemDto>>(`/products?${catalogQueryString(query)}`)
  return { ...page, items: page.items.map(fromListItem) }
}

export async function countProducts(query: Omit<CatalogQuery, 'sort' | 'page' | 'pageSize'>): Promise<number> {
  const { count } = await cachedGet<{ count: number }>(`/products/count?${catalogQueryString(query)}`)
  return count
}

export async function fetchProduct(slug: string): Promise<Product> {
  return fromProduct(await cachedGet<ProductDto>(`/products/${encodeURIComponent(slug)}`))
}

/** Свіжі дані для кошика. Порядок — як у переданому списку. */
export async function lookupProducts(slugs: string[]): Promise<Product[]> {
  if (!slugs.length) return []
  const items = await cachedGet<ProductListItemDto[]>(`/products/lookup?slugs=${slugs.map(encodeURIComponent).join(',')}`)
  const bySlug = new Map(items.map((dto) => [dto.slug, fromListItem(dto)]))
  return slugs.map((s) => bySlug.get(s)).filter((p): p is Product => !!p)
}

