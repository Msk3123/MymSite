import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { ApiError } from '../api/http'
import { CONDITIONS, type Condition } from '../data/catalog'
import { ORDER_STATUS, PRODUCT_STATUS, type AdminProductStatus, type Me, type OrderStatus, type Summary } from './api'

interface AdminSession {
  me: Me
  logout: () => void
  /** Лічильники для меню й вкладок; оновлюються після кожної дії. */
  summary: Summary | null
  refreshSummary: () => void
  /** Що зараз на екрані — помічник це «бачить». */
  assistantContext: string
  setAssistantContext: (label: string) => void
}

export const AdminContext = createContext<AdminSession | null>(null)

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used inside AdminApp')
  return ctx
}

/** Сторінка каже помічнику, що відкрито: «замовлення №1047 · Ірина». */
export function useAssistantContext(label: string) {
  const { setAssistantContext } = useAdmin()
  useEffect(() => {
    setAssistantContext(label)
  }, [label, setAssistantContext])
}

export function ProductStatusDot({ status }: { status: AdminProductStatus }) {
  const s = PRODUCT_STATUS[status]
  return (
    <span className="a-dot" style={{ color: s.fg }}>
      <i style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}

export function ProductStatusBadge({ status }: { status: AdminProductStatus }) {
  const s = PRODUCT_STATUS[status]
  return <span className="a-tag" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status]
  return <span className="a-tag" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
}

export function ConditionTag({ condition }: { condition: Condition }) {
  const c = CONDITIONS[condition]
  return <span className="a-tag a-tag--caps" style={{ background: c.bg === '#ffffff' ? '#f3ece1' : c.bg, color: c.fg }}>{c.label}</span>
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  const text = error instanceof ApiError ? error.message : 'Щось пішло не так. Спробуйте ще раз.'
  return <p className="a-error" role="alert">{text}</p>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="a-empty">{children}</p>
}

const KYIV = 'Europe/Kyiv'

const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: KYIV }).format(d)

/** «09:14», «вчора», «3 жовтня» — як у макеті списку замовлень. */
export function shortWhen(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (dayKey(d) === dayKey(now)) return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: KYIV }).format(d)
  if (dayKey(d) === dayKey(new Date(now.getTime() - 86_400_000))) return 'вчора'
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', timeZone: KYIV }).format(d)
}

/** «сьогодні о 09:14», «вчора о 19:40», «3 жовтня о 12:00». */
export function longWhen(iso: string) {
  const d = new Date(iso)
  const time = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: KYIV }).format(d)
  const when = shortWhen(iso)
  return `${when === time ? 'сьогодні' : when} о ${time}`
}

export const todayLabel = () => {
  const s = new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: KYIV }).format(new Date())
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))

export function greeting(name: string) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: KYIV }).format(new Date()))
  const part = hour < 5 ? 'Доброї ночі' : hour < 12 ? 'Доброго ранку' : hour < 18 ? 'Добрий день' : 'Добрий вечір'
  return `${part}, ${name}`
}
