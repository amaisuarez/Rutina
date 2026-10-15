import { cx } from './cx'

/** Round completion checkbox with a drawn tick. */
export function Check({
  checked,
  onChange,
  label,
  color = 'var(--color-sky-ink)',
  size = 24,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  label: string
  color?: string
  size?: number
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={cx(
        'group relative grid shrink-0 place-items-center rounded-full border-2 transition-all duration-200 active:scale-90 disabled:opacity-40',
        checked ? 'border-transparent' : 'border-line-strong hover:border-ink-2',
      )}
      style={{ width: size, height: size, background: checked ? color : undefined }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} className="tick" data-on={checked} aria-hidden>
        <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
