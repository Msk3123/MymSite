import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../api/http'
import { adminApi, type ChatMessage } from '../api'

export interface Bubble extends ChatMessage {
  error?: boolean
}

const STORAGE_KEY = 'mamyna-shafa:assistant'
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

export function useAssistantChat(context: string) {
  const [messages, setMessages] = useState<Bubble[]>(load)
  const [busy, setBusy] = useState(false)

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
        const { text } = await adminApi.ask(history.filter((m) => !m.error).map(({ role, text }) => ({ role, text })), context)
        save([...load(), { role: 'assistant', text }])
      } catch (err) {
        const text = err instanceof ApiError ? err.message : 'Не вдалося отримати відповідь. Спробуйте ще раз.'
        save([...load(), { role: 'assistant', text, error: true }])
      } finally {
        setBusy(false)
      }
    },
    [busy, context],
  )

  const reset = useCallback(() => save([]), [])

  return { messages, busy, ask, reset }
}
