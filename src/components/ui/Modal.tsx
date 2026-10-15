import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from './Button'
import { cx } from './cx'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
let openCount = 0

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Tint of the header strip — matches the module the dialog belongs to. */
  tone?: 'sky' | 'sage' | 'peach' | 'lilac' | 'plain'
}

const tones = {
  sky: 'bg-sky',
  sage: 'bg-sage',
  peach: 'bg-peach',
  lilac: 'bg-lilac',
  plain: 'bg-card',
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md', tone = 'plain' }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    openCount++
    document.body.style.overflow = 'hidden'
    const node = ref.current
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>('input,select,textarea')
    ;(first ?? node)?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
      if (e.key === 'Tab' && node) {
        const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
        if (!items.length) return
        const [a, b] = [items[0], items[items.length - 1]]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          b.focus()
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    node?.addEventListener('keydown', onKey)
    return () => {
      node?.removeEventListener('keydown', onKey)
      openCount--
      if (openCount === 0) document.body.style.overflow = ''
      previous?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade bg-ink/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[26px] bg-card shadow-pop outline-none animate-sheet sm:animate-rise sm:rounded-panel',
          size === 'sm' ? 'sm:max-w-md' : size === 'md' ? 'sm:max-w-xl' : 'sm:max-w-3xl',
        )}
      >
        <div className={cx('flex items-start gap-3 px-5 pt-5 pb-4 sm:px-6', tones[tone])}>
          <div className="min-w-0 flex-1">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15 sm:hidden" aria-hidden />
            <h2 id={titleId} className="text-xl">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
          </div>
          <IconButton label="Cerrar" size="sm" onClick={onClose} className="-mr-1 mt-0.5 hover:bg-card/60">
            <X size={18} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 pt-3.5 pb-[max(env(safe-area-inset-bottom),14px)] sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
