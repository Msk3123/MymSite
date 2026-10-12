import { useRef, useState } from 'react'
import { CameraIcon, PlusIcon } from '../../components/Icons'
import { adminApi, type AdminProduct, type Photo } from '../api'
import { resizeImage } from '../resizeImage'
import { ErrorNote } from '../ui'

export const SLOTS = [
  { key: 'view', label: 'Вигляд', hint: 'Річ цілком, по центру' },
  { key: 'tag', label: 'Бірка', hint: 'Розмір і склад крупно' },
  { key: 'detail', label: 'Деталі', hint: 'Шви, фурнітура, підкладка' },
  { key: 'defect', label: 'Дефект', hint: 'Якщо є — крупним планом' },
] as const

export type SlotKey = (typeof SLOTS)[number]['key']

/** Фото, вибране для нової речі, яку ще не збережено: завантажимо після «Чернетка»/«Опублікувати». */
export interface PendingPhoto {
  blob: Blob
  url: string
}

export type Pending = Partial<Record<SlotKey, PendingPhoto>> & { extra?: PendingPhoto[] }

const MAX_PHOTOS = 12

interface Props {
  /** Збережена річ — фото вантажаться одразу. Немає — фото чекають у pending. */
  product: AdminProduct | null
  onProduct: (p: AdminProduct) => void
  pending: Pending
  onPending: (p: Pending) => void
}

/** Яке фото в якому слоті: збережені фото знаходимо за підписом («Бірка»). */
export function slotPhoto(product: AdminProduct | null, label: string): Photo | undefined {
  return product?.photos.find((ph) => ph.caption === label)
}

function FilePicker({ onFiles, multiple, children, className, label }: {
  onFiles: (files: File[]) => void
  multiple?: boolean
  children: React.ReactNode
  className: string
  label: string
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={input} type="file" accept="image/*" multiple={multiple} hidden
        onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
      <button type="button" className={className} aria-label={label} onClick={() => input.current?.click()}>{children}</button>
    </>
  )
}

export function PhotoSlots({ product, onProduct, pending, onPending }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  const savedCount = product?.photos.length ?? 0
  const pendingCount = SLOTS.filter((s) => pending[s.key]).length + (pending.extra?.length ?? 0)
  const total = savedCount + pendingCount
  const filledSlots = SLOTS.filter((s) => pending[s.key] || slotPhoto(product, s.label)).length
  const extras = product ? product.photos.filter((ph) => !SLOTS.some((s) => s.label === ph.caption)) : []

  const withBusy = async (key: string, work: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    try {
      await work()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  const putInSlot = (slot: (typeof SLOTS)[number], file: File) =>
    withBusy(slot.key, async () => {
      const blob = await resizeImage(file)
      if (!product) {
        onPending({ ...pending, [slot.key]: { blob, url: URL.createObjectURL(blob) } })
        return
      }
      const old = slotPhoto(product, slot.label)
      let updated = await adminApi.uploadPhoto(product.id, blob, { caption: slot.label, isDefect: slot.key === 'defect' })
      if (old) updated = await adminApi.deletePhoto(product.id, old.id)
      // «Вигляд» — завжди головне фото в каталозі.
      if (slot.key === 'view') {
        const view = slotPhoto(updated, slot.label)
        if (view && updated.photos[0]?.id !== view.id) updated = await adminApi.makeCover(product.id, view.id)
      }
      onProduct(updated)
    })

  const addExtra = (files: File[]) =>
    withBusy('extra', async () => {
      const list = files.slice(0, MAX_PHOTOS - total)
      if (!product) {
        const blobs = await Promise.all(list.map((f) => resizeImage(f)))
        onPending({ ...pending, extra: [...(pending.extra ?? []), ...blobs.map((blob) => ({ blob, url: URL.createObjectURL(blob) }))] })
        return
      }
      let updated = product
      for (const file of list) updated = await adminApi.uploadPhoto(product.id, await resizeImage(file))
      onProduct(updated)
    })

  const removeSaved = (photo: Photo) =>
    window.confirm('Видалити це фото?') && withBusy(photo.id, async () => onProduct(await adminApi.deletePhoto(product!.id, photo.id)))

  return (
    <section className="a-photos" aria-labelledby="photos-h">
      <div className="a-photos__head">
        <h2 id="photos-h" className="a-h3">Фото</h2>
        <span className="a-muted">{filledSlots} з {SLOTS.length}{total > filledSlots && ` · усього ${total}`}</span>
      </div>

      <div className="a-slots">
        {SLOTS.map((slot, i) => {
          const saved = slotPhoto(product, slot.label)
          const url = pending[slot.key]?.url ?? saved?.url
          return url ? (
            <div key={slot.key} className="a-slot a-slot--filled" aria-busy={busy === slot.key || busy === saved?.id}>
              <img src={url} alt={slot.label} />
              <span className="a-slot__tag">{i + 1} · {slot.label}</span>
              <FilePicker className="a-slot__replace" label={`Замінити фото «${slot.label}»`} onFiles={([f]) => f && putInSlot(slot, f)}>
                <CameraIcon size={20} />
              </FilePicker>
              <button type="button" className="a-slot__remove" aria-label={`Прибрати фото «${slot.label}»`}
                onClick={() => (saved ? removeSaved(saved) : onPending({ ...pending, [slot.key]: undefined }))}>×</button>
            </div>
          ) : (
            <FilePicker key={slot.key} className="a-slot" label={`Додати фото: ${slot.label}`} onFiles={([f]) => f && putInSlot(slot, f)}>
              <CameraIcon size={26} />
              <b>{i + 1} · {slot.label}</b>
              <small>{busy === slot.key ? 'Завантажую…' : slot.hint}</small>
            </FilePicker>
          )
        })}

        {extras.map((ph) => (
          <div key={ph.id} className="a-slot a-slot--filled" aria-busy={busy === ph.id}>
            <img src={ph.url} alt="Додаткове фото" />
            <button type="button" className="a-slot__remove" aria-label="Видалити фото" onClick={() => removeSaved(ph)}>×</button>
          </div>
        ))}
        {pending.extra?.map((ph, i) => (
          <div key={ph.url} className="a-slot a-slot--filled">
            <img src={ph.url} alt="Додаткове фото" />
            <button type="button" className="a-slot__remove" aria-label="Прибрати фото"
              onClick={() => onPending({ ...pending, extra: pending.extra!.filter((_, j) => j !== i) })}>×</button>
          </div>
        ))}
        {total < MAX_PHOTOS && (
          <FilePicker className="a-slot a-slot--more" label="Додати ще фото" multiple onFiles={addExtra}>
            <PlusIcon size={24} />
            <b>{busy === 'extra' ? 'Завантажую…' : 'Ще фото'}</b>
          </FilePicker>
        )}
      </div>

      <p className="a-tip">Світлий фон, денне світло біля вікна, без спалаху. Річ по центру — сайт сам обріже кадр 4:5.</p>
      <ErrorNote error={error} />
    </section>
  )
}
