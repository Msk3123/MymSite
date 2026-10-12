import { useState } from 'react'
import { GarmentArt } from '../../components/GarmentArt'
import { GARMENTS } from '../../data/garments'
import { sizeInfo, type Product } from '../../data/catalog'
import { artFor } from '../../lib/placeholderArt'

type PhotoKind = 'view' | 'tag' | 'detail' | 'defect'

interface Photo {
  kind: PhotoKind
  short: string
  label: string
}

export function photosFor(p: Product): Photo[] {
  const photos: Photo[] = [
    { kind: 'view', short: 'Вигляд', label: 'Загальний вигляд' },
    { kind: 'tag', short: 'Бірка', label: 'Бірка з розміром і складом' },
    { kind: 'detail', short: 'Деталі', label: 'Деталі крупно' },
  ]
  if (p.defect) photos.push({ kind: 'defect', short: 'Дефект', label: `Дефект: ${p.defect.toLowerCase()}` })
  return photos
}

const TAG_PATH = 'M30 20 H70 Q74 20 74 24 V106 Q74 110 70 110 H30 Q26 110 26 106 V24 Q26 20 30 20 Z'
const SLEEVE_PATH = 'M14 22 L66 44 L80 110 L34 118 Z'

function darken(hex: string, amount = 0.2) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount))
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`
}

/** Поки немає справжніх фото — малюємо «знімки» з силуету речі. */
function PhotoArt({ product: p, photo }: { product: Product; photo: Photo }) {
  const art = artFor(p)
  const g = GARMENTS[art.garment]
  const accent = darken(art.color, 0.35)

  switch (photo.kind) {
    case 'view':
      if (art.lot)
        return (
          <svg viewBox="0 0 160 125" role="img" aria-label={photo.label}>
            <path d={g.d} fill={art.color} />
            <g transform="translate(62 20) scale(0.8)"><path d={GARMENTS[art.lot.garment].d} fill={art.lot.color} /></g>
          </svg>
        )
      return (
        <svg viewBox="-20 0 140 125" role="img" aria-label={photo.label}>
          <path d={g.d} fill={art.color} />
          <path d={g.s} fill="none" stroke="#fbf7f0" strokeWidth="1.2" strokeDasharray="2.4 2.4" strokeLinecap="round" />
        </svg>
      )
    case 'tag': {
      const size = p.sizeNote ?? `${p.size} cm`
      return (
        <svg viewBox="0 0 280 350" role="img" aria-label={photo.label}>
          <rect x="70" y="60" width="140" height="210" rx="10" fill="#ffffff" stroke="#e6dccd" strokeWidth="2" />
          <circle cx="140" cy="82" r="6" fill="none" stroke="#94867a" strokeWidth="2" />
          <text x="140" y="126" textAnchor="middle" fontFamily="Nunito, sans-serif" fontWeight="900" fontSize="18" fill="#2e2620">
            {p.brand.toUpperCase().slice(0, 14)}
          </text>
          <text x="140" y="170" textAnchor="middle" fontFamily="Nunito, sans-serif" fontWeight="800" fontSize="30" fill="#2e2620">
            {size}
          </text>
          <text x="140" y="196" textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight="600" fontSize="14" fill="#6b5f54">
            {sizeInfo(p.size)?.age.replace(' р', ' Y').replace(' міс', ' M')}
          </text>
          <path d="M90 216 H190" stroke="#e6dccd" strokeWidth="2" />
          <text x="140" y="240" textAnchor="middle" fontFamily="Manrope, sans-serif" fontSize="12" fill="#6b5f54">
            {(p.composition ?? 'склад на бірці').split(',')[0].slice(0, 26)}
          </text>
        </svg>
      )
    }
    case 'detail':
      return (
        <svg viewBox="20 8 60 75" role="img" aria-label={photo.label}>
          <path d={g.d} fill={darken(art.color, 0.08)} />
          <path d={g.s} fill="none" stroke="#fbf7f0" strokeWidth="0.8" strokeDasharray="1.6 1.6" />
          <rect x="48.4" y="30" width="3.2" height="5" rx="1" fill={accent} />
        </svg>
      )
    case 'defect':
      return (
        <svg viewBox="0 0 100 125" role="img" aria-label={photo.label}>
          <path d={SLEEVE_PATH} fill={art.color} />
          <path d="M34 118 L80 110" stroke={accent} strokeWidth="3" />
          <ellipse cx="61" cy="106" rx="8" ry="4.5" fill="#ffffff" opacity="0.35" />
          <circle cx="61" cy="106" r="14" fill="none" stroke="#b5532f" strokeWidth="1" strokeDasharray="2.4 1.8" />
        </svg>
      )
  }
}

function Thumb({ product: p, photo }: { product: Product; photo: Photo }) {
  const art = artFor(p)
  if (photo.kind === 'tag')
    return (
      <svg viewBox="0 0 100 125" aria-hidden="true">
        <path d={TAG_PATH} fill="#ffffff" />
      </svg>
    )
  if (photo.kind === 'defect')
    return (
      <svg viewBox="0 0 100 125" aria-hidden="true">
        <path d={SLEEVE_PATH} fill={art.color} />
      </svg>
    )
  return <GarmentArt kind={art.garment} color={photo.kind === 'detail' ? darken(art.color, 0.08) : art.color} stitch={false} />
}

/** Справжні фото з адмінки: та сама розмітка, що й у намальованої галереї. */
function PhotoGallery({ product: p }: { product: Product }) {
  const photos = p.photos!
  const [current, setCurrent] = useState(0)
  const photo = photos[current]
  const label = (i: number) => photos[i].caption ?? (photos[i].isDefect ? 'Дефект' : i === 0 ? 'Загальний вигляд' : `Фото ${i + 1}`)

  return (
    <section className="gallery" aria-label="Фото речі">
      <div className="gallery__mobile">
        <div className="gallery__main">
          <img src={photo.url} alt={label(current)} className="media-photo" />
          {photo.isDefect && <span className="gallery__note">{photo.caption ?? p.defect ?? 'Дефект'}</span>}
          <span className="gallery__counter">{current + 1} / {photos.length}</span>
        </div>
        {photos.length > 1 && (
          <div className="gallery__thumbs" style={{ gridTemplateColumns: `repeat(${Math.min(photos.length, 5)}, minmax(0, 1fr))` }}>
            {photos.map((ph, i) => (
              <button key={ph.url} type="button" aria-label={`Фото ${i + 1}: ${label(i)}`} aria-pressed={i === current} onClick={() => setCurrent(i)}>
                <img src={ph.url} alt="" loading="lazy" className="media-photo" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="gallery__desktop">
        {photos.map((ph, i) => (
          <div key={ph.url} className={`gallery__tile${i === 0 ? ' gallery__tile--wide' : ''}`}>
            <img src={ph.url} alt={label(i)} loading={i === 0 ? undefined : 'lazy'} className="media-photo" />
            {ph.isDefect && <span className="gallery__note">{ph.caption ?? p.defect ?? 'Дефект'}</span>}
          </div>
        ))}
      </div>
    </section>
  )
}

export function ProductGallery({ product }: { product: Product }) {
  return product.photos?.length ? <PhotoGallery product={product} /> : <DrawnGallery product={product} />
}

function DrawnGallery({ product }: { product: Product }) {
  const photos = photosFor(product)
  const [current, setCurrent] = useState(0)
  const photo = photos[current]
  // На десктопі під широким фото дві колонки — щоб не лишалося дірки, ховаємо «деталі», коли фото парна кількість.
  const desktopPhotos = photos.length % 2 === 0 ? photos.filter((ph) => ph.kind !== 'detail') : photos

  return (
    <section className="gallery" aria-label="Фото речі">
      {/* Мобільна: одне велике фото + мініатюри */}
      <div className="gallery__mobile">
        <div className="gallery__main">
          <PhotoArt product={product} photo={photo} />
          {photo.kind === 'defect' && <span className="gallery__note">{product.defect}</span>}
          <span className="gallery__counter">{current + 1} / {photos.length}</span>
        </div>
        <div className="gallery__thumbs" style={{ gridTemplateColumns: `repeat(${photos.length}, minmax(0, 1fr))` }}>
          {photos.map((ph, i) => (
            <button
              key={ph.kind}
              type="button"
              aria-label={`Фото ${i + 1}: ${ph.label}`}
              aria-pressed={i === current}
              onClick={() => setCurrent(i)}
            >
              <Thumb product={product} photo={ph} />
              {ph.short}
            </button>
          ))}
        </div>
      </div>

      {/* Десктоп: усі фото сіткою */}
      <div className="gallery__desktop">
        {desktopPhotos.map((ph, i) => (
          <div key={ph.kind} className={`gallery__tile${i === 0 ? ' gallery__tile--wide' : ''}`}>
            <PhotoArt product={product} photo={ph} />
            {ph.kind === 'defect' && <span className="gallery__note">{product.defect}</span>}
            <span className="gallery__caption">{i + 1} · {ph.short === 'Вигляд' ? 'Загальний вигляд' : ph.short}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
