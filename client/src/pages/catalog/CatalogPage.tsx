import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ChatIcon, ChevronDownIcon, FilterIcon, SmallCloseIcon } from '../../components/Icons'
import { ProductCard } from '../../components/ProductCard'
import { MobileHeader, SearchField } from '../../components/SiteHeader'
import { SHOP } from '../../config'
import { catalogQueryString, countProducts, fetchProducts } from '../../api/products'
import { LoadError } from '../../components/LoadError'
import { CATEGORIES, GENDERS, SIZES, sizeInfo } from '../../data/catalog'
import {
  activeChips,
  EMPTY_FILTERS,
  filtersToParams,
  parseFilters,
  parseSort,
  SORTS,
  type CatalogFilters,
  type SortKey,
} from '../../lib/filters'
import { itemsCount } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { FiltersPanel } from './FiltersPanel'
import { FiltersSheet } from './FiltersSheet'

// Сервер віддає сторінки по 8: спершу одна, далі «Показати ще» довантажує по дві.
const PAGE_SIZE = 8
const PAGES_PER_MORE = 2

async function loadCatalog(filters: CatalogFilters, sort: SortKey, pages: number) {
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) => fetchProducts({ filters, sort, page: i + 1, pageSize: PAGE_SIZE })),
  )
  return { items: results.flatMap((r) => r.items), total: results[0].totalCount }
}

/** «Для хлопчика, 98 см» — для заголовка сторінки. */
function describe(f: CatalogFilters) {
  const what = f.gender ? GENDERS[f.gender].title : f.category ? CATEGORIES[f.category] : f.size ? 'Речі' : 'Каталог'
  return f.size ? `${what}, ${f.size} см` : what
}

/** «Верхній одяг, 128 см», «Усе для дівчинки, 134 см» — для підказок у порожньому стані. */
function describeSuggestion(f: CatalogFilters) {
  const what = f.category
    ? `${CATEGORIES[f.category]}${!f.size && f.gender ? ` ${GENDERS[f.gender].title.toLowerCase()}` : ''}`
    : f.gender
      ? `Усе ${GENDERS[f.gender].title.toLowerCase()}`
      : 'Усі речі'
  return f.size ? `${what}, ${f.size} см` : what
}

/** Підказки для порожнього стану: сусідні розміри, потім дедалі ширші фільтри. */
async function loadSuggestions(f: CatalogFilters) {
  const candidates: CatalogFilters[] = []
  if (f.size) {
    const i = SIZES.findIndex((s) => s.cm === f.size)
    for (const j of [i - 1, i + 1]) if (SIZES[j]) candidates.push({ ...f, size: SIZES[j].cm })
  }
  const base = { ...EMPTY_FILTERS, gender: f.gender }
  if (f.category) candidates.push({ ...base, size: f.size })
  if (f.size) candidates.push({ ...base, category: f.category })
  if (f.gender) candidates.push(base)

  const counts = await Promise.all(candidates.map((c) => countProducts({ filters: c, includeSold: false })))
  const seen = new Set<string>()
  return candidates
    .map((c, i) => ({ filters: c, label: describeSuggestion(c), count: counts[i] }))
    .filter((s) => s.count > 0 && !seen.has(s.label) && seen.add(s.label))
    .slice(0, 3)
}

function EmptyState({ filters }: { filters: CatalogFilters }) {
  const { data: suggestions = [] } = useAsync(`suggest:${catalogQueryString({ filters })}`, () => loadSuggestions(filters))
  return (
    <div className="empty">
      <section className="empty__card">
        <svg width="132" height="110" viewBox="0 0 132 110" aria-hidden="true">
          <path d="M14 24 H118" stroke="#94867a" strokeWidth="3" strokeLinecap="round" />
          <g fill="none" stroke="#94867a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M66 24 V20 q0 -8 7 -8 q6 0 6 6" />
            <path d="M66 32 L40 46 H92 Z" />
          </g>
          <path d="M40 46 H92" stroke="#dcc29a" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
          <circle cx="104" cy="86" r="5" fill="#d4a59b" />
          <circle cx="88" cy="96" r="3" fill="#8fa68a" />
        </svg>
        <h2>{filters.size ? 'Цього розміру зараз немає' : 'Нічого не знайшлося'}</h2>
        <p>Напишіть, що шукаєте, — я подивлюся в запасах, які ще не встигла сфотографувати, і підберу.</p>
        <a href={SHOP.telegramUrl} target="_blank" rel="noreferrer" className="btn btn--primary btn--block">
          <ChatIcon />
          Написати, я підберу
        </a>
        <div className="btn-pair">
          <a href={SHOP.viberUrl} className="btn btn--ghost">Viber</a>
          <a href={SHOP.telegramUrl} target="_blank" rel="noreferrer" className="btn btn--ghost">Telegram</a>
        </div>
      </section>

      {suggestions.length > 0 && (
        <section className="empty__nearby">
          <h3>Поруч є</h3>
          {suggestions.map((s) => (
            <Link key={s.label} to={`/catalog?${filtersToParams(s.filters)}`} className="nearby-link">
              {s.label}
              <span>{itemsCount(s.count)}</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}

export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pages, setPages] = useState(1)

  const filters = useMemo(() => parseFilters(params), [params])
  const sort = parseSort(params)
  const { data, error, loading } = useAsync(
    `${catalogQueryString({ filters, sort })}|${pages}`,
    () => loadCatalog(filters, sort, pages),
    { keepPrevious: true },
  )
  const chips = activeChips(filters)
  const filterCount = chips.length - (filters.q ? 1 : 0)

  const update = (next: CatalogFilters, nextSort: SortKey = sort) => {
    setParams(filtersToParams(next, nextSort), { replace: true })
    setPages(1)
  }

  const age = filters.size ? sizeInfo(filters.size)?.ageLong : undefined
  const title = filters.q && !filters.gender && !filters.size && !filters.category ? `Пошук: «${filters.q}»` : describe(filters)
  const shown = data?.items ?? []
  const total = data?.total
  const rest = (total ?? 0) - shown.length

  if (error && !data) return <LoadError />

  return (
    <>
      <MobileHeader cart>
        <SearchField placeholder="Що шукаєте?" autoFocus={!!(location.state as { focusSearch?: boolean } | null)?.focusSearch} />
      </MobileHeader>

      <main id="main" className="container catalog">
        <nav aria-label="Навігація" className="breadcrumbs only-desktop">
          <Link to="/">Головна</Link>
          <span aria-hidden="true">/</span>
          <span>Каталог</span>
        </nav>

        <div className="catalog__layout">
          <aside className="catalog__sidebar only-desktop-block" aria-label="Фільтри">
            <div className="catalog__sidebar-head">
              <h2>Фільтри</h2>
              {filterCount > 0 && (
                <button className="text-link" onClick={() => update({ ...EMPTY_FILTERS, q: filters.q })}>
                  Скинути
                </button>
              )}
            </div>
            <FiltersPanel value={filters} onChange={(next) => update(next)} />
          </aside>

          <div className="catalog__content">
            <div className="catalog__head">
              <h1>{title}</h1>
              <span className="catalog__sub">
                {total === undefined ? '\u00a0' : itemsCount(total)}
                {age && ` · ${age}`}
              </span>
            </div>

            <div className="catalog__toolbar">
              <button className="btn btn--dark only-mobile-flex" onClick={() => setSheetOpen(true)}>
                <FilterIcon />
                Фільтри{filterCount > 0 && ` · ${filterCount}`}
              </button>
              <label className="sort-select">
                <span className="visually-hidden">Сортування</span>
                <select value={sort} onChange={(e) => update(filters, e.target.value as SortKey)}>
                  {(Object.keys(SORTS) as SortKey[]).map((key) => (
                    <option key={key} value={key}>{SORTS[key]}</option>
                  ))}
                </select>
                <ChevronDownIcon />
              </label>
            </div>

            {chips.length > 0 && (
              <div className="chips" aria-label="Обрані фільтри">
                {chips.map((chip) => (
                  <button key={chip.label} className="chip" aria-label={`Прибрати фільтр ${chip.label}`} onClick={() => update(chip.without)}>
                    {chip.label}
                    <SmallCloseIcon />
                  </button>
                ))}
                <Link to="/catalog" replace className="chips__reset">Скинути</Link>
              </div>
            )}

            {total === undefined ? null : total === 0 ? (
              <EmptyState filters={filters} />
            ) : (
              <>
                <div className="product-grid" aria-busy={loading}>
                  {shown.map((p) => (
                    <ProductCard key={p.id} product={p} showDiscount />
                  ))}
                </div>
                <div className="catalog__more">
                  <span>Показано {shown.length} з {total}</span>
                  {rest > 0 && (
                    <button
                      className="btn btn--outline btn--block"
                      disabled={loading}
                      onClick={() => setPages((n) => n + PAGES_PER_MORE)}
                    >
                      Показати ще {Math.min(rest, PAGE_SIZE * PAGES_PER_MORE)}
                    </button>
                  )}
                </div>
              </>
            )}

          </div>
        </div>
      </main>

      {sheetOpen && (
        <FiltersSheet
          initial={filters}
          onClose={() => setSheetOpen(false)}
          onApply={(next) => {
            update(next)
            setSheetOpen(false)
          }}
        />
      )}
    </>
  )
}
