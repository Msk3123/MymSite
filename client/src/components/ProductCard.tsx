import { Link } from 'react-router-dom'
import { CONDITIONS, RESERVED_BADGE, SOLD_BADGE, type Product } from '../data/catalog'
import { discountPercent, formatNumber, formatPrice } from '../lib/format'
import { artFor } from '../lib/placeholderArt'
import { GarmentArt } from './GarmentArt'

export const productMeta = (p: Product) => `${p.brand} · ${p.sizeNote ?? `${p.size} см`}`

export function ConditionBadge({ product, className = 'badge' }: { product: Product; className?: string }) {
  const c = product.status === 'sold' ? SOLD_BADGE : product.status === 'reserved' ? RESERVED_BADGE : CONDITIONS[product.condition]
  return (
    <span className={className} style={{ background: c.bg, color: c.fg }}>
      {c.label}
    </span>
  )
}

interface ProductCardProps {
  product: Product
  /** Показувати плашку «−45%» у правому верхньому куті */
  showDiscount?: boolean
}

export function ProductCard({ product: p, showDiscount = false }: ProductCardProps) {
  const off = discountPercent(p.price, p.oldPrice)
  const art = artFor(p)
  return (
    <Link to={`/product/${p.id}`} className={`product-card${p.sold ? ' is-sold' : ''}`}>
      <div className="product-card__media">
        {p.coverUrl ? (
          <img src={p.coverUrl} alt="" loading="lazy" className="media-photo" />
        ) : (
          <GarmentArt kind={art.garment} color={p.sold ? '#cfc6bb' : art.color} />
        )}
        <ConditionBadge product={p} className="badge product-card__badge" />
        {showDiscount && off >= 30 && !p.sold && <span className="product-card__off">−{off}%</span>}
      </div>
      <div className="product-card__price">
        <span className="price">{formatPrice(p.price)}</span>
        {p.oldPrice && <s>{formatNumber(p.oldPrice)}</s>}
      </div>
      <div className="product-card__name">{p.name}</div>
      <div className="product-card__meta">{productMeta(p)}</div>
    </Link>
  )
}

export function LotCard({ product: p }: { product: Product }) {
  const art = artFor(p)
  if (!art.lot) return null
  const off = discountPercent(p.price, p.oldPrice)
  return (
    <Link to={`/product/${p.id}`} className="lot-card">
      <div className="lot-card__media" style={{ background: art.lot.bg }}>
        {p.coverUrl ? (
          <img src={p.coverUrl} alt="" loading="lazy" className="media-photo" />
        ) : (
          <>
            <GarmentArt kind={art.garment} color={art.color} stitch={false} className="lot-card__main" />
            <GarmentArt kind={art.lot.garment} color={art.lot.color} stitch={false} className="lot-card__second" />
          </>
        )}
      </div>
      <div className="lot-card__body">
        {off > 0 && <span className="pill-accent">−{off}%</span>}
        <span className="lot-card__name">{p.name}</span>
        <span className="lot-card__desc">{p.lotContents}</span>
        <span className="lot-card__price">
          <span className="price">{formatPrice(p.price)}</span>
          {p.oldPrice && <s>{formatPrice(p.oldPrice)}</s>}
        </span>
      </div>
    </Link>
  )
}
