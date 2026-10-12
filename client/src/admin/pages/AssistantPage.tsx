import { Link, useNavigate } from 'react-router-dom'
import { CameraIcon, SparkleIcon } from '../../components/Icons'
import { formatPrice, plural } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { adminApi } from '../api'
import { AssistantInput, AssistantLog } from '../assistant/AssistantChat'
import { useAssistantChat } from '../assistant/useAssistantChat'
import { greeting, useAdmin, useAssistantContext } from '../ui'

const HINTS = ['Що не продається?', 'Скільки заробила цього місяця?', 'Що треба відправити?', 'Як додати річ?', 'Де лежить куртка на 98?']

const orders = (n: number) => `${n} ${plural(n, ['нове замовлення', 'нові замовлення', 'нових замовлень'])}`

/** Перше повідомлення: що сталося, поки мами не було. Рахується з даних, без ШІ, — безкоштовно. */
function Briefing() {
  const { me, summary: s } = useAdmin()
  if (!s) return null
  const lines: React.ReactNode[] = []
  if (s.newOrders) lines.push(<>{orders(s.newOrders)} — <Link to="/admin/orders?status=new">відкрити</Link></>)
  if (s.confirmedOrders) lines.push(<>{s.confirmedOrders} {plural(s.confirmedOrders, ['замовлення чекає', 'замовлення чекають', 'замовлень чекають'])} відправки — <Link to="/admin/orders?status=confirmed">внести ТТН</Link></>)
  if (s.drafts) lines.push(<>{s.drafts} {plural(s.drafts, ['річ', 'речі', 'речей'])} у чернетках — <Link to="/admin/products?status=draft">опублікувати</Link></>)
  if (s.staleItems.length) lines.push(<>{s.staleItems.length} {plural(s.staleItems.length, ['річ', 'речі', 'речей'])} довго не продаються — спитайте мене, що з ними зробити</>)
  if (s.ordersThisMonth) lines.push(<>цього місяця вже {formatPrice(s.revenueThisMonth)}</>)

  return (
    <div className="ai-brief">
      <b>{greeting(me.greetingName)}. {lines.length ? 'Ось що зараз:' : 'Усе спокійно — нових справ немає.'}</b>
      {lines.length > 0 && <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  )
}

export function AssistantPage() {
  const navigate = useNavigate()
  const { assistantContext } = useAdmin()
  useAssistantContext('сторінка помічника')
  const { data: status } = useAsync('assistant-status', adminApi.assistantEnabled)
  const chat = useAssistantChat(assistantContext)

  return (
    <div className="a-page a-page--wide ai-page">
      <div className="ai-page__main">
        <header className="ai-page__head">
          <span className="ai-mark ai-mark--lg"><SparkleIcon size={22} /></span>
          <div>
            <h1 className="a-title">Помічник</h1>
            <span className="a-muted">Підказує й відповідає. Змінюєте все ви.</span>
          </div>
          {chat.messages.length > 0 && (
            <button type="button" className="a-link-btn" disabled={chat.busy} onClick={chat.reset}>Почати заново</button>
          )}
        </header>

        {status && !status.enabled ? (
          <div className="a-panel">
            <b>Помічник ще не підключений.</b>
            <span className="a-muted">Для сина: задайте ключ OpenAI — <code>dotnet user-secrets set "OpenAI:ApiKey" "sk-…"</code> (див. README).</span>
          </div>
        ) : (
          <>
            <div className="ai-page__log">
              <Briefing />
              <AssistantLog messages={chat.messages} busy={chat.busy} />
            </div>
            <AssistantInput large hints={HINTS} busy={chat.busy} onAsk={chat.ask} placeholder="Запитайте або попросіть щось зробити…"
              before={
                <button type="button" className="ai-input__mic" aria-label="Нова річ з фото — помічник заповнить картку"
                  title="Нова річ з фото" onClick={() => navigate('/admin/products/new')}>
                  <CameraIcon />
                </button>
              } />
          </>
        )}
      </div>

      <aside className="ai-page__side">
        <section className="a-panel">
          <h2 className="a-h3">Що я вмію</h2>
          <ul className="ai-list">
            <li>Скажу, що нового: замовлення, що відправити, скільки заробили</li>
            <li>Знайду річ і скажу, де вона лежить</li>
            <li>Підкажу, що робити з речами, які не продаються</li>
            <li>Поясню, як тут усе працює: фото, ціна, відправка</li>
            <li>Заповню картку речі з фото — кнопка з камерою</li>
          </ul>
        </section>
        <section className="a-panel a-panel--green">
          <h2 className="a-h3">Помічник ніколи сам не:</h2>
          <ul className="ai-list ai-list--dash">
            <li>надсилає повідомлення покупцям</li>
            <li>змінює ціни і не видаляє речі</li>
            <li>бачить телефони покупців</li>
          </ul>
          <small className="a-muted">Повідомлень із Viber і Telegram я поки не бачу.</small>
        </section>
      </aside>
    </div>
  )
}
