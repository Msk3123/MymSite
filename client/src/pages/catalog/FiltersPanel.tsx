import {
  CATEGORIES,
  CONDITIONS,
  GENDERS,
  SEASONS,
  SIZES,
  type Category,
  type Condition,
  type Gender,
  type Season,
} from '../../data/catalog'
import { catalogQueryString, countProducts } from '../../api/products'
import { type CatalogFilters } from '../../lib/filters'
import { useAsync } from '../../lib/useAsync'

interface FiltersPanelProps {
  value: CatalogFilters
  onChange: (next: CatalogFilters) => void
}

const CONDITION_KEYS = Object.keys(CONDITIONS) as Condition[]

const toggle = <T,>(current: T | undefined, next: T) => (current === next ? undefined : next)

const parsePrice = (raw: string) => {
  const n = Number(raw.replace(/\D/g, ''))
  return n > 0 ? n : undefined
}

export function FiltersPanel({ value: f, onChange }: FiltersPanelProps) {
  const set = (patch: Partial<CatalogFilters>) => onChange({ ...f, ...patch })

  // Скільки речей буде для кожного стану, якщо решта фільтрів не зміниться.
  const others = { ...f, conditions: [] }
  const { data: counts } = useAsync(
    `conditions:${catalogQueryString({ filters: others })}`,
    () => Promise.all(CONDITION_KEYS.map((c) => countProducts({ filters: { ...others, conditions: [c] }, includeSold: false }))),
    { keepPrevious: true },
  )
  const conditionCount = (c: Condition) => counts?.[CONDITION_KEYS.indexOf(c)]

  const toggleCondition = (c: Condition) =>
    set({ conditions: f.conditions.includes(c) ? f.conditions.filter((x) => x !== c) : [...f.conditions, c] })

  return (
    <div className="filters">
      <fieldset className="filters__group">
        <legend>Для кого</legend>
        <div className="segmented">
          {(Object.keys(GENDERS) as Gender[]).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={f.gender === g}
              onClick={() => set({ gender: toggle(f.gender, g) })}
            >
              {GENDERS[g].label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="filters__group">
        <legend>
          Зріст, см <span className="filters__hint">· вік підставиться сам</span>
        </legend>
        <div className="chip-row">
          {SIZES.map((s) => (
            <button
              key={s.cm}
              type="button"
              className="choice choice--size"
              aria-pressed={f.size === s.cm}
              title={s.age}
              onClick={() => set({ size: toggle(f.size, s.cm) })}
            >
              {s.cm}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="filters__group">
        <legend>Сезон</legend>
        <div className="chip-row">
          {(Object.keys(SEASONS) as Season[]).map((s) => (
            <button
              key={s}
              type="button"
              className="choice"
              aria-pressed={f.season === s}
              onClick={() => set({ season: toggle(f.season, s) })}
            >
              {SEASONS[s]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="filters__group filters__group--tight">
        <legend>Стан</legend>
        {CONDITION_KEYS.map((c) => (
          <label key={c} className="check-row">
            <input type="checkbox" checked={f.conditions.includes(c)} onChange={() => toggleCondition(c)} />
            <span
              className="badge badge--lg"
              style={{ background: c === 'good' ? '#f3ece1' : CONDITIONS[c].bg, color: CONDITIONS[c].fg }}
            >
              {CONDITIONS[c].label}
            </span>
            <span className="check-row__count">{conditionCount(c)}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="filters__group">
        <legend>Ціна, грн</legend>
        <div className="price-range">
          <label>
            від
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={f.minPrice ?? ''}
              onChange={(e) => set({ minPrice: parsePrice(e.target.value) })}
            />
          </label>
          <span aria-hidden="true">—</span>
          <label>
            до
            <input
              type="text"
              inputMode="numeric"
              placeholder="будь-яка"
              value={f.maxPrice ?? ''}
              onChange={(e) => set({ maxPrice: parsePrice(e.target.value) })}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="filters__group">
        <legend>Категорія</legend>
        <div className="chip-row">
          {(Object.keys(CATEGORIES) as Category[]).map((c) => (
            <button
              key={c}
              type="button"
              className="choice"
              aria-pressed={f.category === c}
              onClick={() => set({ category: toggle(f.category, c) })}
            >
              {CATEGORIES[c]}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
