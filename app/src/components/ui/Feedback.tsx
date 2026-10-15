import { useEffect } from 'react'
import { Award, CircleAlert, Sparkles, X } from 'lucide-react'
import { dismissToast, useUI } from '../../store/ui'
import { Button } from './Button'
import { Modal } from './Modal'
import { cx } from './cx'

export function Toaster() {
  const toasts = useUI((s) => s.toasts)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cx(
            'pointer-events-auto flex max-w-sm animate-rise items-center gap-3 rounded-[14px] py-2.5 pr-2 pl-3.5 text-sm shadow-pop',
            t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-paper',
          )}
        >
          {t.tone === 'points' && <Sparkles size={16} className="shrink-0 text-lilac-mid" aria-hidden />}
          {t.tone === 'error' && <CircleAlert size={16} className="shrink-0" aria-hidden />}
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="rounded-lg px-2 py-1 font-semibold text-sky hover:bg-white/10"
              onClick={() => {
                t.action!.run()
                dismissToast(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" aria-label="Cerrar aviso" className="rounded-full p-1 opacity-60 hover:opacity-100" onClick={() => dismissToast(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function ConfirmHost() {
  const req = useUI((s) => s.confirm)
  if (!req) return null
  const close = (ok: boolean | 'alt') => {
    req.resolve(ok)
    useUI.setState({ confirm: null })
  }
  return (
    <Modal
      open
      size="sm"
      title={req.title}
      onClose={() => close(false)}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancelar
          </Button>
          {req.altLabel && <Button onClick={() => close('alt')}>{req.altLabel}</Button>}
          <Button variant={req.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus>
            {req.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[15px] text-ink-2">{req.body ?? 'Esta acción no se puede deshacer.'}</p>
    </Modal>
  )
}

/** Achievement unlock: a small card with a burst of tally strokes. Respects reduced motion via global CSS. */
export function Celebration() {
  const c = useUI((s) => s.celebration)
  useEffect(() => {
    if (!c) return
    const t = setTimeout(() => useUI.setState({ celebration: null }), 4200)
    return () => clearTimeout(t)
  }, [c])
  if (!c) return null
  const strokes = Array.from({ length: 14 }, (_, i) => i)
  const colors = ['var(--color-sage-mid)', 'var(--color-sky-mid)', 'var(--color-lilac-mid)', 'var(--color-peach-mid)']
  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[70] flex justify-center px-4" role="status" aria-live="polite">
      <div className="pointer-events-auto relative flex max-w-sm animate-pop items-center gap-3 rounded-[20px] border border-lilac-mid/50 bg-card p-3 pr-4 shadow-pop">
        <div className="relative grid size-12 shrink-0 place-items-center rounded-full bg-lilac text-lilac-ink">
          <Award size={22} />
          {strokes.map((i) => (
            <span
              key={i}
              className="absolute top-1/2 left-1/2 h-3 w-[3px] rounded-full"
              style={{
                background: colors[i % 4],
                transform: `rotate(${(i * 360) / strokes.length}deg) translateY(-34px)`,
                animation: `pop 600ms ${i * 18}ms cubic-bezier(.2,1.4,.4,1) both`,
              }}
              aria-hidden
            />
          ))}
        </div>
        <div className="min-w-0">
          <p className="text-[12.5px] text-lilac-ink">Logro desbloqueado</p>
          <p className="font-display text-base font-semibold">{c.title}</p>
          <p className="text-[13px] text-mute">{c.description}</p>
        </div>
      </div>
    </div>
  )
}
