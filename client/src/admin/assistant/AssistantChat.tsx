import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRightIcon, MicIcon } from '../../components/Icons'
import type { Bubble } from './useAssistantChat'
import { useDictation } from './useDictation'

interface AssistantLogProps {
  messages: Bubble[]
  busy: boolean
  /** Що показати, поки розмова порожня */
  intro?: ReactNode
}

export function AssistantLog({ messages, busy, intro }: AssistantLogProps) {
  const end = useRef<HTMLDivElement>(null)
  // Фігурні дужки важливі: у нових Chrome scrollIntoView повертає Promise, а React сприйняв би його як cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, busy])

  return (
    <div className="ai-log" aria-live="polite">
      {messages.length === 0 && intro}
      {messages.map((m, i) => (
        <div key={i} className={`ai-bubble ai-bubble--${m.role}${m.error ? ' ai-bubble--error' : ''}`}>{m.text}</div>
      ))}
      {busy && <div className="ai-bubble ai-bubble--assistant ai-bubble--typing">Думаю…</div>}
      <div ref={end} />
    </div>
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
}

export function AssistantInput({ hints, busy, onAsk, before, placeholder = 'Спитайте помічника…', large }: AssistantInputProps) {
  const [text, setText] = useState('')
  const dictation = useDictation(setText)

  const send = (value: string) => {
    if (!value.trim() || busy) return
    onAsk(value)
    setText('')
  }

  return (
    <div className={`ai-input${large ? ' ai-input--large' : ''}`}>
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
