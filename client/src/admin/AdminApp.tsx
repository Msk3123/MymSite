import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { UNAUTHORIZED_EVENT } from '../api/http'
import { HangerIcon, HomeIcon, LogoMark, PlusIcon, ReceiptIcon, SparkleIcon } from '../components/Icons'
import { adminApi, type Me, type Summary } from './api'
import { AssistantDock } from './assistant/AssistantDock'
import { AssistantPage } from './pages/AssistantPage'
import { LoginPage } from './pages/LoginPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductEditPage } from './pages/ProductEditPage'
import { ProductsPage } from './pages/ProductsPage'
import { TodayPage } from './pages/TodayPage'
import { AdminContext, useAdmin } from './ui'
import '../styles/admin.css'

function Badge({ count }: { count?: number }) {
  return count ? <span className="a-badge">{count}</span> : null
}

function AdminLayout() {
  const { me, summary, refreshSummary } = useAdmin()
  const { pathname } = useLocation()

  // Після кожного переходу — свіжі цифри в меню (нове замовлення могло прийти будь-коли).
  useEffect(refreshSummary, [pathname, refreshSummary])

  const nav = [
    { to: '/admin', label: 'Сьогодні', icon: HomeIcon, end: true, count: 0 },
    { to: '/admin/orders', label: 'Замовлення', icon: ReceiptIcon, end: false, count: summary?.newOrders },
    { to: '/admin/products', label: 'Мої речі', icon: HangerIcon, end: false, count: 0 },
    { to: '/admin/assistant', label: 'Помічник', icon: SparkleIcon, end: false, count: 0 },
  ]

  return (
    <div className="admin">
      <aside className="a-side">
        <Link to="/admin" className="a-brand">
          <LogoMark size={32} />
          <span>
            <b>Мамина шафа</b>
            <small>Кабінет · {me.ownerName}</small>
          </span>
        </Link>
        <Link to="/admin/products/new" className="a-side__add">
          <PlusIcon size={20} />
          Додати річ
        </Link>
        <nav className="a-side__nav" aria-label="Кабінет">
          {nav.map(({ to, label, end, count }) => (
            <NavLink key={to} to={to} end={end}>
              <span>{label}</span>
              <Badge count={count} />
            </NavLink>
          ))}
        </nav>
        <p className="a-side__note">
          Сайт відкритий для покупців. <a href="/" target="_blank" rel="noreferrer">Подивитися як покупець</a>
        </p>
      </aside>

      <header className="a-top">
        <Link to="/admin" className="a-brand">
          <LogoMark size={28} />
          <span><b>Мамина шафа</b><small>кабінет</small></span>
        </Link>
        <Link to="/admin/products/new" className="a-top__add" aria-label="Додати річ"><PlusIcon /></Link>
      </header>

      <main id="main" className="a-main">
        <Outlet />
      </main>

      <nav className="a-tabbar" aria-label="Розділи кабінету">
        {nav.map(({ to, label, icon: Icon, end, count }) => (
          <NavLink key={to} to={to} end={end}>
            <span className="a-tabbar__icon"><Icon /><Badge count={count} /></span>
            {label}
          </NavLink>
        ))}
      </nav>

      {!pathname.startsWith('/admin/assistant') && <AssistantDock />}
    </div>
  )
}

export function AdminApp() {
  // undefined — ще перевіряємо куку, null — треба увійти.
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [assistantContext, setAssistantContext] = useState('кабінет')

  useEffect(() => {
    document.title = 'Кабінет — Мамина шафа'
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    adminApi.me().then(setMe, () => setMe(null))
    const onUnauthorized = () => setMe(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const refreshSummary = useCallback(() => {
    adminApi.summary().then(setSummary, () => {})
  }, [])

  const logout = useCallback(() => {
    adminApi.logout().finally(() => setMe(null))
  }, [])

  if (me === undefined) return <div className="admin admin--loading" aria-busy="true" />
  if (me === null) return <LoginPage onLogin={setMe} />

  return (
    <AdminContext.Provider value={{ me, logout, summary, refreshSummary, assistantContext, setAssistantContext }}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<TodayPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:number" element={<OrdersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:id" element={<ProductEditPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AdminContext.Provider>
  )
}
