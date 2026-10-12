import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCart } from '../../cart/CartContext'
import { ChatIcon, CheckIcon, TruckIcon } from '../../components/Icons'
import { ProductCard } from '../../components/ProductCard'
import { MobileHeader } from '../../components/SiteHeader'
import { productMessage, SHOP } from '../../config'
import { ApiError } from '../../api/http'
import { countProducts, fetchProduct, fetchProducts } from '../../api/products'
import { LoadError } from '../../components/LoadError'
import { CATEGORIES, CONDITIONS, GENDERS, SEASONS, sizeInfo, type Product } from '../../data/catalog'
import { catalogUrl } from '../../lib/filters'
import { discountPercent, formatPrice, itemsCount } from '../../lib/format'
import { usePageMeta } from '../../lib/usePageMeta'
import { useAsync } from '../../lib/useAsync'
import { NotFoundPage } from '../NotFoundPage'
import { ProductGallery } from './ProductGallery'

const CONDITION_SCALE = (['good', 'very-good', 'like-new', 'new'] as const).map((c) => CONDITIONS[c].label)

function ConditionScale({ product: p }: { product: Product }) {
  const c = CONDITIONS[p.condition]
  return (
    <div className="condition">
      <div className="condition__head">
        <h2>Стан</h2>
        <span>{c.label} · {c.rank} з 4</span>
      </div>
      <div className="condition__bar" role="img" aria-label={`Шкала стану: ${c.rank} з 4`}>
        {CONDITION_SCALE.map((label, i) => (
          <span key={label} className={i < c.rank ? 'is-on' : undefined} />
        ))}
      </div>
      <div className="condition__labels only-mobile-grid">
        {CONDITION_SCALE.map((label) => <span key={label}>{label}</span>)}
      </div>
      <p>{p.description}</p>
    </div>
  )
}

function Measurements({ product: p }: { product: Product }) {
  if (!p.measurements) return null
  return (
    <section id="measurements" className="measurements" aria-labelledby="measure-h">
      <h2 id="measure-h">Заміри, см</h2>
      <table className="measure-table measure-table--rows">
        <tbody>
          {p.measurements.map((m) => (
            <tr key={m.label}>
              <th scope="row">{m.label}</th>
              <td>{m.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="measure-table measure-table--cols">
        <thead>
          <tr>{p.measurements.map((m) => <th key={m.label} scope="col">{m.short}</th>)}</tr>
        </thead>
        <tbody>
          <tr>{p.measurements.map((m) => <td key={m.label}>{m.value}</td>)}</tr>
        </tbody>
      </table>
      <span className="measurements__note">Міряю річ на столі, у розкладеному вигляді.</span>
    </section>
  )
}

function Specs({ product: p }: { product: Product }) {
  const rows: [string, string | undefined][] = [
    ['Бренд', p.brand],
    ['Склад', p.composition],
    ['Утеплювач', p.insulation],
    ['Сезон', p.seasonNote ?? SEASONS[p.season]],
    ['Доставка', 'Нова Пошта, 1–2 дні · на карту або накладений платіж'],
  ]
  return (
    <dl className="specs">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="specs__row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function OrderButton({ product: p, className }: { product: Product; className: string }) {
  const { has, add } = useCart()
  const navigate = useNavigate()
  if (p.sold)
    return (
      <button className={`${className} btn--disabled`} disabled>
        {p.status === 'reserved' ? 'Заброньовано' : 'Продано'}
      </button>
    )
  const inCart = has(p.id)
  return (
    <button
      className={className}
      onClick={() => {
        add(p.id)
        navigate('/checkout')
      }}
    >
      {inCart ? 'Вже в кошику — оформити' : 'Замовити'}
    </button>
  )
}

/** «Ще цього розміру»: спершу той самий зріст, а якщо такого мало — доповнюємо новинками. */
async function loadMore(p: Product) {
  const [sameSize, total] = await Promise.all([
    fetchProducts({ filters: { size: p.size }, includeSold: false, pageSize: 6 }),
    countProducts({ filters: { size: p.size } }),
  ])
  let items = sameSize.items.filter((x) => x.id !== p.id)
  if (items.length < 3) {
    const latest = await fetchProducts({ includeSold: false, pageSize: 8 })
    items = [...items, ...latest.items.filter((x) => x.id !== p.id && x.size !== p.size)]
  }
  return { items: items.slice(0, 5), total }
}

export function ProductPage() {
  const { id = '' } = useParams()
  const { data: p, error } = useAsync(`product:${id}`, () => fetchProduct(id))

  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />
  if (error) return <LoadError />
  if (!p) return <main id="main" className="container product" aria-busy="true" />
  return <ProductView product={p} />
}

function ProductView({ product: p }: { product: Product }) {
  const { data: more } = useAsync(`more:${p.id}`, () => loadMore(p))

  const size = sizeInfo(p.size)
  const off = discountPercent(p.price, p.oldPrice)
  const message = productMessage(p.name, p.brand, p.sku)
  const telegramWithText = `${SHOP.telegramUrl}?text=${encodeURIComponent(message)}`
  const sizeLabel = p.sizeNote ?? `${p.size} см`
  const back = catalogUrl({ gender: p.gender === 'unisex' ? undefined : p.gender, size: p.size })

  // Заголовок, опис і розмітка товару: так у Google може з'явитись ціна й «в наявності».
  usePageMeta({
    title: `${p.title}${p.brand ? ` ${p.brand}` : ''}, ${sizeLabel} — ${formatPrice(p.price)}`,
    description: `${CONDITIONS[p.condition].label}. ${p.description ?? ''} ${GENDERS[p.gender].title}, ${sizeLabel}${size ? ` (${size.ageLong})` : ''}. Доставка Новою Поштою.`
      .replace(/\s+/g, ' ').trim().slice(0, 300),
    image: p.coverUrl,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.title,
      sku: p.sku,
      description: p.description,
      image: (p.photos?.length ? p.photos.map((ph) => ph.url) : p.coverUrl ? [p.coverUrl] : []).map((u) => new URL(u, location.origin).href),
      ...(p.brand && p.brand !== 'Різні бренди' ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
      offers: {
        '@type': 'Offer',
        url: location.href,
        priceCurrency: 'UAH',
        price: p.price,
        availability: p.sold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        itemCondition: p.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
      },
    },
  })

  return (
    <>
      <MobileHeader backTo={back} backLabel="Назад до каталогу" cart>
        <span className="mobile-header__crumbs">
          {GENDERS[p.gender].label} · {p.size} см · {CATEGORIES[p.category]}
        </span>
      </MobileHeader>

      <main id="main" className="container product">
        <nav aria-label="Навігація" className="breadcrumbs only-desktop">
          <Link to="/catalog">Каталог</Link>
          <span aria-hidden="true">/</span>
          <Link to={back}>{GENDERS[p.gender].label}, {p.size} см</Link>
          <span aria-hidden="true">/</span>
          <span>{CATEGORIES[p.category]}</span>
        </nav>

        <div className="product__layout">
          <ProductGallery product={p} />

          <section className="product__info" aria-labelledby="product-h">
            <div className="product__title">
              <span className="product__sku">{p.brand} · арт. {p.sku}</span>
              <h1 id="product-h">{p.title}</h1>
              <div className="product__price">
                <span className="price">{formatPrice(p.price)}</span>
                {p.oldPrice && <s>{formatPrice(p.oldPrice)}</s>}
                {off > 0 && <span className="pill-accent">−{off}%</span>}
              </div>
            </div>

            <div className="fact-row">
              <div className="fact">
                <div className="fact__label">Розмір</div>
                <div className="fact__value">
                  {sizeLabel}
                  {size && <span className="fact__inline"> · {size.ageLong}</span>}
                </div>
                {size && <div className="fact__sub">{size.ageLong}</div>}
                {p.fitNote && p.measurements && (
                  <a href="#measurements" className="fact__link">{p.fitNote}</a>
                )}
              </div>
              <div className="fact fact--season">
                <div className="fact__label">Сезон</div>
                <div className="fact__value">{SEASONS[p.season]}</div>
                {p.seasonNote && <div className="fact__sub">{p.seasonNote.split(' · ')[1] ?? p.seasonNote}</div>}
              </div>
            </div>

            {p.lotContents && <p className="product__lot">У комплекті: {p.lotContents}</p>}

            <ConditionScale product={p} />

            <div className="product__actions only-desktop-flex">
              <OrderButton product={p} className="btn btn--primary btn--lg btn--block" />
              <div className="btn-pair">
                <a href={SHOP.viberUrl} className="btn btn--outline">Написати у Viber</a>
                <a href={telegramWithText} target="_blank" rel="noreferrer" className="btn btn--outline">У Telegram</a>
              </div>
              <span className="product__hint">Текст підставиться сам: «{message}»</span>
            </div>

            <Measurements product={p} />
            <Specs product={p} />

            <section className="ask only-mobile-flex" aria-labelledby="ask-h">
              <h2 id="ask-h">Є питання? Напишіть мені</h2>
              <div className="ask__preview">
                Повідомлення вже готове: <strong>«{message}»</strong>
              </div>
              <div className="btn-pair">
                <a href={SHOP.viberUrl} className="btn btn--outline">Viber</a>
                <a href={telegramWithText} target="_blank" rel="noreferrer" className="btn btn--outline">Telegram</a>
              </div>
            </section>

            <ul className="perks only-mobile-flex">
              <li><TruckIcon />Нова Пошта, відправка за 1–2 дні</li>
              <li><CheckIcon />
                <span>Не підійшов розмір — <Link to="/#how-to-order">обміняю</Link></span>
              </li>
            </ul>
          </section>
        </div>

        {more && more.items.length > 0 && (
          <section className="section section--bleed product__more" aria-labelledby="more-h">
            <div className="section__head section__head--row">
              <h2 id="more-h" className="section__title">
                Ще цього розміру<span className="only-desktop"> — {p.size} см</span>
              </h2>
              <Link to={catalogUrl({ size: p.size })} className="text-link only-desktop">
                Усі {itemsCount(more.total)}
              </Link>
            </div>
            <div className="card-rail">
              {more.items.map((x) => (
                <ProductCard key={x.id} product={x} />
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="buy-bar">
        <a href={telegramWithText} target="_blank" rel="noreferrer" className="buy-bar__chat" aria-label="Написати у месенджер">
          <ChatIcon size={24} />
        </a>
        <div className="buy-bar__price">
          <span className="price">{formatPrice(p.price)}</span>
          <span>{sizeLabel}</span>
        </div>
        <OrderButton product={p} className="btn btn--primary buy-bar__order" />
      </div>
    </>
  )
}
