import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightIcon, CameraIcon, CheckIcon, MicIcon } from '../../components/Icons'
import { formatPrice } from '../../lib/format'
import type { AdminProductListItem, AssistantActionKind } from '../api'
import { ProductStatusDot } from '../ui'
import { ConfirmDialog } from '../ConfirmDialog'
import { useActionMode, type ActionCard, type Bubble } from './useAssistantChat'
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

interface AssistantLogProps {
  messages: Bubble[]
  busy: boolean
  /** Що показати, поки розмова порожня */
  intro?: ReactNode
  onDecide?: (bubble: number, card: number, confirm: boolean) => void
}

export function AssistantLog({ messages, busy, intro, onDecide }: AssistantLogProps) {
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
          <div className={`ai-bubble ai-bubble--${m.role}${m.error ? ' ai-bubble--error' : ''}`}>{m.text}</div>
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
  /** Зліва від поля — наприклад, кнопка камери на сторінці помічника */
  before?: ReactNode
  placeholder?: string
  large?: boolean
  /** Над підказками, у закріпленій нижній панелі — тут живе перемикач «Поради / Дії» */
  toolbar?: ReactNode
}

export function AssistantInput({ hints, busy, onAsk, before, placeholder = 'Спитайте помічника…', large, toolbar }: AssistantInputProps) {
  const [text, setText] = useState('')
  const dictation = useDictation(setText)

  const send = (value: string) => {
    if (!value.trim() || busy) return
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
      <form className="ai-input__row" onSubmit={(e) => { e.preventDefault(); send(text) }}>
        {before}
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
        <button type="submit" className="ai-input__send" aria-label="Надіслати помічнику" disabled={busy || !text.trim()}>
          <ArrowRightIcon size={22} />
        </button>
      </form>
    </div>
  )
}
