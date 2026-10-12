import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightIcon, CameraIcon, CheckIcon, MicIcon } from '../../components/Icons'
import { CATEGORIES, CONDITIONS, sizeInfo } from '../../data/catalog'
import { formatPrice } from '../../lib/format'
import type { AdminProductListItem, AssistantActionKind } from '../api'
import { ProductStatusDot } from '../ui'
import { ConfirmDialog } from '../ConfirmDialog'
import { useActionMode, type ActionCard, type Bubble, type DraftItem } from './useAssistantChat'
import { useDictation } from './useDictation'

// Незворотні дії — червона кнопка, щоб «Так» не тиснули машинально.
const DANGER: AssistantActionKind[] = ['delete-product', 'cancel-order']

function ActionCardView({ card, onDecide }: { card: ActionCard; onDecide: (confirm: boolean) => void }) {
  const danger = DANGER.includes(card.action.kind)
  return (
    <div className={`ai-action ai-action--${card.state}${danger ? ' ai-action--danger' : ''}`}>
      <span className="ai-action__text">{card.action.summary}</span>
      {card.state === 'pending' && (
        <div className="ai-action__buttons">
          <button type="button" className={`a-btn ${danger ? 'a-btn--danger' : 'a-btn--dark'}`} onClick={() => onDecide(true)}>
            {danger ? 'Так, видалити' : 'Так, зробити'}
          </button>
          <button type="button" className="a-btn a-btn--outline" onClick={() => onDecide(false)}>Ні</button>
        </div>
      )}
      {card.state === 'busy' && <span className="ai-action__note">Виконую…</span>}
      {card.state === 'done' && <span className="ai-action__note ai-action__note--ok"><CheckIcon size={16} /> Зроблено</span>}
      {card.state === 'declined' && <span className="ai-action__note">Скасовано — нічого не змінено</span>}
      {card.state === 'error' && <span className="ai-action__note ai-action__note--error">{card.note}</span>}
    </div>
  )
}

/** Речі прямо в чаті: фото, назва, розмір, ціна, статус — натиснула й потрапила в річ. */
function ProductStrip({ products }: { products: AdminProductListItem[] }) {
  return (
    <div className="ai-products">
      {products.map((p) => (
        <Link key={p.id} to={`/admin/products/${p.id}`} className="ai-product">
          <span className="ai-product__thumb">
            {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" /> : <CameraIcon size={18} aria-label="Без фото" />}
          </span>
          <span className="ai-product__body">
            <b>{p.name}</b>
            <small>{p.sizeNote ?? `${p.sizeCm} см`} · {p.sku}{p.storageLocation && ` · ${p.storageLocation}`}</small>
            <span className="ai-product__meta">
              <b>{formatPrice(p.price)}</b>
              {p.oldPrice && <s>{formatPrice(p.oldPrice)}</s>}
              <ProductStatusDot status={p.status} />
            </span>
          </span>
        </Link>
      ))}
    </div>
  )
}

type DraftChoice = { name: string; price: number; sizeCm: number; publish: boolean } | null

/** Картка нової речі з фото: перевірити, поставити ціну — і на сайт. */
function DraftCardView({ draft: d, onDecide }: { draft: DraftItem; onDecide: (choice: DraftChoice) => void }) {
  const [name, setName] = useState(d.name)
  const [price, setPrice] = useState(d.price ? String(d.price) : '')
  const [size, setSize] = useState(d.sizeCm ? String(d.sizeCm) : '')
  const priceNum = Number(price.replace(/\s/g, ''))
  const sizeNum = Number(size)
  const ready = name.trim().length > 0 && priceNum > 0 && sizeNum >= 44 && sizeNum <= 176
  const check = (field: string) => (d.uncertain.includes(field) ? ' ai-draft__check' : '')

  if (d.state === 'done')
    return (
      <div className="ai-draft ai-draft--done">
        <span className="ai-action__note ai-action__note--ok"><CheckIcon size={16} />
          {d.published ? 'Річ уже на сайті' : 'Збережено чернеткою'} · {d.note}
        </span>
        <b>{d.name} · {formatPrice(d.price ?? 0)}</b>
        {d.productId && <Link to={`/admin/products/${d.productId}`} className="a-link-btn">Відкрити річ →</Link>}
      </div>
    )
  if (d.state === 'declined') return <div className="ai-draft ai-draft--off"><span className="ai-action__note">Скасовано — річ не створена</span></div>
  if (d.state === 'expired') return <div className="ai-draft ai-draft--off"><span className="ai-action__note">{d.note}</span></div>

  const busy = d.state === 'busy'
  return (
    <div className="ai-draft">
      <div className="ai-draft__photos">
        {d.thumbs.map((t, i) => <img key={i} src={t} alt={`Фото ${i + 1}`} />)}
      </div>
      <label className={`ai-draft__field${check('name')}`}>
        <span>Назва</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Що це за річ" />
      </label>
      <p className="ai-draft__meta">
        {[d.brand, CATEGORIES[d.category], CONDITIONS[d.condition].label, d.composition].filter(Boolean).join(' · ')}
      </p>
      {d.description && <p className="ai-draft__desc">{d.description}</p>}
      {d.storageLocation && <p className="ai-draft__meta">Де лежить: {d.storageLocation}</p>}
      <div className="ai-draft__row">
        <label className={`ai-draft__field${check('sizeCm')}`}>
          <span>Зріст, см</span>
          <input inputMode="numeric" value={size} onChange={(e) => setSize(e.target.value.replace(/\D/g, ''))} placeholder="98" />
          <small>{sizeInfo(sizeNum)?.age ?? d.sizeNote ?? ''}</small>
        </label>
        <label className="ai-draft__field">
          <span>Ціна, грн</span>
          <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder="200" />
          <small>
            {Number(price) !== d.price ? '' : d.priceFrom === 'hint' ? 'як у схожих речей' : d.priceFrom === 'memory' ? 'за вашим правилом' : ''}
          </small>
        </label>
      </div>
      {d.note && <span className="ai-action__note ai-action__note--error">{d.note}</span>}
      <div className="ai-action__buttons">
        <button type="button" className="a-btn a-btn--primary" disabled={!ready || busy}
          onClick={() => onDecide({ name, price: priceNum, sizeCm: sizeNum, publish: true })}>
          {busy ? 'Створюю…' : 'Виставити на сайт'}
        </button>
        <button type="button" className="a-btn a-btn--outline" disabled={!ready || busy}
          onClick={() => onDecide({ name, price: priceNum, sizeCm: sizeNum, publish: false })}>Чернетка</button>
        <button type="button" className="a-btn a-btn--text" disabled={busy} onClick={() => onDecide(null)}>Ні</button>
      </div>
    </div>
  )
}

interface AssistantLogProps {
  messages: Bubble[]
  busy: boolean
  /** Що показати, поки розмова порожня */
  intro?: ReactNode
  onDecide?: (bubble: number, card: number, confirm: boolean) => void
  onDraft?: (bubble: number, choice: DraftChoice) => void
}

export function AssistantLog({ messages, busy, intro, onDecide, onDraft }: AssistantLogProps) {
  const end = useRef<HTMLDivElement>(null)
  // Фігурні дужки важливі: у нових Chrome scrollIntoView повертає Promise, а React сприйняв би його як cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, busy])

  return (
    <div className="ai-log" aria-live="polite">
      {messages.length === 0 && intro}
      {messages.map((m, i) => (
        <div key={i} className="ai-turn">
          <div className={`ai-bubble ai-bubble--${m.role}${m.error ? ' ai-bubble--error' : ''}`}>
            {m.photos && m.photos.length > 0 && (
              <span className="ai-bubble__photos">{m.photos.map((t, k) => <img key={k} src={t} alt="" />)}</span>
            )}
            {m.text}
          </div>
          {m.remembered && m.remembered.length > 0 && (
            <div className="ai-remembered">
              {m.remembered.map((r, k) => <span key={k}>Запам’ятала: {r}</span>)}
            </div>
          )}
          {m.draft && <DraftCardView draft={m.draft} onDecide={(choice) => onDraft?.(i, choice)} />}
          {m.products && m.products.length > 0 && <ProductStrip products={m.products} />}
          {m.actions?.map((card, j) => (
            <ActionCardView key={j} card={card} onDecide={(confirm) => onDecide?.(i, j, confirm)} />
          ))}
        </div>
      ))}
      {busy && <div className="ai-bubble ai-bubble--assistant ai-bubble--typing">Думаю…</div>}
      <div ref={end} className="ai-log__end" />
    </div>
  )
}

/**
 * Перемикач «Поради / Дії». У «Діях» помічник може готувати зміни (кожна — лише після «Так» на картці).
 * Вмикається свідомо: спершу попередження, що це розширений режим.
 */
export function ActionModeSwitch({ compact }: { compact?: boolean }) {
  const [on, setOn] = useActionMode()
  const [asking, setAsking] = useState(false)

  return (
    <>
      <div className={`ai-mode${compact ? ' ai-mode--compact' : ''}`} role="group" aria-label="Режим помічника">
        <button type="button" aria-pressed={!on} onClick={() => setOn(false)}>Поради</button>
        <button type="button" aria-pressed={on} onClick={() => !on && setAsking(true)}>Дії</button>
      </div>
      {asking && (
        <ConfirmDialog
          title="Увімкнути режим дій?"
          confirmLabel="Увімкнути"
          cancelLabel="Лишити поради"
          onConfirm={() => {
            setOn(true)
            setAsking(false)
          }}
          onCancel={() => setAsking(false)}
        >
          <p>Це <b>розширений режим</b>. Помічник зможе на ваше прохання змінювати ціни, назви й описи, публікувати,
            ховати й <b>видаляти речі</b>, підтверджувати, відправляти й скасовувати замовлення.</p>
          <p>Перед кожною зміною він покаже картку з тим, що збирається зробити, і нічого не змінить без вашого «Так».
            Читайте картку уважно — помічник може помилитися.</p>
          <p>Повернутися до звичайних порад — кнопка «Поради».</p>
        </ConfirmDialog>
      )}
    </>
  )
}

interface AssistantInputProps {
  hints: string[]
  busy: boolean
  onAsk: (text: string) => void
  /** Є — показуємо кнопку з камерою: фото речі прямо в чат, помічник підготує картку «Виставити на сайт» */
  onPhotos?: (text: string, files: File[]) => void
  placeholder?: string
  large?: boolean
  /** Над підказками, у закріпленій нижній панелі — тут живе перемикач «Поради / Дії» */
  toolbar?: ReactNode
}

export function AssistantInput({ hints, busy, onAsk, onPhotos, placeholder = 'Спитайте помічника…', large, toolbar }: AssistantInputProps) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const picker = useRef<HTMLInputElement>(null)
  const dictation = useDictation(setText)
  const previews = useRef(new Map<File, string>())
  const preview = (f: File) => {
    if (!previews.current.has(f)) previews.current.set(f, URL.createObjectURL(f))
    return previews.current.get(f)!
  }

  const send = (value: string) => {
    if (busy) return
    if (files.length > 0 && onPhotos) {
      onPhotos(value, files)
      setFiles([])
      setText('')
      return
    }
    if (!value.trim()) return
    onAsk(value)
    setText('')
  }

  return (
    <div className={`ai-input${large ? ' ai-input--large' : ''}`}>
      {toolbar && <div className="ai-input__toolbar">{toolbar}</div>}
      {hints.length > 0 && (
        <div className="ai-input__hints" aria-label="Підказки">
          {hints.map((h) => (
            <button key={h} type="button" disabled={busy} onClick={() => send(h)}>{h}</button>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="ai-input__files" aria-label="Прикріплені фото">
          {files.map((f, i) => (
            <span key={i} className="ai-input__file">
              <img src={preview(f)} alt={`Фото ${i + 1}`} />
              <button type="button" aria-label="Прибрати фото" onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button>
            </span>
          ))}
          <span className="ai-input__files-hint">Натисніть ➜ — я розпізнаю річ. Можна дописати ціну: «за 200».</span>
        </div>
      )}
      <form className="ai-input__row" onSubmit={(e) => { e.preventDefault(); send(text) }}>
        {onPhotos && (
          <>
            <input ref={picker} type="file" accept="image/*" multiple hidden
              onChange={(e) => { setFiles([...files, ...(e.target.files ?? [])].slice(0, 4)); e.target.value = '' }} />
            <button type="button" className="ai-input__mic" aria-label="Фото речі — помічник підготує її для сайту"
              title="Фото речі в чат" disabled={busy} onClick={() => picker.current?.click()}>
              <CameraIcon />
            </button>
          </>
        )}
        <label className="ai-input__field">
          <span className="visually-hidden">Запит помічнику</span>
          <input value={text} maxLength={1000} placeholder={dictation.listening ? 'Слухаю…' : placeholder} onChange={(e) => setText(e.target.value)} />
        </label>
        {dictation.supported && (
          <button type="button" className={`ai-input__mic${dictation.listening ? ' is-on' : ''}`} aria-pressed={dictation.listening}
            aria-label={dictation.listening ? 'Зупинити запис' : 'Сказати голосом'} onClick={dictation.toggle}>
            <MicIcon />
          </button>
        )}
        <button type="submit" className="ai-input__send" aria-label="Надіслати помічнику" disabled={busy || (!text.trim() && files.length === 0)}>
          <ArrowRightIcon size={22} />
        </button>
      </form>
    </div>
  )
}
