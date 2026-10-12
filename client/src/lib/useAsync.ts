import { useEffect, useState } from 'react'

interface AsyncState<T> {
  data?: T
  error?: unknown
  /** true, поки дані для поточного key ще не прийшли */
  loading: boolean
}

/**
 * Завантажує дані під ключ і перезавантажує, коли ключ змінюється.
 * keepPrevious — поки вантажиться новий ключ, показувати старі дані (каталог не блимає при зміні фільтра).
 * key = null — нічого не вантажити.
 */
export function useAsync<T>(key: string | null, load: () => Promise<T>, { keepPrevious = false } = {}): AsyncState<T> {
  const [state, setState] = useState<{ key: string | null; data?: T; error?: unknown }>({ key: null })

  useEffect(() => {
    if (key === null) return
    let alive = true
    load().then(
      (data) => alive && setState({ key, data }),
      (error: unknown) => alive && setState({ key, error }),
    )
    return () => {
      alive = false
    }
    // load залежить лише від key — так і задумано
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (state.key === key) return { data: state.data, error: state.error, loading: false }
  return { data: keepPrevious ? state.data : undefined, loading: key !== null }
}
