import { Link } from 'react-router-dom'
import { GarmentArt } from '../components/GarmentArt'
import { ArrowRightIcon, CameraIcon, DropIcon, SunIcon } from '../components/Icons'
import { LotCard, ProductCard } from '../components/ProductCard'
import { MobileHeader } from '../components/SiteHeader'
import { SHOP } from '../config'
import { countProducts, fetchProducts } from '../api/products'
import { REVIEWS, SIZES, type Gender } from '../data/catalog'
import { catalogUrl } from '../lib/filters'
import { itemsCount } from '../lib/format'
import { useAsync } from '../lib/useAsync'

const GENDER_KEYS: Gender[] = ['boy', 'girl', 'unisex']

/** Усе, що потрібно головній, одним махом: лічильники «для кого», сезон і комплекти. */
async function loadHome() {
  const [counts, season, lots] = await Promise.all([
    Promise.all(GENDER_KEYS.map((gender) => countProducts({ filters: { gender }, includeSold: false }))),
    fetchProducts({ filters: { season: 'autumn-winter' }, includeSold: false, pageSize: 10 }),
    fetchProducts({ filters: { category: 'lots' }, includeSold: false, pageSize: 4 }),
  ])
  return {
    counts: Object.fromEntries(GENDER_KEYS.map((g, i) => [g, counts[i]])) as Record<Gender, number>,
    // Комплекти мають свій блок нижче — у «сезоні» їх не дублюємо.
    seasonItems: season.items.filter((p) => p.category !== 'lots').slice(0, 5),
    lots: lots.items,
  }
}

function HeroArt() {
  return (
    <>
      <svg className="hero__art hero__art--mobile" viewBox="0 0 358 200" role="img" aria-label="Дитячі речі на вішаках">
        <path d="M24 34 H334" stroke="#94867a" strokeWidth="3" strokeLinecap="round" />
        <g fill="none" stroke="#94867a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M84 34 V30 q0 -8 7 -8 q6 0 6 6" /><path d="M84 42 L58 56 H110 Z" />
          <path d="M180 34 V30 q0 -8 7 -8 q6 0 6 6" /><path d="M180 42 L154 56 H206 Z" />
          <path d="M276 34 V30 q0 -8 7 -8 q6 0 6 6" /><path d="M276 42 L250 56 H302 Z" />
        </g>
        <g transform="translate(40 36) scale(0.88 1.15)"><path d="M38 22 Q50 13 62 22 L66 28 L82 36 L90 80 L80 82 L74 54 L74 104 L26 104 L26 54 L20 82 L10 80 L18 36 L34 28 Z" fill="#8fa68a" /><path d="M50 30 L50 102" stroke="#fbf7f0" strokeWidth="1.6" strokeDasharray="3 3" fill="none" /></g>
        <g transform="translate(136 40) scale(0.88 1.1)"><path d="M40 22 L60 22 L62 30 L71 34 L66 54 L84 106 L16 106 L34 54 L29 34 L38 30 Z" fill="#d4a59b" /><path d="M34 54 L66 54" stroke="#fbf7f0" strokeWidth="1.6" strokeDasharray="3 3" fill="none" /></g>
        <g transform="translate(232 36) scale(0.88 1.12)"><path d="M36 24 Q50 33 64 24 L84 34 L92 78 L82 80 L76 54 L76 104 L24 104 L24 54 L18 80 L8 78 L16 34 Z" fill="#b5532f" opacity="0.82" /><path d="M26 96 L74 96" stroke="#fbf7f0" strokeWidth="1.6" strokeDasharray="3 3" fill="none" /></g>
        <circle cx="330" cy="176" r="5" fill="#2e2620" opacity="0.12" /><circle cx="314" cy="184" r="3" fill="#2e2620" opacity="0.12" />
      </svg>
      <svg className="hero__art hero__art--desktop" viewBox="0 0 520 440" role="img" aria-label="Дитячі речі на вішаках">
        <path d="M30 70 H500" stroke="#94867a" strokeWidth="4" strokeLinecap="round" />
        <g fill="none" stroke="#94867a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M120 70 V64 q0 -11 10 -11 q9 0 9 8" /><path d="M120 80 L84 100 H156 Z" />
          <path d="M262 70 V64 q0 -11 10 -11 q9 0 9 8" /><path d="M262 80 L226 100 H298 Z" />
          <path d="M404 70 V64 q0 -11 10 -11 q9 0 9 8" /><path d="M404 80 L368 100 H440 Z" />
        </g>
        <g transform="translate(58 72) scale(1.24 1.8)"><path d="M38 22 Q50 13 62 22 L66 28 L82 36 L90 80 L80 82 L74 54 L74 104 L26 104 L26 54 L20 82 L10 80 L18 36 L34 28 Z" fill="#8fa68a" /><path d="M50 30 L50 102" stroke="#fbf7f0" strokeWidth="1.4" strokeDasharray="3 3" fill="none" /></g>
        <g transform="translate(200 78) scale(1.24 1.7)"><path d="M40 22 L60 22 L62 30 L71 34 L66 54 L84 106 L16 106 L34 54 L29 34 L38 30 Z" fill="#d4a59b" /><path d="M34 54 L66 54" stroke="#fbf7f0" strokeWidth="1.4" strokeDasharray="3 3" fill="none" /></g>
        <g transform="translate(342 72) scale(1.24 1.74)"><path d="M36 24 Q50 33 64 24 L84 34 L92 78 L82 80 L76 54 L76 104 L24 104 L24 54 L18 80 L8 78 L16 34 Z" fill="#b5532f" opacity="0.82" /><path d="M26 96 L74 96" stroke="#fbf7f0" strokeWidth="1.4" strokeDasharray="3 3" fill="none" /></g>
      </svg>
    </>
  )
}

const CHECKS = [
  { icon: <DropIcon />, title: 'Перу й прасую', text: 'Гіпоалергенним засобом, без ароматизаторів. Приходить чисте — можна одразу вдягати.' },
  { icon: <SunIcon />, title: 'Дивлюся на світлі', text: 'Плями, затяжки, катишки, блискавки, кнопки — перевіряю кожну річ з обох боків.' },
  { icon: <CameraIcon />, title: 'Знімаю кожен нюанс', text: 'Бірка з розміром, склад, крупно — кожен дефект. Описую так, як розповіла б подрузі.' },
]

const STEPS = [
  { title: 'Оберіть речі', text: 'Фільтр за зростом — і бачите лише те, що підійде.' },
  { title: 'Оформіть або напишіть', text: 'Форма без реєстрації, або одразу у Viber чи Telegram — відповідаю протягом години.' },
  { title: 'Отримайте на Новій Пошті', text: 'Відправляю за 1–2 дні. Оплата на карту або накладений платіж.' },
]

// Поки лічильник не прийшов — нерозривний пробіл, щоб картка не стрибала по висоті.
const countLabel = (n?: number) => (n === undefined ? '\u00a0' : itemsCount(n))

export function HomePage() {
  const { data: home } = useAsync('home', loadHome)
  const { minItems, percent } = SHOP.bulkDiscount
  const discount = `Від ${minItems} речей — знижка ${percent}%`

  return (
    <>
      <MobileHeader brand searchButton cart menu />
      <main id="main" className="container home">
        <section className="hero">
          <div className="hero__text">
            <div className="eyebrow">Речі від народження до 10 років</div>
            <h1>Якісні дитячі речі за чесною ціною</h1>
            <p>Кожну річ я перу, перевіряю на світлі й фотографую всі нюанси. Якщо є дефект — ви побачите його на фото, а не вдома.</p>
            <div className="hero__actions">
              <Link to="/#sizes" className="btn btn--primary btn--lg">
                Підібрати за розміром
                <ArrowRightIcon />
              </Link>
              <Link to="/catalog" className="btn btn--outline btn--lg hero__all">Весь каталог</Link>
              <Link to="/catalog" className="text-link hero__all-mobile">Дивитися весь каталог</Link>
            </div>
            <div className="hero__perks">
              <span>Нова Пошта за 1–2 дні</span><span>Накладений платіж</span><span>Від {minItems} речей −{percent}%</span>
            </div>
          </div>
          <div className="hero__media">
            <HeroArt />
          </div>
        </section>

        <section className="section" aria-labelledby="who-h">
          <h2 id="who-h" className="section__title only-mobile">Для кого шукаєте?</h2>
          <div className="who-grid">
            <Link to={catalogUrl({ gender: 'boy' })} className="who-card who-card--boy">
              <span className="who-card__title">Для хлопчика</span>
              <span className="who-card__count">{countLabel(home?.counts.boy)}</span>
              <GarmentArt kind="tee" color="#8fa68a" stitch={false} className="who-card__art" />
            </Link>
            <Link to={catalogUrl({ gender: 'girl' })} className="who-card who-card--girl">
              <span className="who-card__title">Для дівчинки</span>
              <span className="who-card__count">{countLabel(home?.counts.girl)}</span>
              <GarmentArt kind="dress" color="#d4a59b" stitch={false} className="who-card__art" />
            </Link>
            <Link to={catalogUrl({ gender: 'unisex' })} className="who-card who-card--unisex">
              <span className="who-card__text">
                <span className="who-card__title">Унісекс</span>
                <span className="who-card__count">
                  <span className="only-mobile">Комбінезони, шапки, боді — </span>
                  {countLabel(home?.counts.unisex)}
                </span>
              </span>
              <ArrowRightIcon size={24} className="who-card__arrow" />
              <GarmentArt kind="overall" color="#dcc29a" stitch={false} className="who-card__art" />
            </Link>
          </div>
        </section>

        <section id="sizes" className="section" aria-labelledby="sizes-h">
          <div className="section__head section__head--stack">
            <h2 id="sizes-h" className="section__title">Оберіть зріст дитини</h2>
            <p className="section__sub">Одразу покажу речі цього розміру</p>
          </div>
          <div className="size-grid">
            {SIZES.map((s) => (
              <Link key={s.cm} to={catalogUrl({ size: s.cm })} className="size-tile">
                <span className="size-tile__cm">{s.cm}</span>
                <span className="size-tile__age">{s.age}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Порожній магазин (щойно запущений) — не показуємо порожні блоки. */}
        {(!home || home.seasonItems.length > 0) && (
        <section className="section section--bleed" aria-labelledby="season-h">
          <div className="section__head section__head--row">
            <h2 id="season-h" className="section__title">Зараз в сезоні</h2>
            <Link to={catalogUrl({ season: 'autumn-winter' })} className="text-link">
              <span className="only-mobile">Осінь–зима</span>
              <span className="only-desktop">Усі речі осінь–зима</span>
            </Link>
          </div>
          <div className="card-rail">
            {home?.seasonItems.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
        )}

        {(!home || home.lots.length > 0) && (
        <section className="section" aria-labelledby="lots-h">
          <div className="section__head section__head--stack">
            <h2 id="lots-h" className="section__title">Комплекти та лоти</h2>
            <p className="section__sub">Зібрала речі одного розміру — дешевше, ніж поштучно</p>
          </div>
          <div className="lot-grid">
            {home?.lots.map((p) => (
              <LotCard key={p.id} product={p} />
            ))}
          </div>
        </section>
        )}

        <div className="trust-row">
          <section className="trust" aria-labelledby="trust-h">
            <h2 id="trust-h" className="section__title">Як я перевіряю речі</h2>
            <div className="trust__grid">
              {CHECKS.map((c) => (
                <div key={c.title} className="trust__item">
                  <span className="trust__icon">{c.icon}</span>
                  <div>
                    <div className="trust__title">{c.title}</div>
                    <div className="trust__text">{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="about" className="about" aria-labelledby="about-h">
            <div className="about__head">
              <div role="img" aria-label="Місце для фото продавчині" className="about__photo">ФОТО<br />ОКСАНИ</div>
              <div>
                <h2 id="about-h" className="section__title">Привіт, я {SHOP.owner}</h2>
                <span className="about__who">мама двох дітей · {SHOP.city}</span>
              </div>
            </div>
            <p>Мої діти виросли швидше, ніж зносили речі. Зберігала все акуратно — тепер хочу, щоб ці речі тішили інших малих. Не магазин і не перекупка: кожну річ я знаю особисто і чесно розповім про неї.</p>
            <Link to="/#how-to-order" className="text-link">Більше про доставку й обмін</Link>
          </section>
        </div>

        <section className="section" aria-labelledby="reviews-h">
          <h2 id="reviews-h" className="section__title">Що кажуть мами</h2>
          <div className="review-grid">
            {REVIEWS.map((r) => (
              <figure key={r.who} className="review">
                <blockquote>{r.text}</blockquote>
                <figcaption>{r.who}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section id="how-to-order" className="how" aria-labelledby="how-h">
          <div className="how__head">
            <h2 id="how-h" className="section__title">Як замовити</h2>
            <span className="pill-accent pill-accent--lg only-desktop">{discount}</span>
          </div>
          <ol className="how__steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="how__num">{i + 1}</span>
                <div>
                  <div className="how__title">{s.title}</div>
                  <div className="how__text">{s.text}</div>
                </div>
              </li>
            ))}
          </ol>
          <div className="how__promo only-mobile">{discount} на все замовлення</div>
        </section>
      </main>
    </>
  )
}
