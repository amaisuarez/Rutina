import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from './cx'

const control =
  'w-full rounded-ctl border border-line bg-card px-3 text-[15px] text-ink placeholder:text-faint transition-colors hover:border-line-strong focus:border-sky-ink focus:outline-none focus:ring-3 focus:ring-sky/80 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger-soft'

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] text-mute">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(control, 'h-11', className)} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cx(
        control,
        'h-11 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23676d73' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(control, 'min-h-20 py-2.5 leading-snug', className)} {...rest} />
})

/** Segmented single choice. Keyboard: arrow keys move, as a radio group. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; title?: string }[]
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const name = useId()
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex max-w-full overflow-x-auto rounded-ctl bg-sunken p-1 scrollbar-none', className)}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <label
            key={o.value}
            title={o.title}
            className={cx(
              'relative flex shrink-0 cursor-pointer items-center justify-center rounded-[9px] font-medium whitespace-nowrap transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sky-ink',
              size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
              on ? 'bg-card text-ink shadow-card' : 'text-mute hover:text-ink',
            )}
          >
            <input type="radio" name={name} className="sr-only" checked={on} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        )
      })}
    </div>
  )
}

/** Multi-select pill chips. */
export function Chips<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T[]
  onChange: (v: T[]) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cx(
              'h-8 rounded-full border px-3 text-[13px] font-medium transition-colors',
              on ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink-2 hover:border-line-strong',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-[13px] text-mute">{description}</span>}
      </label>
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-ink' : 'bg-line-strong')}
      >
        <span className={cx('absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </div>
  )
}
