import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { CameraIcon } from '../../components/Icons'
import { formatNumber, formatPrice, itemsCount, plural } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { adminApi, type Order, type Summary } from '../api'
import { ErrorNote, greeting, todayLabel, useAdmin, useAssistantContext, useDataChanged } from '../ui'

const TAGS = {
  order: { bg: '#f6e1d6', fg: '#9a4122' },
  ship: { bg: '#f5ead8', fg: '#7a5a2e' },
  draft: { bg: '#e4ebdf', fg: '#4e6b4a' },
}

interface Todo {
  key: string
  tag: string
  tone: keyof typeof TAGS
  title: string
  sub: string
  action: string
  to: string
}

const payment = (o: Order) => (o.payment === 'card' ? 'на карту' : 'накладений')

function todosFrom(fresh: Order[], toShip: Order[], drafts: number): Todo[] {
  const todos: Todo[] = [
    ...fresh.map((o) => ({
      key: `n${o.number}`, tag: 'Нове', tone: 'order' as const,
      title: `Підтвердити замовлення №${o.number}`,
      sub: `${o.customerName}, ${o.city} · ${itemsCount(o.items.length)} · ${formatPrice(o.total)} · ${payment(o)}`,
      action: 'Відкрити', to: `/admin/orders/${o.number}`,
    })),
    ...toShip.map((o) => ({
      key: `s${o.number}`, tag: 'Відправити', tone: 'ship' as const,
      title: `Внести ТТН для №${o.number}`,
      sub: `Підтверджене · ${o.customerName}, ${o.city}`,
      action: 'Внести ТТН', to: `/admin/orders/${o.number}`,
    })),
  ]
  if (drafts > 0)
    todos.push({
      key: 'drafts', tag: 'Чернетки', tone: 'draft',
      title: `${itemsCount(drafts)} ще не на сайті`,
      sub: 'Додайте фото й натисніть «Опублікувати на сайті»',
      action: 'Подивитися', to: '/admin/products?status=draft',
    })
  return todos
}

const weekLabel = (iso: string) =>
  new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short' }).format(new Date(iso)).replace('.', '')

function StaleRow({ item, onDone }: { item: Summary['staleItems'][number]; onDone: () => void }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const discount = async () => {
    setState('busy')
    try {
      await adminApi.bulk([item.id], 'discount10')
      setState('done')
      onDone()
    } catch {
      setState('idle')
    }
  }
  return (
    <div className="a-stale">
      <Link to={`/admin/products/${item.id}`} className="a-stale__thumb">
        {item.coverUrl ? <img src={item.coverUrl} alt="" /> : <CameraIcon size={18} />}
      </Link>
      <Link to={`/admin/products/${item.id}`} className="a-stale__body">
        <b>{item.name}{item.brand && `, ${item.brand}`}</b>
        <small>{item.sizeNote ?? `${item.sizeCm} см`} · {formatPrice(item.price)} · {item.daysOnSite} {plural(item.daysOnSite, ['день', 'дні', 'днів'])}</small>
      </Link>
      <button type="button" className="a-chip-btn" disabled={state !== 'idle'} onClick={discount}>
        {state === 'done' ? 'Готово' : '−10%'}
      </button>
    </div>
  )
}

export function TodayPage() {
  const { me, summary: s, refreshSummary, logout } = useAdmin()
  useAssistantContext('головна, план на сьогодні')

  const [version, setVersion] = useState(0)
  // Помічник змінив дані (режим дій) — перечитуємо.
  useDataChanged(useCallback(() => setVersion((v) => v + 1), []))
  const { data: lists, error } = useAsync(`today-orders:${version}`, async () => {
    const [fresh, toShip] = await Promise.all([adminApi.orders('new', '', 1), adminApi.orders('confirmed', '', 1)])
    return { fresh: fresh.items.slice(0, 5), toShip: toShip.items.slice(0, 5) }
  })

  const todos = s && lists ? todosFrom(lists.fresh, lists.toShip, s.drafts) : null
  const maxWeek = Math.max(1, ...(s?.weeklySales.map((w) => w.total) ?? [1]))
  const month = new Intl.DateTimeFormat('uk-UA', { month: 'long' }).format(new Date())

  return (
    <div className="a-page a-today">
      <div className="a-hello">
        <span>{todayLabel()}</span>
        <h1>{greeting(me.greetingName)}</h1>
      </div>
      <ErrorNote error={error} />

      {s && (
        <section className="a-cards" aria-label="Коротко">
          <Link to="/admin/orders?status=new" className="a-card-stat a-card-stat--accent">
            <b>{s.newOrders}</b>
            <span>{plural(s.newOrders, ['нове замовлення', 'нові замовлення', 'нових замовлень'])}</span>
            <small>{s.newOrders ? 'треба підтвердити' : 'усе підтверджено'}</small>
          </Link>
          <Link to="/admin/orders?status=confirmed" className="a-card-stat">
            <b>{s.confirmedOrders}</b>
            <span>відправити</span>
            <small>підтверджені, без ТТН</small>
          </Link>
          <Link to="/admin/products?status=available" className="a-card-stat">
            <b>{s.itemsOnSale}</b>
            <span>{plural(s.itemsOnSale, ['річ на сайті', 'речі на сайті', 'речей на сайті'])}</span>
            <small>на суму {formatPrice(s.valueOnSale)}</small>
          </Link>
          <div className="a-card-stat a-card-stat--green">
            <b className="a-card-stat__money">{formatPrice(s.revenueThisMonth)}</b>
            <span>за {month}</span>
            <small>{itemsCount(s.itemsSoldThisMonth)} продано · залишилось {s.itemsOnSale}</small>
          </div>
        </section>
      )}

      <div className="a-today__cols">
        <section className="a-today__main" aria-labelledby="todo-h">
          <h2 id="todo-h" className="a-h2">Що зробити зараз</h2>
          {todos?.length === 0 && <p className="a-empty-card">Усе зроблено. Можна сфотографувати нові речі.</p>}
          {todos?.map((t) => (
            <div key={t.key} className="a-todo">
              <span className="a-tag a-tag--caps" style={{ background: TAGS[t.tone].bg, color: TAGS[t.tone].fg }}>{t.tag}</span>
              <div className="a-todo__text">
                <b>{t.title}</b>
                <span>{t.sub}</span>
              </div>
              <Link to={t.to} className="a-btn a-btn--outline">{t.action}</Link>
            </div>
          ))}

          {s && (
            <>
              <h2 className="a-h2 a-h2--gap">Продажі по тижнях</h2>
              <div className="a-chart" role="img"
                aria-label={`Продажі за останні ${s.weeklySales.length} тижнів: ${s.weeklySales.map((w) => formatPrice(w.total)).join(', ')}`}>
                {s.weeklySales.map((w, i) => (
                  <div key={w.weekStart} className="a-chart__col">
                    <span className="a-chart__value">{formatNumber(w.total)}</span>
                    <span className={`a-chart__bar${i === s.weeklySales.length - 1 ? ' is-current' : ''}`}
                      style={{ height: `${Math.max(4, Math.round((w.total / maxWeek) * 120))}px` }} />
                    <span className="a-chart__label">{weekLabel(w.weekStart)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="a-today__side">
          {s && s.staleItems.length > 0 && (
            <section className="a-panel" aria-labelledby="old-h">
              <div>
                <h2 id="old-h" className="a-h3">Довго не продаються</h2>
                <small className="a-muted">Понад 30 днів на сайті. Знижка −10% часто допомагає.</small>
              </div>
              {s.staleItems.map((item) => <StaleRow key={item.id} item={item} onDone={refreshSummary} />)}
            </section>
          )}
          <button type="button" className="a-link-btn" onClick={logout}>Вийти з кабінету</button>
        </aside>
      </div>
    </div>
  )
}
