import {
  CATEGORIES,
  CONDITIONS,
  GENDERS,
  SEASONS,
  type Category,
  type Condition,
  type Gender,
  type Season,
} from '../data/catalog'

export type SortKey = 'new' | 'cheap' | 'expensive'

export const SORTS: Record<SortKey, string> = {
  new: 'Спершу нові',
  cheap: 'Спершу дешевші',
  expensive: 'Спершу дорожчі',
}

export interface CatalogFilters {
  gender?: Gender
  size?: number
  season?: Season
  conditions: Condition[]
  minPrice?: number
  maxPrice?: number
  category?: Category
  q?: string
}

export const EMPTY_FILTERS: CatalogFilters = { conditions: [] }

const isKey = <T extends string>(map: Record<T, unknown>, value: string | null): value is T =>
  value !== null && Object.hasOwn(map, value)

const toNumber = (value: string | null) => {
  if (!value) return undefined
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function parseFilters(params: URLSearchParams): CatalogFilters {
  const gender = params.get('gender')
  const season = params.get('season')
  const category = params.get('cat')
  return {
    gender: isKey(GENDERS, gender) ? gender : undefined,
    size: toNumber(params.get('size')),
    season: isKey(SEASONS, season) ? season : undefined,
    conditions: (params.get('cond') ?? '').split(',').filter((c): c is Condition => isKey(CONDITIONS, c)),
    minPrice: toNumber(params.get('min')),
    maxPrice: toNumber(params.get('max')),
    category: isKey(CATEGORIES, category) ? category : undefined,
    q: params.get('q')?.trim() || undefined,
  }
}

export function parseSort(params: URLSearchParams): SortKey {
  const sort = params.get('sort')
  return isKey(SORTS, sort) ? sort : 'new'
}

export function filtersToParams(f: CatalogFilters, sort: SortKey = 'new') {
  const params = new URLSearchParams()
  if (f.gender) params.set('gender', f.gender)
  if (f.size) params.set('size', String(f.size))
  if (f.season) params.set('season', f.season)
  if (f.conditions.length) params.set('cond', f.conditions.join(','))
  if (f.minPrice) params.set('min', String(f.minPrice))
  if (f.maxPrice) params.set('max', String(f.maxPrice))
  if (f.category) params.set('cat', f.category)
  if (f.q) params.set('q', f.q)
  if (sort !== 'new') params.set('sort', sort)
  return params
}

export const catalogUrl = (f: Partial<CatalogFilters>) =>
  `/catalog?${filtersToParams({ ...EMPTY_FILTERS, ...f })}`

export interface FilterChip {
  label: string
  without: CatalogFilters
}

export function activeChips(f: CatalogFilters): FilterChip[] {
  const chips: FilterChip[] = []
  if (f.gender) chips.push({ label: GENDERS[f.gender].label, without: { ...f, gender: undefined } })
  if (f.size) chips.push({ label: `${f.size} см`, without: { ...f, size: undefined } })
  if (f.season) chips.push({ label: SEASONS[f.season], without: { ...f, season: undefined } })
  if (f.category) chips.push({ label: CATEGORIES[f.category], without: { ...f, category: undefined } })
  for (const c of f.conditions)
    chips.push({ label: CONDITIONS[c].label, without: { ...f, conditions: f.conditions.filter((x) => x !== c) } })
  if (f.minPrice || f.maxPrice)
    chips.push({
      label: `${f.minPrice ?? 0}–${f.maxPrice ?? '∞'} грн`,
      without: { ...f, minPrice: undefined, maxPrice: undefined },
    })
  if (f.q) chips.push({ label: `«${f.q}»`, without: { ...f, q: undefined } })
  return chips
}
