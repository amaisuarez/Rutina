import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cx } from './cx'

export type Tone = 'sky' | 'sage' | 'peach' | 'lilac' | 'neutral' | 'danger' | 'warn'

const badgeTones: Record<Tone, string> = {
  sky: 'bg-sky text-sky-ink',
  sage: 'bg-sage text-sage-ink',
  peach: 'bg-peach text-peach-ink',
  lilac: 'bg-lilac text-lilac-ink',
  neutral: 'bg-sunken text-ink-2',
  danger: 'bg-danger-soft text-danger',
  warn: 'bg-warn-soft text-warn',
}

export function Badge({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-medium whitespace-nowrap', badgeTones[tone], className)}>
      {children}
    </span>
  )
}

const panelTones: Record<Exclude<Tone, 'danger' | 'warn'> | 'card', string> = {
  card: 'bg-card border border-line',
  sky: 'bg-sky',
  sage: 'bg-sage',
  peach: 'bg-peach',
  lilac: 'bg-lilac',
  neutral: 'bg-sunken',
}

/** Panels vary by tone, not by shadow: tinted panels carry module identity, white cards hold dense content. */
export function Panel({
  tone = 'card',
  className,
  children,
  as: As = 'section',
  ...rest
}: {
  tone?: keyof typeof panelTones
  className?: string
  children: ReactNode
  as?: 'section' | 'div' | 'article'
  'aria-label'?: string
  'aria-labelledby'?: string
}) {
  return (
    <As className={cx('rounded-panel p-5', panelTones[tone], className)} {...rest}>
      {children}
    </As>
  )
}

export function PanelTitle({ children, action, id, sub }: { children: ReactNode; action?: ReactNode; id?: string; sub?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[17px]">
          {children}
        </h2>
        {sub && <p className="mt-0.5 text-[13px] text-mute">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, sub, actions, children }: { title: string; sub?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[32px] leading-none sm:text-[40px]" style={{ fontVariationSettings: '"wdth" 90' }}>
            {title}
          </h1>
          {sub && <p className="mt-2 text-[15px] text-mute">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-line-strong px-6 py-10 text-center', className)}>
      {icon && <div className="mb-1 grid size-11 place-items-center rounded-full bg-sunken text-mute">{icon}</div>}
      <p className="font-display text-[17px] font-semibold">{title}</p>
      {body && <p className="max-w-sm text-sm text-mute">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden />
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-10 w-56" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}

/** Lightweight hover/focus tooltip. */
export function Tip({ content, children }: { content: string; children: ReactNode }) {
  const id = useId()
  return (
    <span className="group relative inline-flex" aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-60 -translate-x-1/2 translate-y-1 rounded-lg bg-ink px-2.5 py-1.5 text-[12.5px] leading-snug font-normal text-paper opacity-0 shadow-lift transition-all group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
      >
        {content}
      </span>
    </span>
  )
}

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  hidden?: boolean
}

/** Overflow menu (button + popover). Arrow keys move, Escape closes. */
export function Menu({ items, label = 'Más opciones', trigger, align = 'right' }: { items: MenuItem[]; label?: string; trigger?: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const visible = items.filter((i) => !i.hidden)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const onKey = (e: React.KeyboardEvent) => {
    const els = [...(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])]
    const i = els.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      els[(i + 1) % els.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      els[(i - 1 + els.length) % els.length]?.focus()
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
      btn.current?.focus()
    } else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div ref={ref} className="relative" onKeyDown={onKey} onClick={(e) => e.stopPropagation()}>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-8 items-center justify-center rounded-full text-mute transition-colors hover:bg-sunken hover:text-ink"
      >
        {trigger ?? <MoreHorizontal size={18} />}
      </button>
      {open && (
        <div
          role="menu"
          className={cx(
            'absolute top-full z-40 mt-1 min-w-48 origin-top animate-rise rounded-[14px] border border-line bg-card p-1 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {visible.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              type="button"
              tabIndex={-1}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
              className={cx(
                'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm transition-colors focus:outline-none',
                it.danger ? 'text-danger hover:bg-danger-soft focus:bg-danger-soft' : 'text-ink hover:bg-sunken focus:bg-sunken',
              )}
            >
              <span className="text-current opacity-70">{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Tab bar that keeps the selected tab in the URL search params (`?v=`), so views are linkable. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { value: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 scrollbar-none sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const on = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => {
              const i = tabs.findIndex((x) => x.value === value)
              if (e.key === 'ArrowRight') onChange(tabs[(i + 1) % tabs.length].value)
              if (e.key === 'ArrowLeft') onChange(tabs[(i - 1 + tabs.length) % tabs.length].value)
            }}
            className={cx(
              'relative flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors',
              on ? 'text-ink' : 'text-mute hover:text-ink',
            )}
          >
            {t.icon}
            {t.label}
            <span className={cx('absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-ink transition-transform duration-200', on ? 'scale-x-100' : 'scale-x-0')} />
          </button>
        )
      })}
    </div>
  )
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <p className="text-[13px] text-mute">{label}</p>
      <p className="display-num mt-0.5 truncate text-[26px] leading-tight font-semibold">{value}</p>
      {sub && <div className="mt-0.5 text-[13px] text-mute">{sub}</div>}
    </div>
  )
}
