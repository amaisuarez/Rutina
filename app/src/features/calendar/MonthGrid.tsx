import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '../../components/ui/Button'
import { cx } from '../../components/ui/cx'
import { WEEKDAY_SHORT, addMonthsISO, capitalize, fmt, monthGrid, today } from '../../utils/dates'

export function MonthNav({ anchor, onChange, children }: { anchor: string; onChange: (d: string) => void; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <IconButton label="Mes anterior" onClick={() => onChange(addMonthsISO(anchor, -1))}>
        <ChevronLeft size={18} />
      </IconButton>
      <h2 className="min-w-36 text-center text-lg" aria-live="polite">
        {capitalize(fmt(anchor, 'MMMM yyyy'))}
      </h2>
      <IconButton label="Mes siguiente" onClick={() => onChange(addMonthsISO(anchor, 1))}>
        <ChevronRight size={18} />
      </IconButton>
      {children}
    </div>
  )
}

/** Monday-first month grid. `renderDay` fills each cell; selection and keyboard handled here. */
export function MonthGrid({
  anchor,
  selected,
  onSelect,
  renderDay,
  onDropItem,
}: {
  anchor: string
  selected?: string
  onSelect: (d: string) => void
  renderDay: (d: string) => ReactNode
  onDropItem?: (date: string, e: React.DragEvent) => void
}) {
  const days = monthGrid(anchor)
  const month = anchor.slice(0, 7)
  const t0 = today()
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-card">
      <div className="grid grid-cols-7 border-b border-line bg-paper/60" aria-hidden>
        {WEEKDAY_SHORT.map((d, i) => (
          <div key={d} className={cx('py-2 text-center text-[12px] font-medium text-mute', i >= 5 && 'text-faint')}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7" role="grid" aria-label={capitalize(fmt(anchor, 'MMMM yyyy'))}>
        {days.map((d, i) => {
          const inMonth = d.startsWith(month)
          const isSel = d === selected
          return (
            <div
              key={d}
              role="gridcell"
              aria-selected={isSel}
              onDragOver={onDropItem ? (e) => e.preventDefault() : undefined}
              onDrop={onDropItem ? (e) => onDropItem(d, e) : undefined}
              className={cx('min-h-[64px] border-line sm:min-h-[108px]', i % 7 !== 6 && 'border-r', i < 35 && 'border-b', !inMonth && 'bg-paper/70')}
            >
              <button
                type="button"
                onClick={() => onSelect(d)}
                aria-label={capitalize(fmt(d, "EEEE d 'de' MMMM"))}
                className={cx('flex h-full w-full flex-col gap-1 p-1.5 text-left transition-colors hover:bg-sunken/60 sm:p-2', isSel && 'bg-sky/50 hover:bg-sky/60')}
              >
                <span
                  className={cx(
                    'num grid size-7 place-items-center rounded-full text-[13px]',
                    d === t0 ? 'bg-ink font-semibold text-paper' : inMonth ? 'text-ink' : 'text-faint',
                  )}
                >
                  {parseInt(d.slice(8), 10)}
                </span>
                {renderDay(d)}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
