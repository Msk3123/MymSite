import { useEffect, useState } from 'react'
import { CloseIcon } from '../../components/Icons'
import { catalogQueryString, countProducts } from '../../api/products'
import { EMPTY_FILTERS, type CatalogFilters } from '../../lib/filters'
import { itemsCount } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { FiltersPanel } from './FiltersPanel'

interface FiltersSheetProps {
  initial: CatalogFilters
  onApply: (filters: CatalogFilters) => void
  onClose: () => void
}

/** Мобільна шторка: зміни накопичуються в чернетці й застосовуються кнопкою «Показати». */
export function FiltersSheet({ initial, onApply, onClose }: FiltersSheetProps) {
  const [draft, setDraft] = useState(initial)
  const { data: count } = useAsync(`sheet:${catalogQueryString({ filters: draft })}`, () => countProducts({ filters: draft }), {
    keepPrevious: true,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="filters-h"
        className="sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__grabber" aria-hidden="true" />
        <div className="sheet__head">
          <h2 id="filters-h">Фільтри</h2>
          <button className="icon-btn" aria-label="Закрити фільтри" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="sheet__body">
          <FiltersPanel value={draft} onChange={setDraft} />
        </div>
        <div className="sheet__foot">
          <button className="btn btn--outline sheet__reset" onClick={() => setDraft({ ...EMPTY_FILTERS, q: draft.q })}>
            Скинути
          </button>
          <button className="btn btn--primary sheet__apply" onClick={() => onApply(draft)}>
            {count === undefined ? 'Показати' : count ? `Показати ${itemsCount(count)}` : 'Нічого не знайдено'}
          </button>
        </div>
      </section>
    </div>
  )
}
