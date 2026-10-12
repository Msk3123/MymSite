import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../api/http'
import { adminApi, type AdminProductListItem, type AssistantAction, type ChatMessage } from '../api'
import { notifyDataChanged } from '../ui'

export type ActionState = 'pending' | 'busy' | 'done' | 'declined' | 'error'

export interface ActionCard {
  action: AssistantAction
  state: ActionState
  /** Результат або помилка — показуємо під карткою */
  note?: string
}

export interface Bubble extends ChatMessage {
  error?: boolean
  actions?: ActionCard[]
  /** Речі, про які відповідь, — показуємо міні-картками */
  products?: AdminProductListItem[]
}

const STORAGE_KEY = 'mamyna-shafa:assistant'
const MODE_KEY = 'mamyna-shafa:assistant-mode'
const CHANGE_EVENT = 'assistant-chat:change'

// Розмова одна на весь кабінет: почала в плаваючій панелі — продовжила на сторінці «Помічник».
// Живе до закриття вкладки, щоб випадкове оновлення сторінки її не стерло.
function load(): Bubble[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as Bubble[]) : []
  } catch {
    return []
  }
}

function save(messages: Bubble[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch {
    // приватний режим — просто не збережемо
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

const OUTCOME: Record<ActionState, string> = {
  pending: 'чекає її рішення',
  busy: 'виконується',
  done: 'виконано',
  declined: 'вона відмовилась',
  error: 'не вдалося',
}

/** Для моделі: що сталося з підготовленими діями — щоб у наступній відповіді вона не плутала «зроблено» й «ні». */
function forModel(b: Bubble): ChatMessage {
  if (!b.actions?.length) return { role: b.role, text: b.text }
  const outcome = b.actions.map((a) => `«${a.action.summary}» — ${OUTCOME[a.state]}`).join('; ')
  return { role: b.role, text: `${b.text}\n[Дії: ${outcome}]` }
}

/** «Режим дій»: вимкнений за замовчуванням, вмикається свідомо (з попередженням) і пам'ятається на цьому пристрої. */
export function useActionMode() {
  const read = () => {
    try {
      return localStorage.getItem(MODE_KEY) === 'actions'
    } catch {
      return false
    }
  }
  const [on, setOn] = useState(read)

  useEffect(() => {
    const sync = () => setOn(read())
    window.addEventListener(CHANGE_EVENT, sync)
    return () => window.removeEventListener(CHANGE_EVENT, sync)
  }, [])

  const set = useCallback((value: boolean) => {
    try {
      localStorage.setItem(MODE_KEY, value ? 'actions' : 'advice')
    } catch {
      // не збережеться між сесіями — не страшно
    }
    setOn(value)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return [on, set] as const
}

export function useAssistantChat(context: string, onDataChanged?: () => void) {
  const [messages, setMessages] = useState<Bubble[]>(load)
  const [busy, setBusy] = useState(false)
  const [actionsOn] = useActionMode()

  // Друга копія чату (панель ↔ сторінка) підхоплює зміни.
  useEffect(() => {
    const sync = () => setMessages(load())
    window.addEventListener(CHANGE_EVENT, sync)
    return () => window.removeEventListener(CHANGE_EVENT, sync)
  }, [])

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || busy) return
      const history: Bubble[] = [...load(), { role: 'user', text: q }]
      save(history)
      setBusy(true)
      try {
        // Помилки не надсилаємо моделі — вони лише заплутають.
        const reply = await adminApi.ask(history.filter((m) => !m.error).map(forModel), context, actionsOn)
        save([
          ...load(),
          {
            role: 'assistant',
            text: reply.text,
            actions: reply.actions.map((action) => ({ action, state: 'pending' })),
            products: reply.products,
          },
        ])
      } catch (err) {
        const text = err instanceof ApiError ? err.message : 'Не вдалося отримати відповідь. Спробуйте ще раз.'
        save([...load(), { role: 'assistant', text, error: true }])
      } finally {
        setBusy(false)
      }
    },
    [busy, context, actionsOn],
  )

  const updateCard = (bubble: number, card: number, patch: Partial<ActionCard>) => {
    const all = load()
    const target = all[bubble]?.actions?.[card]
    if (!target) return
    all[bubble] = { ...all[bubble], actions: all[bubble].actions!.map((c, i) => (i === card ? { ...c, ...patch } : c)) }
    save(all)
  }

  /** Мама натиснула «Так» або «Ні» на картці дії. */
  const decide = useCallback(
    async (bubble: number, card: number, confirm: boolean) => {
      const target = load()[bubble]?.actions?.[card]
      if (!target || target.state !== 'pending') return
      if (!confirm) {
        updateCard(bubble, card, { state: 'declined' })
        return
      }
      updateCard(bubble, card, { state: 'busy' })
      try {
        const { message } = await adminApi.executeAction(target.action)
        updateCard(bubble, card, { state: 'done', note: message })
        notifyDataChanged()
        onDataChanged?.()
      } catch (err) {
        updateCard(bubble, card, { state: 'error', note: err instanceof ApiError ? err.message : 'Не вдалося. Спробуйте ще раз.' })
      }
    },
    [onDataChanged],
  )

  const reset = useCallback(() => save([]), [])

  return { messages, busy, ask, decide, reset, actionsOn }
}
