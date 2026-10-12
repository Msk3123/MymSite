import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { SHOP } from '../config'
import { ChatIcon } from './Icons'
import { DesktopHeader } from './SiteHeader'

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-footer__name">{SHOP.name}</span>
          <span className="site-footer__contacts">
            <span>{SHOP.owner} · {SHOP.city}</span>
            <span>{SHOP.phone} · Viber, Telegram</span>
            <span>Нова Пошта по всій Україні</span>
          </span>
        </div>
        <nav aria-label="Інформація" className="site-footer__nav">
          <Link to="/#about">Про мене</Link>
          <Link to="/#how-to-order">Доставка й оплата</Link>
          <Link to="/#how-to-order">Обмін і повернення</Link>
        </nav>
      </div>
    </footer>
  )
}

function MessengerFab({ compact }: { compact: boolean }) {
  return (
    <a
      href={SHOP.telegramUrl}
      target="_blank"
      rel="noreferrer"
      className={`fab${compact ? ' fab--compact' : ''}`}
      aria-label="Написати у месенджер"
    >
      <ChatIcon />
      <span className="fab__mobile-text">Написати</span>
      <span className="fab__desktop-text">Viber · Telegram</span>
    </a>
  )
}

/** Скрол угору при переході між сторінками і до якоря (#about) — якщо він є. */
function useScrollOnNavigate() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
}

export function Layout() {
  const { pathname } = useLocation()
  useScrollOnNavigate()

  const isProduct = pathname.startsWith('/product/')
  const isCheckout = pathname === '/checkout'

  return (
    <div className={`app${isProduct ? ' app--product' : ''}`}>
      <a className="skip-link" href="#main">Перейти до змісту</a>
      <DesktopHeader />
      <Outlet />
      <SiteFooter />
      {!isCheckout && <MessengerFab compact={pathname !== '/'} />}
    </div>
  )
}
