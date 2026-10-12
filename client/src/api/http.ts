/** Помилка від API у форматі ProblemDetails: title — текст для людини, code — «Order.InvalidPhone». */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      // FormData (фото) — браузер сам поставить multipart з boundary, JSON — позначаємо явно.
      headers: { Accept: 'application/json', ...(typeof init?.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'Немає з’єднання з сервером. Перевірте інтернет і спробуйте ще раз.')
  }

  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    const problem = (await response.json().catch(() => null)) as { title?: string; code?: string } | null
    throw new ApiError(response.status, problem?.title ?? 'Щось пішло не так. Спробуйте ще раз.', problem?.code)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Сесія адмінки закінчилась — AdminApp слухає цю подію і показує форму входу. */
export const UNAUTHORIZED_EVENT = 'api:unauthorized'

// Простий кеш GET-запитів: перехід «назад» у каталог не смикає сервер вдруге.
const CACHE_TTL = 60_000
const cache = new Map<string, { at: number; promise: Promise<unknown> }>()

export function cachedGet<T>(path: string): Promise<T> {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.promise as Promise<T>

  const promise = request<T>(path)
  cache.set(path, { at: Date.now(), promise })
  promise.catch(() => cache.delete(path))
  return promise
}

/** Після замовлення статуси речей змінилися — старі відповіді більше не правдиві. */
export const invalidateCache = () => cache.clear()
