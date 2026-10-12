import { useEffect, useRef, type ReactNode } from 'react'

interface ConfirmDialogProps {
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** Червона кнопка — для видалення й інших незворотних дій */
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Підтвердження з великими кнопками замість window.confirm: на телефоні системне вікно дрібне
 * й лякає, а тут видно, що саме станеться. Фокус одразу на «Скасувати» — випадкове Enter нічого не видалить.
 */
export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Скасувати', danger, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div className="a-dialog-backdrop" onClick={() => !busy && onCancel()}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="dialog-h" className="a-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 id="dialog-h">{title}</h2>
        <div className="a-dialog__text">{children}</div>
        <div className="a-dialog__actions">
          <button ref={cancel} type="button" className="a-btn a-btn--outline a-btn--lg" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={`a-btn a-btn--lg ${danger ? 'a-btn--danger' : 'a-btn--primary'}`} disabled={busy} onClick={onConfirm}>
            {busy ? 'Хвилинку…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
