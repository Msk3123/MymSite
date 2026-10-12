import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE = 'Мамина шафа'

interface PageMeta {
  /** Без назви сайту — «| Мамина шафа» додамо самі */
  title: string
  description?: string
  /** Сторінка не для пошуковиків (кошик, 404, кабінет) */
  noindex?: boolean
  /** Розмітка schema.org (JSON-LD) — наприклад, Product з ціною й наявністю */
  jsonLd?: object
  image?: string
}

function setMeta(attr: 'name' | 'property', key: string, value: string | undefined) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!value) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = value
}

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = href
}

/**
 * Заголовок, опис і розмітка сторінки для Google та прев'ю посилань у месенджерах.
 * Google виконує JavaScript, тож бачить саме ці значення.
 */
export function usePageMeta({ title, description, noindex, jsonLd, image }: PageMeta) {
  const { pathname, search } = useLocation()
  const ld = jsonLd ? JSON.stringify(jsonLd) : ''

  useEffect(() => {
    const full = title === SITE ? title : `${title} | ${SITE}`
    document.title = full
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', full)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', location.origin + pathname + search)
    setMeta('property', 'og:image', image ? new URL(image, location.origin).href : `${location.origin}/og.png`)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : undefined)
    // Каталог із фільтрами — окремі сторінки, тому параметри лишаємо в canonical.
    setCanonical(location.origin + pathname + search)

    const id = 'page-jsonld'
    document.getElementById(id)?.remove()
    if (ld) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.id = id
      script.text = ld
      document.head.appendChild(script)
    }
  }, [title, description, noindex, ld, image, pathname, search])
}
