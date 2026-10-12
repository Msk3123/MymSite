import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/http'
import { ArrowLeftIcon, SparkleIcon } from '../../components/Icons'
import { CATEGORIES, GENDERS, SEASONS, SIZES, sizeInfo, type Category, type Condition, type Gender, type Season } from '../../data/catalog'
import { formatPrice } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { adminApi, type AdminProduct, type ProductAction, type ProductInput, type ProductSuggestion } from '../api'
import { ConfirmDialog } from '../ConfirmDialog'
import { ErrorNote, ProductStatusBadge, useAdmin, useAssistantContext, useDataChanged } from '../ui'
import { shrinkForAi } from '../resizeImage'
import { PhotoSlots, slotPhoto, SLOTS, type Pending } from './PhotoSlots'

interface Form {
  name: string
  title: string
  brand: string
  gender: Gender
  category: Category
  season: Season
  condition: Condition
  sizeCm: string
  sizeNote: string
  price: string
  oldPrice: string
  description: string
  composition: string
  insulation: string
  fitNote: string
  defectNote: string
  seasonNote: string
  lotContents: string
  storageLocation: string
  measurements: { label: string; value: string; custom?: boolean }[]
}

type FieldKey = 'name' | 'sizeCm' | 'price' | 'oldPrice'
type Errors = Partial<Record<FieldKey, string>>

const CONDITION_CARDS: { key: Condition; title: string; hint: string; tone: string }[] = [
  { key: 'new', title: 'Нове з біркою', hint: 'Не носили, бірка на місці', tone: '#4e6b4a' },
  { key: 'like-new', title: 'Як нове', hint: 'Вдягали кілька разів, слідів немає', tone: '#9a4f4a' },
  { key: 'very-good', title: 'Дуже добрий', hint: 'Носили, але виглядає охайно', tone: '#7a5a2e' },
  { key: 'good', title: 'Добрий', hint: 'Є сліди носіння — обов’язково фото дефекту', tone: '#6b5f54' },
]

// Шапки міряють обхватом голови; зріст підставляємо, щоб працював фільтр каталогу.
const HEAD_SIZES: { label: string; cm: number }[] = [
  { label: '44–46', cm: 74 },
  { label: '46–48', cm: 86 },
  { label: '48–50', cm: 98 },
  { label: '50–52', cm: 110 },
  { label: '52–54', cm: 128 },
]

const MEASURE_PRESETS: Partial<Record<Category, string[]>> & { default: string[] } = {
  hats: ['Обхват', 'Висота'],
  pants: ['Довжина', 'По внутрішньому шву'],
  shoes: ['Устілка'],
  dresses: ['Довжина', 'Під пахвами'],
  default: ['Довжина', 'Під пахвами'],
}
const presetFor = (c: Category) => (MEASURE_PRESETS[c] ?? MEASURE_PRESETS.default).map((label) => ({ label, value: '' }))

const EMPTY: Form = {
  name: '', title: '', brand: '', gender: 'unisex', category: 'tops', season: 'all-season', condition: 'very-good',
  sizeCm: '', sizeNote: '', price: '', oldPrice: '', description: '', composition: '', insulation: '', fitNote: '',
  defectNote: '', seasonNote: '', lotContents: '', storageLocation: '', measurements: presetFor('tops'),
}

const FIELD_BY_CODE: Record<string, FieldKey> = {
  'Product.NameRequired': 'name',
  'Product.InvalidSize': 'sizeCm',
  'Product.InvalidPrice': 'price',
  'Product.InvalidOldPrice': 'oldPrice',
}

const fromProduct = (p: AdminProduct): Form => {
  const presets = presetFor(p.category)
  const saved = p.measurements.map((m) => ({ label: m.label, value: String(m.valueCm), custom: !presets.some((x) => x.label === m.label) }))
  return {
    name: p.name, title: p.title === p.name ? '' : p.title, brand: p.brand, gender: p.gender, category: p.category,
    season: p.season, condition: p.condition, sizeCm: String(p.sizeCm), sizeNote: p.sizeNote ?? '', price: String(p.price),
    oldPrice: p.oldPrice ? String(p.oldPrice) : '', description: p.description, composition: p.composition ?? '',
    insulation: p.insulation ?? '', fitNote: p.fitNote ?? '', defectNote: p.defectNote ?? '', seasonNote: p.seasonNote ?? '',
    lotContents: p.lotContents ?? '', storageLocation: p.storageLocation ?? '',
    measurements: [...presets.filter((x) => !saved.some((m) => m.label === x.label)), ...saved],
  }
}

const orNull = (s: string) => (s.trim() ? s.trim() : null)
const toNumber = (s: string) => Number(s.replace(',', '.').replace(/\s/g, ''))

const toInput = (f: Form): ProductInput => ({
  name: f.name.trim(), title: orNull(f.title), brand: orNull(f.brand), gender: f.gender, category: f.category,
  season: f.season, condition: f.condition, sizeCm: toNumber(f.sizeCm), price: toNumber(f.price),
  oldPrice: f.oldPrice.trim() ? toNumber(f.oldPrice) : null, description: orNull(f.description), sizeNote: orNull(f.sizeNote),
  seasonNote: orNull(f.seasonNote), composition: orNull(f.composition), insulation: orNull(f.insulation),
  fitNote: orNull(f.fitNote), defectNote: orNull(f.defectNote), lotContents: orNull(f.lotContents),
  storageLocation: orNull(f.storageLocation),
  measurements: f.measurements
    .filter((m) => m.label.trim() && toNumber(m.value) > 0)
    .map((m) => ({ label: m.label.trim(), shortLabel: null, valueCm: Math.round(toNumber(m.value)) })),
})

function validate(f: Form): Errors {
  const e: Errors = {}
  if (!f.name.trim()) e.name = 'Напишіть, що це за річ: «Куртка демісезонна»'
  const size = toNumber(f.sizeCm)
  if (!(size >= 44 && size <= 176)) e.sizeCm = 'Оберіть розмір'
  const price = toNumber(f.price)
  if (!(price > 0)) e.price = 'Вкажіть ціну'
  if (f.oldPrice.trim() && !(toNumber(f.oldPrice) > price)) e.oldPrice = 'Має бути більшою за вашу ціну'
  return e
}

/** Поле, яке помічник не зміг визначити з фото, — кажемо людською мовою, що робити. */
function Unknown({ show }: { show: boolean }) {
  return show ? <span className="a-field__unknown">Помічник не зміг визначити з фото — впишіть самі</span> : null
}

/** Позначка біля поля: звідки взялося значення після «Заповнити з фото». */
type Source = 'photo' | 'check'

function Label({ text, source, optional }: { text: string; source?: Source; optional?: boolean }) {
  return (
    <span className="a-field__label">
      {text}
      {optional && <span className="a-muted"> — необов’язково</span>}
      {source && <span className={`a-source a-source--${source}`}>{source === 'photo' ? 'з фото' : 'перевірте'}</span>}
    </span>
  )
}

export function ProductEditPage() {
  const { id = 'new' } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshSummary } = useAdmin()

  const [product, setProduct] = useState<AdminProduct | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saved, setSaved] = useState<Form>(EMPTY)
  const [pending, setPending] = useState<Pending>({})
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sources, setSources] = useState<Partial<Record<string, Source>>>({})
  const [conditionNote, setConditionNote] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: assistant } = useAsync('assistant-status', adminApi.assistantEnabled)
  const { data: hint } = useAsync(`hint:${form.category}`, () => adminApi.priceHint(form.category))

  useAssistantContext(isNew ? 'нова річ (ще не збережена)' : product ? `річ ${product.sku} · ${product.name}` : 'річ')

  useEffect(() => {
    setSources({})
    setConditionNote(null)
    // Після створення ми переходимо на /products/{id} — компонент той самий, тож повідомлення беремо з навігації тут.
    setNotice((location.state as { notice?: string } | null)?.notice ?? null)
    if (isNew) {
      setProduct(null)
      setForm(EMPTY)
      setSaved(EMPTY)
      setPending({})
      return
    }
    let alive = true
    adminApi.product(id).then(
      (p) => {
        if (!alive) return
        setProduct(p)
        setForm(fromProduct(p))
        setSaved(fromProduct(p))
      },
      (err) => alive && setError(err),
    )
    return () => {
      alive = false
    }
    // location.state читаємо лише при зміні речі
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew])

  const dirty = isNew || JSON.stringify(form) !== JSON.stringify(saved)

  // Помічник у режимі дій змінив цю річ (ціну, опис…) — підтягуємо, якщо мама нічого не редагує.
  useDataChanged(
    useCallback(() => {
      if (isNew || dirty) return
      adminApi.product(id).then(
        (p) => {
          setProduct(p)
          setForm(fromProduct(p))
          setSaved(fromProduct(p))
        },
        // Річ видалили — повертаємось до списку.
        () => navigate('/admin/products', { replace: true }),
      )
    }, [id, isNew, dirty, navigate]),
  )

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }))
    // Мама виправила поле — позначка «перевірте» більше не потрібна.
    setSources((s) => (s[key] === 'check' ? { ...s, [key]: undefined } : s))
    setNotice(null)
  }

  const setCategory = (category: Category) => {
    setForm((f) => ({
      ...f,
      category,
      // Порожні заміри підлаштовуємо під категорію: у шапки — обхват, у штанів — шов.
      measurements: f.measurements.every((m) => !m.value.trim()) ? presetFor(category) : f.measurements,
      sizeNote: category !== 'hats' && HEAD_SIZES.some((h) => `${h.label} см` === f.sizeNote) ? '' : f.sizeNote,
    }))
    setSources((s) => ({ ...s, category: undefined }))
  }

  // ---------- Заповнити з фото ----------
  const photoCount = (product?.photos.length ?? 0) + SLOTS.filter((s) => pending[s.key]).length + (pending.extra?.length ?? 0)
  const canDescribe = assistant?.enabled && photoCount > 0

  const describe = async () => {
    setBusy('ai')
    setError(null)
    try {
      // Беремо фото зі слотів (бірка — окремо, її модель роздивиться крупно).
      const photos: Blob[] = []
      let tagIndex: number | null = null
      for (const slot of SLOTS) {
        const local = pending[slot.key]?.blob
        const remote = slotPhoto(product, slot.label)
        const blob = local ?? (remote ? await (await fetch(remote.url)).blob() : null)
        if (!blob) continue
        if (slot.key === 'tag') tagIndex = photos.length
        photos.push(await shrinkForAi(blob, slot.key === 'tag'))
      }
      // Слоти порожні, але є інші фото — беремо перше; бірка може бути на ньому, тож дивимось крупно.
      const fallback = photos.length === 0
        ? (product?.photos[0] ? await (await fetch(product.photos[0].url)).blob() : pending.extra?.[0]?.blob)
        : undefined
      if (fallback) {
        tagIndex = 0
        photos.push(await shrinkForAi(fallback, true))
      }

      const s = await adminApi.describe(photos.slice(0, 4), tagIndex)
      applySuggestion(s)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  const applySuggestion = (s: ProductSuggestion) => {
    const uncertain = new Set(s.uncertain)
    const mark = (field: string, present: boolean): Source | undefined =>
      uncertain.has(field) ? 'check' : present ? 'photo' : undefined
    setForm((f) => ({
      ...f,
      // Чого помічник не визначив — лишаємо як було, а не порожнім чи «null».
      name: s.name || f.name,
      brand: s.brand ?? f.brand,
      gender: s.gender,
      category: s.category,
      season: s.season,
      condition: s.condition,
      sizeCm: s.sizeCm ? String(s.sizeCm) : f.sizeCm,
      sizeNote: s.sizeNote ?? f.sizeNote,
      composition: s.composition ?? f.composition,
      insulation: s.insulation ?? f.insulation,
      description: s.description || f.description,
      defectNote: s.defectNote ?? f.defectNote,
      // Ціна й місце — за маминими правилами з пам'яті помічника, лише якщо вона ще не вписала свої.
      price: f.price.trim() || !s.price ? f.price : String(s.price),
      storageLocation: f.storageLocation.trim() || !s.storageLocation ? f.storageLocation : s.storageLocation,
      measurements: f.measurements.every((m) => !m.value.trim()) ? presetFor(s.category) : f.measurements,
    }))
    setSources({
      name: mark('name', true),
      brand: mark('brand', !!s.brand),
      gender: uncertain.has('gender') ? 'check' : 'photo',
      category: mark('category', true),
      season: mark('season', true),
      condition: s.conditionNote || uncertain.has('condition') ? 'check' : 'photo',
      sizeCm: mark('sizeCm', !!s.sizeCm),
      composition: mark('composition', !!s.composition),
      description: 'photo',
    })
    setConditionNote(s.conditionNote)
    setErrors({})
    setNotice(null)
  }

  // ---------- Збереження ----------
  const save = async (publish: boolean) => {
    const found = validate(form)
    setErrors(found)
    setError(null)
    if (Object.values(found).some(Boolean)) {
      document.querySelector('.a-field--error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setBusy(publish ? 'publish' : 'save')
    try {
      let current: AdminProduct
      if (isNew) {
        current = await adminApi.createProduct(toInput(form))
        // Фото слотів — по черзі: «Вигляд» першим, щоб він став головним.
        for (const slot of SLOTS) {
          const p = pending[slot.key]
          if (p) current = await adminApi.uploadPhoto(current.id, p.blob, { caption: slot.label, isDefect: slot.key === 'defect' })
        }
        for (const p of pending.extra ?? []) current = await adminApi.uploadPhoto(current.id, p.blob)
      } else {
        current = dirty ? await adminApi.updateProduct(id, toInput(form)) : product!
      }
      if (publish && current.status === 'draft') current = await adminApi.productStatus(current.id, 'publish')
      refreshSummary()

      const message = publish ? 'Готово! Річ уже на сайті.' : isNew ? 'Чернетку збережено. На сайті її ще не видно.' : 'Зміни збережено.'
      if (isNew) {
        navigate(`/admin/products/${current.id}`, { replace: true, state: { notice: message } })
      } else {
        setProduct(current)
        setForm(fromProduct(current))
        setSaved(fromProduct(current))
        setSources({})
        setNotice(message)
      }
    } catch (err) {
      const field = err instanceof ApiError && err.code ? FIELD_BY_CODE[err.code] : undefined
      if (field) setErrors({ [field]: (err as ApiError).message })
      else setError(err)
    } finally {
      setBusy(null)
    }
  }

  const changeStatus = async (action: ProductAction, question?: string) => {
    if (!product || (question && !window.confirm(question))) return
    setBusy(action)
    setError(null)
    try {
      setProduct(await adminApi.productStatus(product.id, action))
      refreshSummary()
      setNotice(action === 'publish' ? 'Готово! Річ уже на сайті.' : action === 'unpublish' ? 'Річ прибрано з сайту.' : 'Позначено як продане.')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!product) return
    setBusy('delete')
    try {
      await adminApi.deleteProduct(product.id)
      refreshSummary()
      navigate('/admin/products', { replace: true, state: { notice: `«${product.name}» видалено.` } })
    } catch (err) {
      setError(err)
      setBusy(null)
      setConfirmDelete(false)
    }
  }

  if (!isNew && !product) return <div className="a-page"><ErrorNote error={error} /></div>

  const sizeNum = toNumber(form.sizeCm)
  const age = sizeInfo(sizeNum)?.ageLong
  const isHat = form.category === 'hats'
  const headLabel = (h: (typeof HEAD_SIZES)[number]) => `${h.label} см`

  return (
    <div className="a-page a-edit">
      <header className="a-edit__head">
        <Link to="/admin/products" className="a-icon-btn" aria-label="Назад до речей"><ArrowLeftIcon /></Link>
        <div>
          <h1>{isNew ? 'Нова річ' : product!.name}</h1>
          <small className={product ? 'a-ok' : 'a-muted'}>
            {product ? `арт. ${product.sku} · ${dirty ? 'є незбережені зміни' : product.status === 'draft' ? 'чернетка збережена' : 'збережено'}` : 'артикул з’явиться після збереження'}
          </small>
        </div>
        {product && <ProductStatusBadge status={product.status} />}
      </header>

      {notice && <p className="a-notice" role="status">{notice}</p>}

      <PhotoSlots product={product} onProduct={setProduct} pending={pending} onPending={setPending} />

      {canDescribe && (
        <div className={`a-ai-fill${Object.keys(sources).length ? ' is-done' : ''}`}>
          <span className="ai-mark"><SparkleIcon size={18} /></span>
          {Object.values(sources).some(Boolean) ? (
            <div>
              <b>Заповнила з фото — перевірте</b>
              <span>З бірки прочитала бренд, розмір і склад. Поля, у яких я не впевнена, позначені жовтим.</span>
            </div>
          ) : (
            <div>
              <b>Помічник заповнить картку з фото</b>
              <span>Прочитає бірку, вгадає категорію й стан, напише опис. Ви лише перевірите.</span>
            </div>
          )}
          <button type="button" className="a-btn a-btn--dark" disabled={!!busy} onClick={describe}>
            {busy === 'ai' ? 'Дивлюсь на фото…' : Object.values(sources).some(Boolean) ? 'Ще раз' : 'Заповнити з фото'}
          </button>
        </div>
      )}

      <form className="a-form" onSubmit={(e) => { e.preventDefault(); save(false) }} noValidate>
        <label className={`a-field${errors.name ? ' a-field--error' : ''}${sources.name === 'check' ? ' a-field--check' : ''}`}>
          <Label text="Назва" source={sources.name} />
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Шапка в’язана з помпоном" />
          {errors.name ? <span className="a-field__error">{errors.name}</span> : <Unknown show={sources.name === 'check' && !form.name.trim()} />}
        </label>

        <fieldset className={`a-field${sources.gender === 'check' ? ' a-field--check' : ''}`}>
          <legend><Label text="Для кого" source={sources.gender} /></legend>
          <div className="a-segmented">
            {(Object.keys(GENDERS) as Gender[]).map((g) => (
              <button key={g} type="button" aria-pressed={form.gender === g} onClick={() => set('gender', g)}>{GENDERS[g].label}</button>
            ))}
          </div>
        </fieldset>

        <fieldset className={`a-field${sources.category === 'check' ? ' a-field--check' : ''}`}>
          <legend><Label text="Категорія" source={sources.category} /></legend>
          <div className="a-chips">
            {(Object.keys(CATEGORIES) as Category[]).map((c) => (
              <button key={c} type="button" className="a-chip" aria-pressed={form.category === c} onClick={() => setCategory(c)}>
                {CATEGORIES[c].replace(' і світшоти', '')}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={`a-field${errors.sizeCm ? ' a-field--error' : ''}${sources.sizeCm === 'check' ? ' a-field--check' : ''}`}>
          <legend>
            <Label text={isHat ? 'Розмір — обхват голови або зріст, см' : 'Розмір — зріст дитини, см'} source={sources.sizeCm} />
          </legend>
          <div className="a-chips">
            {isHat && HEAD_SIZES.map((h) => (
              <button key={h.label} type="button" className="a-chip a-chip--size" aria-pressed={form.sizeNote === headLabel(h)}
                onClick={() => { set('sizeNote', headLabel(h)); set('sizeCm', String(h.cm)) }}>
                {h.label}
              </button>
            ))}
            {SIZES.map((s) => (
              <button key={s.cm} type="button" className="a-chip a-chip--size"
                aria-pressed={form.sizeCm === String(s.cm) && !(isHat && HEAD_SIZES.some((h) => headLabel(h) === form.sizeNote))}
                onClick={() => {
                  set('sizeCm', String(s.cm))
                  if (HEAD_SIZES.some((h) => headLabel(h) === form.sizeNote)) set('sizeNote', '')
                }}>
                {s.cm}
              </button>
            ))}
            <input className="a-chip-input" inputMode="numeric" placeholder="інший" aria-label="Інший зріст, см"
              value={SIZES.some((s) => String(s.cm) === form.sizeCm) ? '' : form.sizeCm}
              onChange={(e) => set('sizeCm', e.target.value.replace(/\D/g, ''))} />
          </div>
          {errors.sizeCm ? <span className="a-field__error">{errors.sizeCm}</span>
            : sources.sizeCm === 'check' && !form.sizeCm ? <Unknown show />
            : <span className="a-muted">{age ? `Вік підставиться автоматично: ${age}` : 'Вік підставиться автоматично'}{form.sizeNote && ` · на бірці: ${form.sizeNote}`}</span>}
        </fieldset>

        {(form.category === 'shoes' || (form.sizeNote && !isHat)) && (
          <label className="a-field">
            <Label text="Розмір на бірці" optional />
            <input value={form.sizeNote} onChange={(e) => set('sizeNote', e.target.value)} placeholder={form.category === 'shoes' ? 'р. 26' : '98/104'} />
          </label>
        )}

        <fieldset className={`a-field${sources.condition === 'check' ? ' a-field--check' : ''}`}>
          <legend><Label text="Стан" source={sources.condition} /></legend>
          {conditionNote && (
            <div className="a-cond-note">
              <b>Перевірте стан</b>
              <span>{conditionNote}</span>
            </div>
          )}
          <div className="a-conds">
            {CONDITION_CARDS.map((c) => (
              <button key={c.key} type="button" className="a-cond" aria-pressed={form.condition === c.key} style={{ ['--tone' as string]: c.tone }}
                onClick={() => { set('condition', c.key); setConditionNote(null) }}>
                <b>{c.title}</b>
                <span>{c.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="a-field">
          <Label text="Опис — як розповіли б подрузі" source={sources.description} />
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)}
            placeholder="Нова, з біркою. Тепла, на флісовій підкладці, помпон тримається міцно." />
        </label>

        <div className="a-form__row">
          <label className={`a-field${sources.brand === 'check' ? ' a-field--check' : ''}`}>
            <Label text="Бренд" source={sources.brand} />
            <input value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="H&M" />
            <Unknown show={sources.brand === 'check' && !form.brand.trim()} />
          </label>
          <label className={`a-field${sources.season === 'check' ? ' a-field--check' : ''}`}>
            <Label text="Сезон" source={sources.season} />
            <select value={form.season} onChange={(e) => set('season', e.target.value as Season)}>
              {(Object.keys(SEASONS) as Season[]).map((s) => <option key={s} value={s}>{SEASONS[s]}</option>)}
            </select>
          </label>
        </div>

        <label className={`a-field${sources.composition === 'check' ? ' a-field--check' : ''}`}>
          <Label text="Склад" source={sources.composition} optional={!sources.composition} />
          <input value={form.composition} onChange={(e) => set('composition', e.target.value)} placeholder="Верх 100% акрил, підкладка — фліс" />
          <Unknown show={sources.composition === 'check' && !form.composition.trim()} />
        </label>

        <fieldset className="a-field">
          <legend><Label text="Заміри, см" optional /></legend>
          <div className="a-measures">
            {form.measurements.map((m, i) => (
              <label key={i} className="a-measure">
                {m.custom ? (
                  <input className="a-measure__name" aria-label="Що міряли" placeholder="Що міряли" value={m.label}
                    onChange={(e) => set('measurements', form.measurements.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                ) : (
                  <span>{m.label}</span>
                )}
                <input inputMode="numeric" value={m.value} aria-label={m.label || 'Сантиметрів'}
                  onChange={(e) => set('measurements', form.measurements.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              </label>
            ))}
          </div>
          <button type="button" className="a-link-btn"
            onClick={() => set('measurements', [...form.measurements, { label: '', value: '', custom: true }])}>+ ще замір</button>
        </fieldset>

        <fieldset className="a-field">
          <legend><span className="a-field__label">Ціна</span></legend>
          <div className="a-form__row">
            <label className={`a-field${errors.price ? ' a-field--error' : ''}`}>
              <span className="a-muted">Моя ціна, грн</span>
              <input className="a-input-strong" inputMode="numeric" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="180" />
              {errors.price && <span className="a-field__error">{errors.price}</span>}
            </label>
            <label className={`a-field${errors.oldPrice ? ' a-field--error' : ''}`}>
              <span className="a-muted">Ціна в магазині</span>
              <input inputMode="numeric" value={form.oldPrice} onChange={(e) => set('oldPrice', e.target.value)} placeholder="необов’язково" />
              {errors.oldPrice && <span className="a-field__error">{errors.oldPrice}</span>}
            </label>
          </div>
          {hint?.hint && (
            <span className="a-muted">
              Схожі речі ({CATEGORIES[form.category].toLowerCase()}) у вас {hint.hint.soldCount >= 2 ? 'продавались' : 'коштують'} за{' '}
              {hint.hint.min === hint.hint.max ? formatPrice(hint.hint.min) : `${hint.hint.min}–${formatPrice(hint.hint.max)}`}
            </span>
          )}
        </fieldset>

        <label className="a-field">
          <Label text="Де лежить" />
          <span className="a-muted">— бачите тільки ви</span>
          <input value={form.storageLocation} onChange={(e) => set('storageLocation', e.target.value)} placeholder="Коробка 2" />
        </label>

        <details className="a-more" open={!!(form.insulation || form.defectNote || form.fitNote || form.seasonNote || form.lotContents)}>
          <summary>Додатково: дефект, утеплювач, посадка</summary>
          <label className="a-field">
            <Label text="Дефект" optional />
            <input value={form.defectNote} onChange={(e) => set('defectNote', e.target.value)} placeholder="Потертість ~1 см на лівому манжеті" />
          </label>
          <label className="a-field">
            <Label text="Утеплювач" optional />
            <input value={form.insulation} onChange={(e) => set('insulation', e.target.value)} placeholder="Синтепух, 250 г" />
          </label>
          <label className="a-field">
            <Label text="Як сідає" optional />
            <input value={form.fitNote} onChange={(e) => set('fitNote', e.target.value)} placeholder="Сідає трохи більше" />
          </label>
          <label className="a-field">
            <Label text="Сезон докладніше" optional />
            <input value={form.seasonNote} onChange={(e) => set('seasonNote', e.target.value)} placeholder="Осінь, весна · від +5 до +15 °C" />
          </label>
          {form.category === 'lots' && (
            <label className="a-field">
              <Label text="Що в комплекті" />
              <input value={form.lotContents} onChange={(e) => set('lotContents', e.target.value)} placeholder="Комбінезон, 2 шапки, 2 боді — 5 речей" />
            </label>
          )}
          {!isNew && (
            <label className="a-field">
              <Label text="Повна назва" optional />
              <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Куртка демісезонна з капюшоном" />
            </label>
          )}
        </details>

        <ErrorNote error={error} />

        {product && product.status !== 'draft' && (
          <section className="a-status" aria-labelledby="status-h">
            <h2 id="status-h" className="a-h3">На сайті</h2>
            {product.status === 'available' && (
              <div className="a-status__row">
                <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer" className="a-btn a-btn--outline">Подивитися на сайті ↗</a>
                <button type="button" className="a-btn a-btn--outline" disabled={!!busy || dirty}
                  onClick={() => changeStatus('mark-sold', 'Позначити як продане? Річ зникне з продажу.')}>Продано (продала сама)</button>
                <button type="button" className="a-btn a-btn--outline" disabled={!!busy || dirty} onClick={() => changeStatus('unpublish')}>Сховати з сайту</button>
              </div>
            )}
            {product.status === 'reserved' && <p className="a-muted">Річ у замовленні. Керуйте нею в розділі «Замовлення».</p>}
            {product.status === 'sold' && <p className="a-muted">Річ продана. На сайті вона показується з позначкою «Продано».</p>}
            {dirty && product.status === 'available' && <p className="a-warn">Спершу збережіть зміни.</p>}
          </section>
        )}
        {product && (
          <section className="a-danger-zone" aria-label="Видалення">
            {product.status === 'reserved' ? (
              <p className="a-muted">Річ зараз у замовленні — її можна буде видалити, коли замовлення завершиться або ви його скасуєте.</p>
            ) : (
              <button type="button" className="a-btn a-btn--outline a-btn--delete" disabled={!!busy} onClick={() => setConfirmDelete(true)}>
                Видалити річ
              </button>
            )}
          </section>
        )}
        {product && confirmDelete && (
          <ConfirmDialog
            title="Видалити річ?"
            confirmLabel="Так, видалити"
            danger
            busy={busy === 'delete'}
            onConfirm={remove}
            onCancel={() => setConfirmDelete(false)}
          >
            <p>«<b>{product.name}</b>» ({product.sku}) зникне з сайту й з «Моїх речей», фото буде стерто.</p>
            <p>Повернути її не вийде. Якщо річ треба лише прибрати на час — краще «Сховати з сайту».</p>
          </ConfirmDialog>
        )}

        <div className="a-savebar">
          {(isNew || product?.status === 'draft') ? (
            <>
              <button type="submit" className="a-btn a-btn--outline a-btn--lg" disabled={!!busy || !dirty}>
                {busy === 'save' ? 'Зберігаю…' : 'Чернетка'}
              </button>
              <button type="button" className="a-btn a-btn--primary a-btn--lg a-btn--grow" disabled={!!busy} onClick={() => save(true)}>
                {busy === 'publish' ? 'Публікую…' : 'Опублікувати на сайті'}
              </button>
            </>
          ) : (
            <button type="submit" className="a-btn a-btn--primary a-btn--lg a-btn--grow" disabled={!!busy || !dirty}>
              {busy === 'save' ? 'Зберігаю…' : dirty ? 'Зберегти зміни' : 'Усе збережено'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
