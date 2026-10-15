import type { ReactNode } from 'react'

/**
 * Chart colours, validated for colour-vision deficiency with the dataviz
 * validator (pairs used together pass ΔE ≥ 8): tasks↔fitness, income↔expense.
 * Single-series charts use one colour for every bar.
 */
export const CHART = {
  tasks: '#4a7bc0',
  fitness: '#3f8f5c',
  income: '#4a7bc0',
  expense: '#c9703f',
  accent: '#8a6cc8',
  ink: '#252a2e',
  grid: '#ebe8e0',
  axis: '#676d73',
}

export const axisProps = {
  tick: { fill: CHART.axis, fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const

interface TooltipPayload {
  name?: string
  value?: number
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

/** Recharts custom tooltip: text in ink tokens, a coloured swatch carries identity. */
export function ChartTooltip({
  active,
  payload,
  label,
  format = (v: number) => String(v),
  labelFormat,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string | number
  format?: (v: number, key?: string) => string
  labelFormat?: (l: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 text-[13px] shadow-lift">
      {label !== undefined && <p className="mb-1 font-medium text-ink">{labelFormat ? labelFormat(String(label)) : label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-ink-2">
          <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} aria-hidden />
          <span>{p.name}</span>
          <span className="num ml-auto pl-3 font-medium text-ink">{format(p.value ?? 0, String(p.dataKey))}</span>
        </p>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/** Wraps a chart with an accessible text summary and an optional data table toggle. */
export function ChartFrame({ summary, children, table }: { summary: string; children: ReactNode; table?: { head: string[]; rows: (string | number)[][] } }) {
  return (
    <figure className="m-0">
      <div role="img" aria-label={summary}>
        {children}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
      {table && (
        <details className="mt-2 text-[13px]">
          <summary className="cursor-pointer text-mute hover:text-ink">Ver como tabla</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-mute">
                  {table.head.map((h) => (
                    <th key={h} className="py-1.5 pr-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-line/60">
                    {r.map((c, j) => (
                      <td key={j} className="num py-1.5 pr-4">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  )
}
