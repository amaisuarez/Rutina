import { useEffect, useState, type ReactNode } from 'react'
import { cx } from './cx'

/** Animates from 0 to `value` on mount so progress visibly "fills in". */
function useMounted(value: number) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  return v
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  color = 'var(--color-ink)',
  track = 'var(--color-sunken)',
  children,
  label,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: ReactNode
  label: string
}) {
  const v = useMounted(Math.max(0, Math.min(1, value)))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  )
}

export function ProgressBar({
  value,
  color = 'var(--color-ink)',
  className,
  label,
  marker,
}: {
  value: number
  color?: string
  className?: string
  label: string
  /** Optional 0..1 position of a "where you should be" tick. */
  marker?: number
}) {
  const v = useMounted(Math.max(0, Math.min(1, value)))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className={cx('relative h-2 overflow-hidden rounded-full bg-sunken', className)}
    >
      <div className="bar-progress h-full rounded-full" style={{ width: `${v * 100}%`, background: color }} />
      {marker !== undefined && marker > 0 && marker < 1 && (
        <div className="absolute top-0 h-full w-0.5 bg-ink/40" style={{ left: `${marker * 100}%` }} title="Ritmo esperado a día de hoy" />
      )}
    </div>
  )
}

/**
 * Tally marks — the app's motif for counting days and sessions: four strokes
 * and a fifth across. Strokes beyond `max` are not drawn; planned-but-not-done
 * slots render as faint strokes so the target is visible.
 */
export function Tally({ count, target = 0, color = 'var(--color-ink)', height = 22, label }: { count: number; target?: number; color?: string; height?: number; label: string }) {
  const total = Math.max(count, target)
  const groups = Math.ceil(total / 5)
  const gw = height * 1.05
  const width = Math.max(1, groups) * (gw + height * 0.35)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="overflow-visible">
      {Array.from({ length: groups }, (_, g) => {
        const x0 = g * (gw + height * 0.35)
        return (
          <g key={g} strokeLinecap="round" strokeWidth={Math.max(2, height / 10)}>
            {Array.from({ length: 4 }, (_, i) => {
              const n = g * 5 + i + 1
              if (n > total) return null
              const x = x0 + 2 + i * (gw / 4.2)
              // Slight hand-drawn wobble per stroke
              const w = ((n * 37) % 5) / 5 - 0.4
              return <line key={i} x1={x + w} y1={2} x2={x - w} y2={height - 2} stroke={color} opacity={n <= count ? 1 : 0.18} />
            })}
            {g * 5 + 5 <= total && (
              <line x1={x0 - 1} y1={height * 0.78} x2={x0 + gw - 2} y2={height * 0.22} stroke={color} opacity={g * 5 + 5 <= count ? 1 : 0.18} />
            )}
          </g>
        )
      })}
    </svg>
  )
}
