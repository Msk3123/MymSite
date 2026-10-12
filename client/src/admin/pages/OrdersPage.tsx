import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon, CameraIcon, PhoneIcon, SearchIcon } from '../../components/Icons'
import { CONDITIONS } from '../../data/catalog'
import { formatPrice, itemsCount, plural } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { adminApi, ORDER_STATUS, type Order, type OrderAction, type OrderStatus } from '../api'
import { Empty, ErrorNote, longWhen, OrderStatusBadge, shortWhen, useAdmin, useAssistantContext } from '../ui'

const TABS: OrderStatus[] = ['new', 'confirmed', 'shipped', 'completed', 'cancelled']
const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'new', label: 'Нове' },
  { status: 'confirmed', label: 'Підтверджено' },
  { status: 'shipped', label: 'Відправлено' },
  { status: 'completed', label: 'Отримано' },
]

const isStatus = (v: string | null): v is OrderStatus => !!v && Object.hasOwn(ORDER_STATUS, v)
const firstName = (full: string) => full.split(' ')[0]
const payment = (o: Order) => (o.payment === 'card' ? 'на карту' : 'накладений')

function Stepper({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') return <p className="a-info a-info--muted">Замовлення скасоване — речі повернулися в продаж.</p>
  const current = STEPS.findIndex((s) => s.status === status)
  return (
    <ol className="a-steps" aria-label="Етапи замовлення">
      {STEPS.map((s, i) => (
        <li key={s.status} className={i <= current ? 'is-done' : undefined} aria-current={i === current ? 'step' : undefined}>
          {s.label}
        </li>
      ))}
    </ol>
  )
}

function NoteField({ order, onSaved }: { order: Order; onSaved: (o: Order) => void }) {
  const [note, setNote] = useState(order.adminNote ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  useEffect(() => {
    setNote(order.adminNote ?? '')
  }, [order.number, order.adminNote])

  // Зберігаємо, коли мама виходить з поля, — без окремої кнопки.
  const save = async () => {
    if (note === (order.adminNote ?? '')) return
    setState('saving')
    try {
      onSaved(await adminApi.orderNote(order.number, note))
      setState('saved')
    } catch {
      setState('idle')
    }
  }

  return (
    <label className="a-field">
      <span className="a-field__label">
        Нотатка для себе <span className="a-muted">— покупець її не бачить{state === 'saved' && ' · збережено'}</span>
      </span>
      <textarea rows={2} value={note} maxLength={1000} placeholder="Наприклад: покласти в подарунок шкарпетки"
        onChange={(e) => { setNote(e.target.value); setState('idle') }} onBlur={save} />
    </label>
  )
}

function OrderDetails({ number, onChanged }: { number: number; onChanged: () => void }) {
  const { refreshSummary } = useAdmin()
  const [version, setVersion] = useState(0)
  const { data: loaded, error: loadError } = useAsync(`order:${number}:${version}`, () => adminApi.order(number))
  const [order, setOrder] = useState<Order | null>(null)
  const [ttn, setTtn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (loaded) setOrder(loaded)
  }, [loaded])
  useEffect(() => {
    setOrder(null)
    setTtn('')
    setError(null)
  }, [number])

  useAssistantContext(order ? `замовлення №${order.number} · ${firstName(order.customerName)}, ${order.city}` : `замовлення №${number}`)

  if (loadError) return <ErrorNote error={loadError} />
  if (!order) return <div className="a-detail" aria-busy="true" />

  const run = async (action: OrderAction, question?: string) => {
    if (question && !window.confirm(question)) return
    setBusy(true)
    setError(null)
    try {
      setOrder(await adminApi.orderStatus(order.number, action, action === 'ship' ? ttn.trim() : undefined))
      refreshSummary()
      onChanged()
    } catch (err) {
      setError(err)
      setVersion((v) => v + 1)
    } finally {
      setBusy(false)
    }
  }
  const cancel = () => run('cancel', `Скасувати замовлення №${order.number}? Речі знову з’являться на сайті.`)
  const history = order.customerHistory

  return (
    <article className="a-detail">
      <header className="a-detail__head">
        <h2>Замовлення №{order.number}</h2>
        <span className="a-muted">{longWhen(order.createdAtUtc)} · з сайту</span>
      </header>

      <Stepper status={order.status} />

      {order.status === 'new' && (
        <p className="a-info">Речі заброньовані: на сайті вони показані як «Заброньовано», інші покупці їх не замовлять. Зателефонуйте або напишіть покупцю й підтвердіть.</p>
      )}

      <div className="a-detail__grid">
        <div>
          <span className="a-muted">Покупець</span>
          <b className="a-detail__big">{order.customerName}</b>
          <a href={`tel:${order.phone}`} className="a-detail__phone">{order.phone}</a>
          <small className="a-muted">
            {history && history.orders > 0
              ? `Купувала раніше: ${history.orders} ${plural(history.orders, ['раз', 'рази', 'разів'])}, ${formatPrice(history.total)}`
              : 'Купує вперше'}
          </small>
        </div>
        <div>
          <span className="a-muted">Доставка</span>
          <b className="a-detail__big">Нова Пошта, {order.city}</b>
          <span>{order.branch}</span>
          <small className="a-muted">Оплата: {payment(order)}{order.comment && ` · коментар: «${order.comment}»`}</small>
        </div>
      </div>

      <ul className="a-items">
        {order.items.map((i) => (
          <li key={i.productId}>
            <span className="a-items__thumb">{i.coverUrl ? <img src={i.coverUrl} alt="" /> : <CameraIcon size={18} />}</span>
            <span className="a-items__body">
              <a href={`/product/${i.slug}`} target="_blank" rel="noreferrer">{i.name}</a>
              <small>{i.sku} · {i.sizeCm} см · {CONDITIONS[i.condition].label}{i.storageLocation && ` · ${i.storageLocation.toLowerCase()}`}</small>
            </span>
            <b>{formatPrice(i.price)}</b>
          </li>
        ))}
      </ul>

      <div className="a-detail__total">
        <span>Разом{order.discount > 0 && <small className="a-muted"> (знижка −{formatPrice(order.discount)})</small>}</span>
        <b>{formatPrice(order.total)}</b>
      </div>

      {order.trackingNumber && <p>ТТН: <b>{order.trackingNumber}</b></p>}
      <ErrorNote error={error} />

      {order.status === 'new' && (
        <div className="a-detail__actions">
          <button className="a-btn a-btn--primary a-btn--grow" disabled={busy} onClick={() => run('confirm')}>Підтвердити</button>
          <a href={`tel:${order.phone}`} className="a-btn a-btn--outline"><PhoneIcon /> Подзвонити</a>
          <button className="a-btn a-btn--text" disabled={busy} onClick={cancel}>Скасувати</button>
        </div>
      )}
      {order.status === 'confirmed' && (
        <div className="a-detail__actions">
          <label className="a-field a-field--inline">
            <span className="a-field__label">Номер ТТН</span>
            <input inputMode="numeric" value={ttn} onChange={(e) => setTtn(e.target.value)} placeholder="20 4500 0000 0000" />
          </label>
          <button className="a-btn a-btn--primary a-btn--grow" disabled={busy || !ttn.trim()} onClick={() => run('ship')}>Відправлено</button>
          <button className="a-btn a-btn--text" disabled={busy} onClick={cancel}>Скасувати</button>
        </div>
      )}
      {order.status === 'shipped' && (
        <div className="a-detail__actions">
          <button className="a-btn a-btn--primary a-btn--grow" disabled={busy} onClick={() => run('complete')}>Посилку забрали</button>
        </div>
      )}

      <NoteField order={order} onSaved={setOrder} />
    </article>
  )
}

export function OrdersPage() {
  const { number } = useParams()
  const selected = number ? Number(number) : null
  const navigate = useNavigate()
  const { summary } = useAdmin()
  const [params, setParams] = useSearchParams()
  const raw = params.get('status')
  const tab: OrderStatus = isStatus(raw) ? raw : 'new'
  const search = params.get('q') ?? ''
  const [pages, setPages] = useState(1)
  const [version, setVersion] = useState(0)
  const timer = useRef<number | undefined>(undefined)

  useAssistantContext(`список замовлень · ${ORDER_STATUS[tab].tab.toLowerCase()}`)

  const counts: Record<OrderStatus, number | undefined> = {
    new: summary?.newOrders,
    confirmed: summary?.confirmedOrders,
    shipped: summary?.shippedOrders,
    completed: summary?.completedOrders,
    cancelled: summary?.cancelledOrders,
  }

  // Шукаємо серед усіх замовлень, а не лише у вкладці.
  const { data, error, loading } = useAsync(`orders:${search ? 'all' : tab}:${search}:${pages}:${version}`, async () => {
    const results = await Promise.all(Array.from({ length: pages }, (_, i) => adminApi.orders(search ? null : tab, search, i + 1)))
    return { items: results.flatMap((r) => r.items), hasMore: results.at(-1)!.hasNextPage }
  }, { keepPrevious: true })

  // Десктоп: як у макеті — одразу відкрите перше замовлення, щоб не було порожньої половини.
  const first = data?.items[0]?.number
  useEffect(() => {
    if (!selected && first && window.matchMedia('(min-width: 1100px)').matches)
      navigate(`/admin/orders/${first}?${params}`, { replace: true })
  }, [selected, first, navigate, params])

  const go = (next: { status?: OrderStatus; q?: string }) => {
    const p = new URLSearchParams()
    p.set('status', next.status ?? tab)
    const q = next.q ?? search
    if (q) p.set('q', q)
    setPages(1)
    navigate({ pathname: '/admin/orders', search: `?${p}` }, { replace: true })
  }

  return (
    <div className={`a-page a-orders${selected ? ' has-selection' : ''}`}>
      <div className="a-page__head a-orders__head">
        <h1 className="a-title">Замовлення</h1>
        <label className="a-search">
          <SearchIcon size={18} />
          <span className="visually-hidden">Пошук замовлень</span>
          <input type="search" defaultValue={search} placeholder="Ім’я, телефон, № або ТТН"
            onChange={(e) => {
              const q = e.target.value.trim()
              window.clearTimeout(timer.current)
              timer.current = window.setTimeout(() => go({ q }), 400)
            }} />
        </label>
      </div>

      {!search && (
        <div className="a-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={t === tab} className="a-pill" aria-pressed={t === tab}
              onClick={() => { setParams({ status: t }, { replace: true }); setPages(1) }}>
              {ORDER_STATUS[t].tab}
              {counts[t] !== undefined && <small>{counts[t]}</small>}
            </button>
          ))}
        </div>
      )}

      <div className="a-orders__layout">
        <div className="a-orders__list" aria-busy={loading}>
          <ErrorNote error={error} />
          {data && data.items.length === 0 && (
            <Empty>{search ? 'Нічого не знайшлося.' : tab === 'new' ? 'Нових замовлень немає. Щойно хтось замовить — воно з’явиться тут.' : 'Тут поки порожньо.'}</Empty>
          )}
          {data?.items.map((o) => (
            <Link key={o.id} to={`/admin/orders/${o.number}?${params}`} className={`a-order-card${o.number === selected ? ' is-selected' : ''}`}>
              <span className="a-order-card__top">
                <b>№{o.number} · {firstName(o.customerName)}</b>
                <small>{shortWhen(o.createdAtUtc)}</small>
              </span>
              <span className="a-muted">{itemsCount(o.items.length)} · {o.city} · {payment(o)}</span>
              <span className="a-order-card__top">
                <b className="a-order-card__sum">{formatPrice(o.total)}</b>
                <OrderStatusBadge status={o.status} />
              </span>
            </Link>
          ))}
          {data?.hasMore && (
            <button className="a-btn a-btn--outline" disabled={loading} onClick={() => setPages((p) => p + 1)}>Показати ще</button>
          )}
        </div>

        <div className="a-orders__detail">
          {selected ? (
            <>
              <Link to={`/admin/orders?${params}`} className="a-back"><ArrowLeftIcon size={20} /> До списку</Link>
              <OrderDetails number={selected} onChanged={() => setVersion((v) => v + 1)} />
            </>
          ) : (
            <p className="a-empty-card a-orders__hint">Оберіть замовлення зліва.</p>
          )}
        </div>
      </div>
    </div>
  )
}
