import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/http'
import { placeOrder } from '../api/orders'
import { useCart } from '../cart/CartContext'
import { GarmentArt } from '../components/GarmentArt'
import { ArrowRightIcon, CheckIcon, CloseIcon } from '../components/Icons'
import { MobileHeader } from '../components/SiteHeader'
import { SHOP } from '../config'
import { CONDITIONS } from '../data/catalog'
import { formatPrice, itemsCount, plural } from '../lib/format'
import { artFor } from '../lib/placeholderArt'

type Payment = 'card' | 'cod'

interface OrderForm {
  name: string
  phone: string
  city: string
  branch: string
  payment: Payment
  comment: string
}

type Errors = Partial<Record<keyof OrderForm, string>>

const EMPTY_FORM: OrderForm = { name: '', phone: '+380 ', city: '', branch: '', payment: 'card', comment: '' }

function validate(f: OrderForm): Errors {
  const errors: Errors = {}
  if (f.name.trim().split(/\s+/).length < 2) errors.name = 'Вкажіть ім’я та прізвище — як у паспорті для Нової Пошти'
  // Як і на сервері: +380671234567 або 0671234567.
  if (!/^(380\d{9}|0\d{9})$/.test(f.phone.replace(/\D/g, ''))) errors.phone = 'Номер у форматі +380 XX XXX XX XX'
  if (!f.city.trim()) errors.city = 'Вкажіть місто'
  if (!f.branch.trim()) errors.branch = 'Вкажіть номер відділення або поштомата'
  return errors
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: React.ReactNode
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className={`field${error ? ' field--error' : ''}`}>
      <span className="field__label">{label}</span>
      {children}
      {error ? <span className="field__error">{error}</span> : hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}

// Коди помилок бекенду → поле форми, яке треба підсвітити.
const FIELD_BY_CODE: Record<string, keyof OrderForm> = {
  'Order.FullNameRequired': 'name',
  'Order.InvalidPhone': 'phone',
  'Order.CityRequired': 'city',
  'Order.BranchRequired': 'branch',
}

interface Placed {
  name: string
  number: number
  total: number
}

function OrderPlaced({ name, number, total }: Placed) {
  return (
    <main id="main" className="container checkout checkout--done">
      <section className="done">
        <span className="done__icon"><CheckIcon size={32} /></span>
        <h1>Дякую, {name.split(' ')[0]}!</h1>
        <p>Замовлення №{number} на {formatPrice(total)} отримала. Підтверджу наявність і напишу протягом години.</p>
        <Link to="/catalog" className="btn btn--primary btn--block">Повернутися до каталогу</Link>
      </section>
    </main>
  )
}

/** «Куртку демісезонну вже замовили — я прибрала її з кошика.» */
function droppedNote(names: string[]) {
  return names.length === 1
    ? `«${names[0]}» вже хтось замовив — я прибрала її з кошика.`
    : `${names.map((n) => `«${n}»`).join(', ')} вже хтось замовив — я прибрала їх з кошика.`
}

export function CheckoutPage() {
  const cart = useCart()
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Errors>({})
  const [placed, setPlaced] = useState<Placed | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { minItems, percent } = SHOP.bulkDiscount
  const missing = Math.max(0, minItems - cart.count)

  const set = <K extends keyof OrderForm>(key: K, value: OrderForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const found = validate(form)
    setErrors(found)
    setSubmitError(null)
    if (Object.keys(found).length || submitting) return

    setSubmitting(true)
    try {
      const order = await placeOrder({
        fullName: form.name.trim(),
        phone: form.phone,
        city: form.city.trim(),
        branch: form.branch.trim(),
        payment: form.payment === 'cod' ? 'cash-on-delivery' : 'card',
        comment: form.comment.trim() || null,
        productIds: cart.items.map((p) => p.uid),
      })
      setPlaced({ name: form.name.trim(), number: order.number, total: order.total })
      cart.clear()
    } catch (err) {
      const field = err instanceof ApiError && err.code ? FIELD_BY_CODE[err.code] : undefined
      if (field) setErrors({ [field]: (err as ApiError).message })
      else setSubmitError(err instanceof ApiError ? err.message : 'Щось пішло не так. Спробуйте ще раз.')
      // Річ щойно забрали — кошик перечитає статуси й прибере її.
      if (err instanceof ApiError && err.status === 409) cart.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const header = (
    <MobileHeader backTo="/catalog" right={<span className="mobile-header__note">без реєстрації</span>}>
      <h1 className="mobile-header__title">Оформлення</h1>
    </MobileHeader>
  )

  if (placed)
    return (
      <>
        {header}
        <OrderPlaced {...placed} />
      </>
    )

  if (cart.loading)
    return (
      <>
        {header}
        <main id="main" className="container checkout" aria-busy="true" />
      </>
    )

  if (cart.count === 0)
    return (
      <>
        {header}
        <main id="main" className="container checkout checkout--done">
          <section className="done">
            <h1>Кошик порожній</h1>
            {cart.dropped.length > 0 ? (
              <p>{droppedNote(cart.dropped.map((p) => p.name))} Подивіться схожі в каталозі.</p>
            ) : (
              <p>Оберіть речі в каталозі — фільтр за зростом покаже лише те, що підійде.</p>
            )}
            <Link to="/catalog" className="btn btn--primary btn--block">До каталогу</Link>
          </section>
        </main>
      </>
    )

  return (
    <>
      {header}
      <main id="main" className="container checkout">
        <h1 className="checkout__title only-desktop">Оформлення замовлення <span>без реєстрації</span></h1>

        <form className="checkout__layout" onSubmit={submit} noValidate>
          <div className="checkout__main">
            <section className="cart" aria-labelledby="cart-h">
              <h2 id="cart-h">Ваші речі · {cart.count}</h2>
              {cart.dropped.length > 0 && (
                <p className="field__error" role="status">{droppedNote(cart.dropped.map((p) => p.name))}</p>
              )}
              {cart.items.map((p) => (
                <div key={p.id} className="cart-item">
                  <Link to={`/product/${p.id}`} className="cart-item__media">
                    {p.coverUrl ? (
                      <img src={p.coverUrl} alt="" className="media-photo" />
                    ) : (
                      <GarmentArt kind={artFor(p).garment} color={artFor(p).color} stitch={false} />
                    )}
                  </Link>
                  <div className="cart-item__body">
                    <Link to={`/product/${p.id}`} className="cart-item__name">{p.name}, {p.brand}</Link>
                    <span className="cart-item__meta">
                      {p.sizeNote ?? `${p.size} см`} · {CONDITIONS[p.condition].label} · арт. {p.sku}
                    </span>
                    <span className="price">{formatPrice(p.price)}</span>
                  </div>
                  <button type="button" className="icon-btn icon-btn--muted" aria-label={`Прибрати ${p.name}`} onClick={() => cart.remove(p.id)}>
                    <CloseIcon size={20} />
                  </button>
                </div>
              ))}
              {missing > 0 ? (
                <Link to="/catalog" className="promo">
                  <span>
                    <strong>Додайте ще {itemsCount(missing)} — і отримаєте −{percent}%</strong>
                    <span>Знижка на все замовлення, це −{formatPrice(Math.round((cart.subtotal * percent) / 100))}</span>
                  </span>
                  <ArrowRightIcon size={22} />
                </Link>
              ) : (
                <div className="promo promo--done">
                  <strong>Знижка −{percent}% застосована</strong>
                </div>
              )}
            </section>

            <fieldset className="form-group">
              <legend>Кому відправити</legend>
              <Field label="Ім’я та прізвище" error={errors.name}>
                <input type="text" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ірина Коваль" />
              </Field>
              <Field label="Телефон" error={errors.phone} hint="Зателефоную або напишу, щоб підтвердити">
                <input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
            </fieldset>

            <fieldset className="form-group">
              <legend>Нова Пошта</legend>
              <Field label="Місто" error={errors.city}>
                <input type="text" autoComplete="address-level2" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Київ" />
              </Field>
              <Field label="Відділення або поштомат" error={errors.branch}>
                <input type="text" value={form.branch} onChange={(e) => set('branch', e.target.value)} placeholder="№ 112, вул. Срібнокільська, 3" />
              </Field>
            </fieldset>

            <fieldset className="form-group form-group--tight">
              <legend>Оплата</legend>
              {([
                ['card', 'На карту', 'Реквізити надішлю після підтвердження. Без комісії.'],
                ['cod', 'Накладений платіж', 'Оплата при отриманні, комісія Нової Пошти — за тарифом.'],
              ] as const).map(([value, title, text]) => (
                <label key={value} className={`radio-card${form.payment === value ? ' is-checked' : ''}`}>
                  <input type="radio" name="payment" checked={form.payment === value} onChange={() => set('payment', value)} />
                  <span>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <Field label={<>Коментар <span className="field__optional">— необов’язково</span></>}>
              <textarea rows={3} value={form.comment} onChange={(e) => set('comment', e.target.value)} placeholder="Наприклад: зателефонуйте після 18:00" />
            </Field>
          </div>

          <aside className="checkout__aside">
            <section className="summary" aria-labelledby="sum-h">
              <h2 id="sum-h">Разом</h2>
              <div className="summary__row">
                <span>{itemsCount(cart.count)}</span>
                <span className="summary__strong">{formatPrice(cart.subtotal)}</span>
              </div>
              <div className="summary__row">
                <span>Знижка від {minItems} {plural(minItems, ['речі', 'речей', 'речей'])}</span>
                <span className={cart.discount ? 'summary__discount' : undefined}>
                  {cart.discount ? `−${formatPrice(cart.discount)}` : `ще ${itemsCount(missing)}`}
                </span>
              </div>
              <div className="summary__row">
                <span>Доставка</span>
                <span>за тарифом НП, ~70 грн</span>
              </div>
              <div className="summary__divider" />
              <div className="summary__total">
                <span>До сплати</span>
                <span className="price">{formatPrice(cart.total)}</span>
              </div>
              {submitError && <p className="field__error" role="alert">{submitError}</p>}
              <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={submitting}>
                {submitting ? 'Надсилаю…' : 'Оформити замовлення'}
              </button>
              <p className="summary__note">Нічого не списується зараз. Я підтверджу наявність і напишу протягом години.</p>
            </section>

            <section className="messenger-alt">
              <span>Зручніше в месенджері?</span>
              <div className="btn-pair">
                <a href={SHOP.viberUrl} className="btn btn--ghost">Viber</a>
                <a href={SHOP.telegramUrl} target="_blank" rel="noreferrer" className="btn btn--ghost">Telegram</a>
              </div>
            </section>
          </aside>
        </form>
      </main>
    </>
  )
}
