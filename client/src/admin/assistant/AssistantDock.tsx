import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { EyeIcon, ExpandIcon, MinusIcon, SparkleIcon } from '../../components/Icons'
import { useAdmin } from '../ui'
import { ActionModeSwitch, AssistantInput, AssistantLog } from './AssistantChat'
import { useAssistantChat } from './useAssistantChat'

/** Підказки залежать від того, що відкрито. */
function hintsFor(path: string) {
  if (/^\/admin\/orders\/\d+/.test(path)) return ['Де лежать ці речі?', 'Що вона купувала раніше?', 'Як відправити?']
  if (path.startsWith('/admin/orders')) return ['Що треба відправити?', 'Скільки нових замовлень?']
  if (/^\/admin\/products\/.+/.test(path)) return ['Як поставити фото?', 'Яку ціну поставити?', 'Як написати опис?']
  if (path.startsWith('/admin/products')) return ['Що не продається?', 'Що в чернетках?', 'Як додати річ?']
  return ['Що робити першим?', 'Скільки заробила цього місяця?', 'Що не продається?']
}

export function AssistantDock() {
  const { assistantContext, refreshSummary } = useAdmin()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const chat = useAssistantChat(assistantContext, refreshSummary)

  return (
    <div className={`ai-dock${open ? ' is-open' : ''}`}>
      {open && (
        <section className="ai-dock__panel" aria-label="Помічник">
          <header className="ai-dock__head">
            <span className="ai-mark"><SparkleIcon size={18} /></span>
            <span className="ai-dock__title">Помічник</span>
            <Link to="/admin/assistant" className="ai-dock__icon" aria-label="Відкрити на весь екран" onClick={() => setOpen(false)}>
              <ExpandIcon />
            </Link>
            <button type="button" className="ai-dock__icon" aria-label="Згорнути помічника" onClick={() => setOpen(false)}>
              <MinusIcon />
            </button>
          </header>
          <div className="ai-dock__ctx">
            <EyeIcon />
            <span>Бачу: <b>{assistantContext}</b></span>
            <ActionModeSwitch compact />
          </div>
          <div className="ai-dock__body">
            <AssistantLog
              messages={chat.messages}
              busy={chat.busy}
              onDecide={chat.decide}
              intro={<div className="ai-bubble ai-bubble--assistant">Питайте простими словами — я бачу замовлення й речі і знаю, як тут усе влаштовано.</div>}
            />
          </div>
          <AssistantInput hints={hintsFor(pathname)} busy={chat.busy} onAsk={chat.ask} />
        </section>
      )}
      <button type="button" className="ai-fab" aria-expanded={open} aria-label={open ? 'Сховати помічника' : 'Відкрити помічника'}
        onClick={() => setOpen((o) => !o)}>
        <SparkleIcon size={20} />
        {open ? 'Сховати' : 'Помічник'}
      </button>
    </div>
  )
}
