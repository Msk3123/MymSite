import { useCallback, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CameraIcon, PlusIcon, SearchIcon } from '../../components/Icons'
import { formatPrice, itemsCount } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { adminApi, PRODUCT_STATUS, type AdminProductListItem, type AdminProductStatus, type BulkAction } from '../api'
import { ConfirmDialog } from '../ConfirmDialog'
import { ConditionTag, daysSince, Empty, ErrorNote, ProductStatusDot, useAdmin, useAssistantContext, useDataChanged } from '../ui'

type Tab = AdminProductStatus | 'all'
const TABS: Tab[] = ['all', 'available', 'reserved', 'sold', 'draft']
const TAB_LABEL: Record<Tab, string> = { all: 'Усі', available: 'В наявності', reserved: 'Заброньовано', sold: 'Продано', draft: 'Чернетки' }

const isTab = (v: string | null): v is Tab => v === 'all' || (!!v && Object.hasOwn(PRODUCT_STATUS, v))
const sizeOf = (p: AdminProductListItem) => p.sizeNote?.replace(' см', '') ?? String(p.sizeCm)

function Thumb({ p }: { p: AdminProductListItem }) {
  return <span className="a-thumb">{p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" /> : <CameraIcon size={18} aria-label="Без фото" />}</span>
}

export function ProductsPage() {
  const { summary, refreshSummary } = useAdmin()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const raw = params.get('status')
  const tab: Tab = isTab(raw) ? raw : 'all'
  const search = params.get('q') ?? ''
  const [pages, setPages] = useState(1)
  const [version, setVersion] = useState(0)
  // Помічник змінив дані (режим дій) — перечитуємо.
  useDataChanged(useCallback(() => setVersion((v) => v + 1), []))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const location = useLocation()
  // Повідомлення з іншої сторінки: «"Світшот" видалено.»
  const [bulkNote, setBulkNote] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null)
  const [ask, setAsk] = useState<BulkAction | null>(null)
  const [bulkError, setBulkError] = useState<unknown>(null)
  const timer = useRef<number | undefined>(undefined)

  const update = (next: { status?: Tab; q?: string }) => {
    const p = new URLSearchParams()
    const status = next.status ?? tab
    const q = next.q ?? search
    if (status !== 'all') p.set('status', status)
    if (q) p.set('q', q)
    setPages(1)
    setSelected(new Set())
    setParams(p, { replace: true })
  }

  const { data, error, loading } = useAsync(`products:${tab}:${search}:${pages}:${version}`, async () => {
    const status = tab === 'all' ? null : tab
    const results = await Promise.all(Array.from({ length: pages }, (_, i) => adminApi.products(status, search, i + 1)))
    return { items: results.flatMap((r) => r.items), total: results[0].totalCount, hasMore: results.at(-1)!.hasNextPage }
  }, { keepPrevious: true })

  const chosen = data?.items.filter((p) => selected.has(p.id)) ?? []
  const sizes = [...new Set(chosen.map(sizeOf))]
  useAssistantContext(chosen.length ? `список речей · вибрано ${chosen.length}` : `мої речі · ${TAB_LABEL[tab].toLowerCase()}`)

  const counts: Partial<Record<Tab, number>> = summary
    ? { available: summary.itemsOnSale, reserved: summary.itemsReserved, sold: summary.itemsSold, draft: summary.drafts,
        all: summary.itemsOnSale + summary.itemsReserved + summary.itemsSold + summary.drafts }
    : {}

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const BULK_TEXT: Record<BulkAction, { title: string; text: string; confirm: string; danger?: boolean; skipped: string }> = {
    hide: {
      title: 'Сховати з сайту?',
      text: 'Покупці їх не побачать. Опублікувати знову можна будь-коли.',
      confirm: 'Так, сховати',
      skipped: 'заброньовані, продані або вже сховані',
    },
    discount10: {
      title: 'Знизити ціну на 10%?',
      text: 'Стара ціна покажеться на сайті закресленою.',
      confirm: 'Так, знизити',
      skipped: 'заброньовані або продані',
    },
    delete: {
      title: 'Видалити назавжди?',
      text: 'Речі зникнуть із сайту й «Моїх речей», фото буде стерто. Повернути не вийде.',
      confirm: 'Так, видалити',
      danger: true,
      skipped: 'заброньовані — вони в замовленні',
    },
  }

  const bulk = async (action: BulkAction) => {
    setBulkBusy(true)
    setBulkError(null)
    try {
      const r = await adminApi.bulk([...selected], action)
      const done = action === 'delete' ? 'Видалено' : 'Готово'
      setBulkNote(`${done}: ${itemsCount(r.changed)}${r.skipped ? `, пропущено ${r.skipped} (${BULK_TEXT[action].skipped})` : ''}.`)
      setSelected(new Set())
      setVersion((v) => v + 1)
      refreshSummary()
    } catch (err) {
      setBulkError(err)
    } finally {
      setBulkBusy(false)
      setAsk(null)
    }
  }

  return (
    <div className="a-page a-page--wide">
      <div className="a-page__head">
        <div>
          <h1 className="a-title">Мої речі</h1>
          {summary && (
            <p className="a-muted">
              {itemsCount(counts.all ?? 0)} · на суму {formatPrice(summary.valueOnSale)} у наявності
            </p>
          )}
        </div>
        <Link to="/admin/products/new" className="a-btn a-btn--primary">
          <PlusIcon size={20} />
          Додати річ
        </Link>
      </div>

      <div className="a-toolbar">
        <div className="a-tabs">
          {TABS.map((t) => (
            <button key={t} className="a-pill" aria-pressed={t === tab} onClick={() => update({ status: t })}>
              {TAB_LABEL[t]}
              {counts[t] !== undefined && <small>{counts[t]}</small>}
            </button>
          ))}
        </div>
        <label className="a-search">
          <SearchIcon size={18} />
          <span className="visually-hidden">Пошук речей</span>
          <input type="search" defaultValue={search} placeholder="Назва, бренд, артикул"
            onChange={(e) => {
              const q = e.target.value.trim()
              window.clearTimeout(timer.current)
              timer.current = window.setTimeout(() => update({ q }), 400)
            }} />
        </label>
      </div>

      {chosen.length > 0 && (
        <div className="a-bulkbar" role="region" aria-label="Дії з вибраними">
          <b>Вибрано {itemsCount(chosen.length)}{sizes.length === 1 && ` · ${sizes[0]} см`}</b>
          <button className="a-btn a-btn--light" disabled={bulkBusy} onClick={() => setAsk('discount10')}>Знижка −10%</button>
          <button className="a-btn a-btn--ghost-dark" disabled={bulkBusy} onClick={() => setAsk('hide')}>Сховати з сайту</button>
          <button className="a-btn a-btn--ghost-dark a-btn--on-dark-danger" disabled={bulkBusy} onClick={() => setAsk('delete')}>Видалити</button>
          <button className="a-btn a-btn--ghost-dark" onClick={() => setSelected(new Set())}>Скасувати вибір</button>
        </div>
      )}
      {bulkNote && <p className="a-notice" role="status">{bulkNote}</p>}
      {ask && (
        <ConfirmDialog title={BULK_TEXT[ask].title} confirmLabel={BULK_TEXT[ask].confirm} danger={BULK_TEXT[ask].danger}
          busy={bulkBusy} onConfirm={() => bulk(ask)} onCancel={() => setAsk(null)}>
          <p>Вибрано <b>{itemsCount(chosen.length)}</b>: {chosen.slice(0, 3).map((p) => `«${p.name}»`).join(', ')}{chosen.length > 3 && ' …'}</p>
          <p>{BULK_TEXT[ask].text}</p>
        </ConfirmDialog>
      )}
      <ErrorNote error={bulkError ?? error} />
      {data && data.items.length === 0 && <Empty>Нічого не знайшлося.</Empty>}

      {data && data.items.length > 0 && (
        <div className="a-table-wrap" aria-busy={loading}>
          <table className="a-table">
            <thead>
              <tr>
                <th><span className="visually-hidden">Вибрати</span></th>
                <th>Річ</th>
                <th>Розмір</th>
                <th>Стан</th>
                <th>Ціна</th>
                <th>Статус</th>
                <th>На сайті</th>
                <th>Де лежить</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className={selected.has(p.id) ? 'is-selected' : undefined} onClick={() => navigate(`/admin/products/${p.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="a-check" aria-label={`Вибрати ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  </td>
                  <td>
                    <Link to={`/admin/products/${p.id}`} className="a-table__item" onClick={(e) => e.stopPropagation()}>
                      <Thumb p={p} />
                      <span>
                        <b>{p.name}</b>
                        <small>{p.sku}{p.brand && ` · ${p.brand}`}</small>
                      </span>
                    </Link>
                  </td>
                  <td className="a-table__size">{sizeOf(p)}</td>
                  <td><ConditionTag condition={p.condition} /></td>
                  <td className="a-table__price">
                    {formatPrice(p.price)}
                    {p.oldPrice && <s>{formatPrice(p.oldPrice)}</s>}
                  </td>
                  <td><ProductStatusDot status={p.status} /></td>
                  <td className="a-muted">{p.status === 'draft' ? '—' : `${daysSince(p.createdAtUtc)} дн.`}</td>
                  <td className="a-muted">{p.storageLocation ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Телефон: та сама інформація карточками */}
          <ul className="a-cards-list">
            {data.items.map((p) => (
              <li key={p.id} className={selected.has(p.id) ? 'is-selected' : undefined}>
                <input type="checkbox" className="a-check" aria-label={`Вибрати ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                <Link to={`/admin/products/${p.id}`} className="a-item-card">
                  <Thumb p={p} />
                  <span className="a-item-card__body">
                    <b>{p.name}</b>
                    <small>{p.sku} · {sizeOf(p)} см{p.storageLocation && ` · ${p.storageLocation}`}</small>
                    <span className="a-item-card__meta">
                      <b>{formatPrice(p.price)}</b>
                      <ProductStatusDot status={p.status} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="a-muted a-table-foot">
        Показано {data?.items.length ?? 0} з {data?.total ?? 0} · «Де лежить» бачите тільки ви — щоб швидко знайти річ при пакуванні
      </p>
      {data?.hasMore && (
        <button className="a-btn a-btn--outline" disabled={loading} onClick={() => setPages((n) => n + 1)}>Показати ще</button>
      )}
    </div>
  )
}
