import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/http'
import { adminApi, type AssistantNote } from '../api'

const MAX = 300

function NoteRow({ note, onSaved, onDeleted }: { note: AssistantNote; onSaved: (n: AssistantNote) => void; onDeleted: () => void }) {
  const [text, setText] = useState(note.text)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = text.trim() !== note.text

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося. Спробуйте ще раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="ai-memory__note">
      <textarea rows={2} maxLength={MAX} value={text} disabled={busy} onChange={(e) => setText(e.target.value)}
        aria-label="Нотатка помічника" />
      <div className="ai-memory__buttons">
        {changed && (
          <button type="button" className="a-btn a-btn--dark" disabled={busy || !text.trim()}
            onClick={() => run(async () => onSaved(await adminApi.updateNote(note.id, text)))}>Зберегти</button>
        )}
        <button type="button" className="a-btn a-btn--text a-btn--delete-text" disabled={busy}
          onClick={() => run(async () => { await adminApi.deleteNote(note.id); onDeleted() })}>Забути</button>
      </div>
      {error && <span className="ai-action__note ai-action__note--error">{error}</span>}
    </li>
  )
}

/**
 * «Що помічник про мене пам'ятає»: мама бачить усі нотатки, може виправити, стерти або дописати свою.
 * Помічник бере їх у кожну розмову й коли розпізнає річ з фото (ціна, коробка, стиль опису).
 */
export function MemoryDialog({ onClose }: { onClose: () => void }) {
  const [notes, setNotes] = useState<AssistantNote[] | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const close = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    close.current?.focus()
    adminApi.notes().then(setNotes, () => setError('Не вдалося завантажити. Спробуйте ще раз.'))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const note = await adminApi.addNote(draft)
      setNotes((list) => [...(list ?? []), note])
      setDraft('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося. Спробуйте ще раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="a-dialog-backdrop" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="memory-h" className="a-dialog ai-memory" onClick={(e) => e.stopPropagation()}>
        <h2 id="memory-h">Що я про вас пам’ятаю</h2>
        <p className="a-dialog__text">
          Розкажіть мені в чаті, як ставите ціни, де що лежить, як писати описи, — я запишу сама.
          Тут можна виправити або стерти будь-що.
        </p>

        {notes === null && !error && <p className="a-muted">Завантажую…</p>}
        {notes?.length === 0 && <p className="a-muted">Поки нічого. Наприклад, скажіть: «Запам’ятай: Reima ставлю від 300 грн».</p>}
        {notes && notes.length > 0 && (
          <ul className="ai-memory__list">
            {notes.map((n) => (
              <NoteRow key={n.id} note={n}
                onSaved={(saved) => setNotes((list) => list!.map((x) => (x.id === saved.id ? saved : x)))}
                onDeleted={() => setNotes((list) => list!.filter((x) => x.id !== n.id))} />
            ))}
          </ul>
        )}

        <form className="ai-memory__add" onSubmit={add}>
          <label className="visually-hidden" htmlFor="memory-new">Нова нотатка</label>
          <textarea id="memory-new" rows={2} maxLength={MAX} value={draft} disabled={busy} onChange={(e) => setDraft(e.target.value)}
            placeholder="Дописати самій: «Зимове лежить у синіх коробках»" />
          <button type="submit" className="a-btn a-btn--outline" disabled={busy || !draft.trim()}>Додати</button>
        </form>
        {error && <span className="ai-action__note ai-action__note--error">{error}</span>}

        <button ref={close} type="button" className="a-btn a-btn--primary a-btn--lg" onClick={onClose}>Готово</button>
      </section>
    </div>
  )
}
