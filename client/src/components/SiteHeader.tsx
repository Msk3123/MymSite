import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useCart } from '../cart/CartContext'
import { SHOP } from '../config'
import { catalogUrl, filtersToParams, parseFilters, parseSort } from '../lib/filters'
import { itemsCount } from '../lib/format'
import { ArrowLeftIcon, BagIcon, CloseIcon, LogoMark, MenuIcon, SearchIcon } from './Icons'

const NAV = [
  { to: '/catalog', label: 'Каталог' },
  { to: catalogUrl({ category: 'lots' }), label: 'Комплекти' },
  { to: '/#about', label: 'Про мене' },
  { to: '/#how-to-order', label: 'Доставка й оплата' },
]

export function SearchField({ placeholder, autoFocus }: { placeholder: string; autoFocus?: boolean }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const current = pathname === '/catalog' ? (params.get('q') ?? '') : ''
  const [value, setValue] = useState(current)
  const inputId = useId()

  useEffect(() => {
    setValue(current)
  }, [current])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    // У каталозі пошук додається до вже обраних фільтрів, з інших сторінок — починає з чистого.
    const base = pathname === '/catalog' ? parseFilters(params) : { conditions: [] }
    const sort = pathname === '/catalog' ? parseSort(params) : 'new'
    navigate(`/catalog?${filtersToParams({ ...base, q: value.trim() || undefined }, sort)}`)
  }

  return (
    <form role="search" className="search-field" onSubmit={submit}>
      <SearchIcon size={20} />
      <label className="visually-hidden" htmlFor={inputId}>Пошук</label>
      <input
        id={inputId}
        type="search"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  )
}

function CartButton() {
  const { count } = useCart()
  return (
    <Link to="/checkout" className="icon-btn cart-btn" aria-label={`Кошик, ${itemsCount(count)}`}>
      <BagIcon />
      {count > 0 && <span className="cart-btn__count">{count}</span>}
    </Link>
  )
}

export function DesktopHeader() {
  const { count } = useCart()
  const { pathname, search } = useLocation()
  // Пункти з якорем (#about) ведуть на секції головної — їх не підсвічуємо.
  const isActive = (to: string) => {
    const [path, query = ''] = to.split('?')
    if (path !== pathname) return false
    const isLots = new URLSearchParams(search).get('cat') === 'lots'
    return query.includes('cat=lots') === isLots
  }
  return (
    <header className="desktop-header">
      <div className="container desktop-header__inner">
        <Link to="/" className="logo">
          <LogoMark size={34} />
          <span className="logo__text">{SHOP.name}</span>
        </Link>
        <nav aria-label="Головне меню" className="desktop-nav">
          {NAV.map((item) => (
            <Link key={item.label} to={item.to} className={isActive(item.to) ? 'active' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <SearchField placeholder="Куртка, Reserved, 98…" />
        <Link to="/checkout" className="cart-pill">
          <BagIcon size={22} />
          Кошик
          {count > 0 && <span className="cart-pill__count">{count}</span>}
        </Link>
      </div>
    </header>
  )
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const { pathname, search } = useLocation()
  const [opened] = useState(pathname + search)

  // Закриваємо меню, щойно відбувся перехід.
  useEffect(() => {
    if (pathname + search !== opened) onClose()
  }, [pathname, search, opened, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <nav className="mobile-menu" aria-label="Меню" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-menu__top">
          <span className="logo__text">{SHOP.name}</span>
          <button className="icon-btn" aria-label="Закрити меню" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <Link to="/">Головна</Link>
        {NAV.map((item) => (
          <Link key={item.label} to={item.to}>
            {item.label}
          </Link>
        ))}
        <Link to="/checkout">Кошик</Link>
      </nav>
    </div>
  )
}

interface MobileHeaderProps {
  /** Куди веде стрілка «назад». Без неї зліва буде логотип. */
  backTo?: string
  backLabel?: string
  /** Вміст по центру: пошук, назва сторінки, хлібні крихти */
  children?: ReactNode
  /** Повний логотип з назвою (головна сторінка) */
  brand?: boolean
  cart?: boolean
  menu?: boolean
  searchButton?: boolean
  right?: ReactNode
}

export function MobileHeader({ backTo, backLabel = 'Назад', children, brand, cart, menu, searchButton, right }: MobileHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <header className={`mobile-header${brand ? ' mobile-header--brand' : ''}`}>
      {backTo ? (
        <Link to={backTo} className="icon-btn" aria-label={backLabel}>
          <ArrowLeftIcon />
        </Link>
      ) : brand ? (
        <Link to="/" className="logo logo--grow">
          <LogoMark />
          <span className="logo__text">{SHOP.name}</span>
        </Link>
      ) : (
        <Link to="/" className="icon-btn" aria-label="На головну">
          <LogoMark />
        </Link>
      )}
      {children && <div className="mobile-header__center">{children}</div>}
      {searchButton && (
        <button className="icon-btn" aria-label="Пошук" onClick={() => navigate('/catalog', { state: { focusSearch: true } })}>
          <SearchIcon />
        </button>
      )}
      {cart && <CartButton />}
      {menu && (
        <button className="icon-btn" aria-label="Меню" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          <MenuIcon />
        </button>
      )}
      {right}
      {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} />}
    </header>
  )
}
