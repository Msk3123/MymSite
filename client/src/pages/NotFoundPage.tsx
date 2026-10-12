import { usePageMeta } from '../lib/usePageMeta'
import { Link } from 'react-router-dom'
import { MobileHeader } from '../components/SiteHeader'

export function NotFoundPage() {
  usePageMeta({ title: 'Такої сторінки немає', noindex: true })
  return (
    <>
      <MobileHeader brand cart />
      <main id="main" className="container checkout checkout--done">
        <section className="done">
          <h1>Такої сторінки немає</h1>
          <p>Можливо, річ уже продана або посилання застаріло.</p>
          <Link to="/catalog" className="btn btn--primary btn--block">До каталогу</Link>
          <Link to="/" className="text-link">На головну</Link>
        </section>
      </main>
    </>
  )
}
