import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../api/http'
import type { Category, Condition, Gender, Season } from '../../data/catalog'
import { adminApi, type AdminProductListItem, type AssistantAction, type ChatMessage, type ProductInput } from '../api'
import { resizeImage, shrinkForAi } from '../resizeImage'
import { notifyDataChanged } from '../ui'

export type ActionState = 'pending' | 'busy' | 'done' | 'declined' | 'error'

export interface ActionCard {
  action: AssistantAction
  state: ActionState
  /** Результат або помилка — показуємо під карткою */
  note?: string
}

/** Нова річ, яку помічник розпізнав з фото в чаті. Створюється лише після «Виставити на сайт» / «Чернетка». */
export interface DraftItem {
  id: string
  name: string
  brand: string | null
  gender: Gender
  category: Category
  season: Season
  condition: Condition
  sizeCm: number | null
  sizeNote: string | null
  composition: string | null
  insulation: string | null
  description: string
  defectNote: string | null
  uncertain: string[]
  price: number | null
  /** Звідки ціна: мама написала («за 200»), її правило з пам'яті помічника чи підставили з подібних речей */
  priceFrom?: 'text' | 'memory' | 'hint'
  /** «Де лежить» за маминим правилом з пам'яті */
  storageLocation?: string | null
  thumbs: string[]
  state: 'pending' | 'busy' | 'done' | 'declined' | 'error' | 'expired'
  published?: boolean
  productId?: string
  note?: string
}

export interface Bubble extends ChatMessage {
  error?: boolean
  actions?: ActionCard[]
  /** Мініатюри фото, які мама прикріпила до повідомлення */
  photos?: string[]
  draft?: DraftItem
  /** Речі, про які відповідь, — показуємо міні-картками */
  products?: AdminProductListItem[]
  /** Що помічник записав у пам'ять цією відповіддю */
  remembered?: string[]
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

// Фото для нових речей тримаємо в пам'яті вкладки (у sessionStorage файли не влазять).
const draftPhotos = new Map<string, Blob[]>()

/** «…за 200», «200 грн», «ціна 350» → 200 / 350. Розмір («98 см») не плутаємо з ціною. */
function priceFromText(text: string): number | null {
  const m = text.match(/(?:за|ціна|ціну|по)\s*(\d{2,5})/i) ?? text.match(/(\d{2,5})\s*(?:грн|гривень|гривні|₴)/i)
  return m ? Number(m[1]) : null
}

async function thumbnail(file: Blob) {
  const small = await resizeImage(file, { maxSide: 160, quality: 0.7 })
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => resolve('')
    reader.readAsDataURL(small)
  })
}

const DRAFT_OUTCOME: Record<DraftItem['state'], string> = {
  pending: 'чекає її рішення',
  busy: 'створюється',
  done: 'створено',
  declined: 'вона відмовилась',
  error: 'не вдалося',
  expired: 'фото загубились',
}

/** Для моделі: що сталося з підготовленими діями — щоб у наступній відповіді вона не плутала «зроблено» й «ні». */
function forModel(b: Bubble): ChatMessage {
  if (b.photos?.length) return { role: b.role, text: `${b.text} [прикріплено фото: ${b.photos.length}]` }
  if (b.draft) {
    const d = b.draft
    const done = d.state === 'done' ? (d.published ? 'виставлено на сайт' : 'збережено чернеткою') : DRAFT_OUTCOME[d.state]
    return { role: b.role, text: `${b.text}\n[Нова річ з фото «${d.name}», ${d.price ?? '?'} грн — ${done}]` }
  }
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
            remembered: reply.remembered?.length ? reply.remembered : undefined,
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

  /** Мама прикріпила фото: розпізнаємо річ і показуємо картку «Виставити на сайт». */
  const askWithPhotos = useCallback(
    async (text: string, files: File[]) => {
      if (busy || files.length === 0) return
      const list = files.slice(0, 4)
      const thumbs = await Promise.all(list.map(thumbnail))
      save([...load(), { role: 'user', text: text.trim() || 'Виклади цю річ', photos: thumbs }])
      setBusy(true)
      try {
        const forSite = await Promise.all(list.map((f) => resizeImage(f)))
        const forAi = await Promise.all(forSite.map((b) => shrinkForAi(b, true)))
        const s = await adminApi.describe(forAi, null)

        // Ціна: що мама написала → її правило з пам'яті помічника → як у схожих речей.
        let price = priceFromText(text)
        let priceFrom: DraftItem['priceFrom'] = 'text'
        if (price === null && s.price) {
          price = s.price
          priceFrom = 'memory'
        }
        if (price === null) {
          priceFrom = 'hint'
          const { hint } = await adminApi.priceHint(s.category).catch(() => ({ hint: null }))
          price = hint ? Math.round((hint.min + hint.max) / 2 / 10) * 10 : null
        }

        const id = crypto.randomUUID()
        draftPhotos.set(id, forSite)
        const missing = [!s.name && 'назву', !s.sizeCm && 'розмір', price === null && 'ціну'].filter(Boolean)
        save([
          ...load(),
          {
            role: 'assistant',
            text: missing.length
              ? `Ось що я побачила на фото. Допишіть ${missing.join(' і ')} й натисніть «Виставити на сайт».`
              : 'Ось що я побачила на фото. Перевірте ціну й натисніть «Виставити на сайт».',
            draft: {
              id,
              name: s.name,
              brand: s.brand,
              gender: s.gender,
              category: s.category,
              season: s.season,
              condition: s.condition,
              sizeCm: s.sizeCm,
              sizeNote: s.sizeNote,
              composition: s.composition,
              insulation: s.insulation,
              description: s.description,
              defectNote: s.defectNote,
              uncertain: s.uncertain,
              price,
              priceFrom: price === null ? undefined : priceFrom,
              storageLocation: s.storageLocation,
              thumbs,
              state: 'pending',
            },
          },
        ])
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Не вдалося розібрати фото. Спробуйте ще раз.'
        save([...load(), { role: 'assistant', text: message, error: true }])
      } finally {
        setBusy(false)
      }
    },
    [busy],
  )

  const updateDraft = (bubble: number, patch: Partial<DraftItem>) => {
    const all = load()
    if (!all[bubble]?.draft) return
    all[bubble] = { ...all[bubble], draft: { ...all[bubble].draft!, ...patch } }
    save(all)
  }

  /** «Виставити на сайт» / «Чернетка» / «Ні» на картці нової речі. */
  const decideDraft = useCallback(
    async (bubble: number, choice: { name: string; price: number; sizeCm: number; publish: boolean } | null) => {
      const d = load()[bubble]?.draft
      if (!d || d.state !== 'pending') return
      if (!choice) {
        updateDraft(bubble, { state: 'declined' })
        draftPhotos.delete(d.id)
        return
      }
      const photos = draftPhotos.get(d.id)
      if (!photos) {
        updateDraft(bubble, { state: 'expired', note: 'Сторінку оновили — фото загубились. Прикріпіть їх ще раз.' })
        return
      }
      updateDraft(bubble, { state: 'busy' })
      try {
        const input: ProductInput = {
          name: choice.name.trim(), title: null, brand: d.brand, gender: d.gender, category: d.category, season: d.season,
          condition: d.condition, sizeCm: choice.sizeCm, price: choice.price, oldPrice: null, description: d.description || null,
          sizeNote: d.sizeNote, seasonNote: null, composition: d.composition, insulation: d.insulation, fitNote: null,
          defectNote: d.defectNote, lotContents: null, measurements: [], storageLocation: d.storageLocation ?? null,
        }
        let product = await adminApi.createProduct(input)
        for (const [i, blob] of photos.entries())
          product = await adminApi.uploadPhoto(product.id, blob, { caption: i === 0 ? 'Вигляд' : undefined })
        if (choice.publish) product = await adminApi.productStatus(product.id, 'publish')
        draftPhotos.delete(d.id)
        updateDraft(bubble, {
          state: 'done', published: choice.publish, productId: product.id, name: choice.name, price: choice.price,
          sizeCm: choice.sizeCm, note: `${product.sku}`,
        })
        notifyDataChanged()
        onDataChanged?.()
      } catch (err) {
        updateDraft(bubble, { state: 'pending', note: err instanceof ApiError ? err.message : 'Не вдалося. Спробуйте ще раз.' })
      }
    },
    [onDataChanged],
  )

  const reset = useCallback(() => save([]), [])

  return { messages, busy, ask, askWithPhotos, decide, decideDraft, reset, actionsOn }
}
