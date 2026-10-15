import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlarmClock, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Dumbbell, ListChecks, Pencil, Play, Plus, Repeat, RotateCcw } from 'lucide-react'
import { useStore } from '../../store'
import { openComposer, pointsToast, toast } from '../../store/ui'
import { useParamState } from '../../hooks/useParamState'
import { useToday } from '../../hooks/useToday'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge, PageHeader, Panel, PanelTitle } from '../../components/ui/Misc'
import { Segmented } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { Check } from '../../components/ui/Check'
import { cx } from '../../components/ui/cx'
import { groupByDate, useCalendarItems, type CalItem } from './items'
import { MonthGrid, MonthNav } from './MonthGrid'
import { useTaskActions } from '../tasks/TaskItem'
import { useWorkoutActions } from '../fitness/workoutActions'
import { PRIORITY_LABEL } from '../tasks/logic'
import { addDaysISO, capitalize, fmt, monthGrid, timeToMinutes, weekDays, weekEnd, weekStart } from '../../utils/dates'

const VIEWS = ['dia', 'semana', 'mes'] as const
type View = (typeof VIEWS)[number]

const KIND_STYLE = {
  task: 'bg-sky text-sky-ink',
  workout: 'bg-sage text-sage-ink',
  deadline: 'bg-danger-soft text-danger',
}

function ItemIcon({ item, size = 13 }: { item: CalItem; size?: number }) {
  if (item.kind === 'workout') return <Dumbbell size={size} />
  if (item.kind === 'deadline') return <AlarmClock size={size} />
  return <ListChecks size={size} />
}

function Chip({ item, onOpen, showTime = true }: { item: CalItem; onOpen: (i: CalItem) => void; showTime?: boolean }) {
  const skipped = item.kind === 'workout' && item.skipped
  const time = showTime && 'time' in item ? item.time : undefined
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(item)
      }}
      className={cx(
        'flex w-full min-w-0 items-start gap-1.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] leading-snug font-medium transition-[filter] hover:brightness-95',
        KIND_STYLE[item.kind],
        (item.done || skipped) && 'opacity-55',
        item.kind === 'task' && item.overdue && 'ring-1 ring-danger',
      )}
    >
      <span className="mt-px shrink-0">{item.done ? <CheckCircle2 size={13} /> : <ItemIcon item={item} />}</span>
      <span className="min-w-0 flex-1">
        <span className={cx('line-clamp-2 break-words', (item.done || skipped) && 'line-through')}>{item.title}</span>
        {(time || item.recurring) && (
          <span className="mt-0.5 flex items-center gap-1 text-[11.5px] font-normal opacity-80">
            {time && <span className="num">{time}</span>}
            {item.recurring && <Repeat size={10} aria-label="Se repite" />}
          </span>
        )}
      </span>
      {item.kind === 'task' && (item.priority === 'urgent' || item.priority === 'high') && !item.done && (
        <span className={cx('mt-1 size-1.5 shrink-0 rounded-full', item.priority === 'urgent' ? 'bg-danger' : 'bg-warn')} aria-label={`Prioridad ${PRIORITY_LABEL[item.priority]}`} />
      )}
    </button>
  )
}

export default function AgendaPage() {
  const t0 = useToday()
  const [view, setView] = useParamState<View>('v', 'semana', VIEWS)
  const [anchor, setAnchor] = useState(t0)
  const [open, setOpen] = useState<CalItem | null>(null)
  const [selectedDay, setSelectedDay] = useState(t0)

  const range = view === 'dia' ? [anchor, anchor] : view === 'semana' ? [weekStart(anchor), weekEnd(anchor)] : [monthGrid(anchor)[0], monthGrid(anchor)[41]]
  const items = useCalendarItems(range[0], range[1])
  const byDate = useMemo(() => groupByDate(items), [items])
  const step = (dir: -1 | 1) => setAnchor(view === 'dia' ? addDaysISO(anchor, dir) : view === 'semana' ? addDaysISO(anchor, 7 * dir) : fmtMonth(anchor, dir))

  return (
    <>
      <PageHeader
        title="Agenda"
        sub="Tareas, entrenos y fechas límite en un mismo calendario."
        actions={
          <Button variant="primary" icon={<Plus size={17} />} onClick={() => openComposer({ kind: 'event', date: view === 'mes' ? selectedDay : anchor })}>
            Añadir
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {view !== 'mes' ? (
            <div className="flex items-center gap-1">
              <IconButton label="Anterior" onClick={() => step(-1)}>
                <ChevronLeft size={18} />
              </IconButton>
              <h2 className="min-w-44 text-center text-lg" aria-live="polite">
                {view === 'dia' ? capitalize(fmt(anchor, "EEEE d 'de' MMMM")) : `${fmt(weekStart(anchor), 'd MMM')} – ${fmt(weekEnd(anchor), 'd MMM yyyy')}`}
              </h2>
              <IconButton label="Siguiente" onClick={() => step(1)}>
                <ChevronRight size={18} />
              </IconButton>
            </div>
          ) : (
            <MonthNav anchor={anchor} onChange={setAnchor} />
          )}
          <Button size="sm" onClick={() => (setAnchor(t0), setSelectedDay(t0))}>
            Hoy
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden items-center gap-3 text-[12.5px] text-mute md:flex" aria-hidden>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-[3px] bg-sky-ink" /> Tarea
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-[3px] bg-sage-ink" /> Entreno
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-[3px] bg-danger" /> Fecha límite
            </span>
          </div>
          <Segmented
            label="Vista"
            value={view}
            onChange={setView}
            size="sm"
            options={[
              { value: 'dia', label: 'Día' },
              { value: 'semana', label: 'Semana' },
              { value: 'mes', label: 'Mes' },
            ]}
          />
        </div>
      </div>

      <div key={`${view}-${range[0]}`} className="animate-rise">
        {view === 'dia' && <DayView date={anchor} items={byDate.get(anchor) ?? []} onOpen={setOpen} />}
        {view === 'semana' && (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
            {weekDays(anchor).map((d) => {
              const list = byDate.get(d) ?? []
              return (
                <section
                  key={d}
                  aria-label={capitalize(fmt(d, 'EEEE d'))}
                  className={cx('flex min-h-24 flex-col rounded-[18px] border bg-card p-2 xl:min-h-[440px]', d === t0 ? 'border-ink' : 'border-line')}
                >
                  <header className="mb-2 flex items-center justify-between px-1">
                    <button type="button" className="text-left" onClick={() => (setAnchor(d), setView('dia'))}>
                      <span className="block text-[12.5px] text-mute">{capitalize(fmt(d, 'EEEE'))}</span>
                      <span className={cx('display-num text-xl leading-none font-semibold', d === t0 && 'text-sky-ink')}>{fmt(d, 'd')}</span>
                    </button>
                    <IconButton size="sm" label={`Añadir el ${fmt(d, 'EEEE d')}`} onClick={() => openComposer({ kind: 'event', date: d })}>
                      <Plus size={15} />
                    </IconButton>
                  </header>
                  <div className="flex flex-col gap-1">
                    {list.map((i) => (
                      <Chip key={i.key} item={i} onOpen={setOpen} />
                    ))}
                    {!list.length && <p className="px-1 text-[12.5px] text-faint">Libre</p>}
                  </div>
                </section>
              )
            })}
          </div>
        )}
        {view === 'mes' && (
          <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
            <MonthGrid
              anchor={anchor}
              selected={selectedDay}
              onSelect={setSelectedDay}
              renderDay={(d) => {
                const list = byDate.get(d) ?? []
                if (!list.length) return null
                return (
                  <>
                    <span className="hidden flex-col gap-0.5 sm:flex">
                      {list.slice(0, 3).map((i) => (
                        <span key={i.key} className={cx('flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11.5px]', KIND_STYLE[i.kind], i.done && 'line-through opacity-55')}>
                          <ItemIcon item={i} size={11} />
                          <span className="truncate">{i.title}</span>
                        </span>
                      ))}
                      {list.length > 3 && <span className="px-1 text-[11px] text-mute">+{list.length - 3} más</span>}
                    </span>
                    <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                      {list.slice(0, 5).map((i) => (
                        <span key={i.key} className={cx('size-1.5 rounded-full', i.kind === 'workout' ? 'bg-sage-ink' : i.kind === 'deadline' ? 'bg-danger' : 'bg-sky-ink', i.done && 'opacity-40')} />
                      ))}
                    </span>
                  </>
                )
              }}
            />
            <Panel className="self-start">
              <PanelTitle
                action={
                  <Button size="sm" icon={<Plus size={14} />} onClick={() => openComposer({ kind: 'event', date: selectedDay })}>
                    Añadir
                  </Button>
                }
              >
                {capitalize(fmt(selectedDay, "EEEE d 'de' MMMM"))}
              </PanelTitle>
              <div className="flex flex-col gap-1.5">
                {(byDate.get(selectedDay) ?? []).map((i) => (
                  <Chip key={i.key} item={i} onOpen={setOpen} />
                ))}
                {!(byDate.get(selectedDay) ?? []).length && <p className="text-sm text-mute">Nada programado este día.</p>}
              </div>
            </Panel>
          </div>
        )}
      </div>
      {open && <ItemDetail item={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function fmtMonth(anchor: string, dir: -1 | 1) {
  const d = new Date(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1 + dir, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const HOUR_PX = 56
const FIRST_HOUR = 6

function DayView({ date, items, onOpen }: { date: string; items: CalItem[]; onOpen: (i: CalItem) => void }) {
  const timed = items.filter((i) => 'time' in i && i.time) as (CalItem & { time: string })[]
  const allDay = items.filter((i) => !('time' in i && i.time))
  const startHour = Math.min(FIRST_HOUR, ...timed.map((i) => Math.floor(timeToMinutes(i.time) / 60)))
  const hours = Array.from({ length: 24 - startHour }, (_, i) => startHour + i)
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const isToday = date === useToday()

  // Simple column layout for overlapping events.
  const laid = timed
    .map((i) => {
      const s = timeToMinutes(i.time)
      const e = i.kind === 'task' && i.endTime ? Math.max(s + 20, timeToMinutes(i.endTime)) : s + (i.kind === 'workout' ? i.minutes : i.kind === 'task' ? (i.task.estimatedMin ?? 45) : 30)
      return { i, s, e, col: 0 }
    })
    .sort((a, b) => a.s - b.s)
  const cols: number[] = []
  for (const x of laid) {
    let c = cols.findIndex((end) => end <= x.s)
    if (c < 0) c = cols.length
    cols[c] = x.e
    x.col = c
  }
  const ncol = Math.max(1, cols.length)

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="overflow-hidden rounded-panel border border-line bg-card">
        <div className="relative" style={{ height: hours.length * HOUR_PX }}>
          {hours.map((h, i) => (
            <div key={h} className="absolute inset-x-0 flex border-t border-line/70" style={{ top: i * HOUR_PX }}>
              <span className="num w-14 shrink-0 -translate-y-2.5 bg-card pr-2 text-right text-[11.5px] text-mute">{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
          {isToday && nowMin >= startHour * 60 && (
            <div className="absolute right-0 left-14 z-10 h-0.5 bg-danger" style={{ top: ((nowMin - startHour * 60) / 60) * HOUR_PX }}>
              <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-danger" />
            </div>
          )}
          <div className="absolute inset-y-0 right-2 left-16">
            {laid.map(({ i, s, e, col }) => (
              <div
                key={i.key}
                className="absolute px-0.5"
                style={{ top: ((s - startHour * 60) / 60) * HOUR_PX + 1, height: Math.max(26, ((e - s) / 60) * HOUR_PX - 2), left: `${(col / ncol) * 100}%`, width: `${100 / ncol}%` }}
              >
                <button
                  type="button"
                  onClick={() => onOpen(i)}
                  className={cx('flex h-full w-full flex-col items-start overflow-hidden rounded-[10px] px-2.5 py-1.5 text-left text-[13px] hover:brightness-95', KIND_STYLE[i.kind], i.done && 'opacity-55')}
                >
                  <span className={cx('font-medium', i.done && 'line-through')}>{i.title}</span>
                  <span className="num text-[11.5px] opacity-80">
                    {i.time}
                    {i.kind === 'task' && i.endTime ? `–${i.endTime}` : ''}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Panel className="self-start">
        <PanelTitle
          sub="Sin hora asignada"
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => openComposer({ kind: 'event', date })}>
              Añadir
            </Button>
          }
        >
          Todo el día
        </PanelTitle>
        <div className="flex flex-col gap-1.5">
          {allDay.map((i) => (
            <Chip key={i.key} item={i} onOpen={onOpen} />
          ))}
          {!allDay.length && <p className="text-sm text-mute">Nada sin hora.</p>}
        </div>
      </Panel>
    </div>
  )
}

/** Detail sheet for any calendar item; actions edit the underlying task or workout. */
function ItemDetail({ item, onClose }: { item: CalItem; onClose: () => void }) {
  const ta = useTaskActions()
  const wa = useWorkoutActions()
  const navigate = useNavigate()
  const t0 = useToday()
  // Re-read the live record so the dialog reflects completion immediately.
  const task = useStore((s) => ('task' in item ? s.tasks.find((t) => t.id === item.task.id) : undefined))
  const workout = useStore((s) => (item.kind === 'workout' ? s.scheduled.find((w) => w.id === item.workout.id) : undefined))
  const template = useStore((s) => (workout ? s.templates.find((t) => t.id === workout.templateId) : undefined))
  if (!task && !workout) return null

  if (task) {
    const done = task.status === 'completed'
    return (
      <Modal
        open
        size="sm"
        onClose={onClose}
        title={task.title}
        description={item.kind === 'deadline' ? `Fecha límite: ${fmt(task.deadline!, "EEEE d 'de' MMMM")}` : task.date ? capitalize(fmt(task.date, "EEEE d 'de' MMMM")) : undefined}
        tone="sky"
        footer={
          <>
            <Button
              variant="ghost"
              icon={<Pencil size={15} />}
              onClick={() => {
                onClose()
                openComposer({ kind: 'task', task })
              }}
            >
              Editar
            </Button>
            <Button variant={done ? 'secondary' : 'primary'} icon={done ? <RotateCcw size={15} /> : <CheckCircle2 size={15} />} onClick={() => ta.toggle(task)}>
              {done ? 'Reabrir' : 'Completar'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="sky">{task.category}</Badge>
            <Badge>Prioridad {PRIORITY_LABEL[task.priority].toLowerCase()}</Badge>
            {task.startTime && (
              <Badge>
                {task.startTime}
                {task.endTime && `–${task.endTime}`}
              </Badge>
            )}
            {task.seriesId && (
              <Badge>
                <Repeat size={11} /> Se repite
              </Badge>
            )}
            {done && <Badge tone="sage">Completada</Badge>}
          </div>
          {task.description && <p className="text-ink-2">{task.description}</p>}
          {task.subtasks.length > 0 && (
            <ul className="space-y-1.5">
              {task.subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <Check checked={s.done} size={20} onChange={() => useStore.getState().toggleSubtask(task.id, s.id)} label={s.title} />
                  <span className={cx(s.done && 'text-mute line-through')}>{s.title}</span>
                </li>
              ))}
            </ul>
          )}
          {task.notes && <p className="rounded-ctl bg-sunken px-3 py-2 text-ink-2">{task.notes}</p>}
        </div>
      </Modal>
    )
  }

  const w = workout!
  const done = w.status === 'completed'
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={template?.name ?? 'Entreno'}
      description={`${capitalize(fmt(w.date, "EEEE d 'de' MMMM"))}${w.time ? `, ${w.time}` : ''}`}
      tone="sage"
      footer={
        done ? (
          <>
            {w.sessionId && (
              <Button variant="ghost" onClick={() => navigate(`/entreno/sesion/${w.sessionId}`)}>
                Ver sesión
              </Button>
            )}
            <Button
              icon={<RotateCcw size={15} />}
              onClick={() => {
                pointsToast(useStore.getState().reopenScheduled(w.id), 'Entreno marcado como no hecho')
              }}
            >
              Marcar como no hecho
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => (wa.skip(w), onClose())}>
              {w.status === 'skipped' ? 'Recuperar' : 'Saltar'}
            </Button>
            {w.date <= t0 && (
              <Button onClick={() => wa.quickDone(w)} icon={<CheckCircle2 size={15} />}>
                Marcar hecho
              </Button>
            )}
            <Button variant="primary" icon={<Play size={15} />} onClick={() => wa.start(w)}>
              Empezar
            </Button>
          </>
        )
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-1.5">
          {template && <Badge tone="sage">{template.estimatedMin} min</Badge>}
          {w.seriesId && (
            <Badge>
              <Repeat size={11} /> Plan semanal
            </Badge>
          )}
          {done && <Badge tone="sage">Completado</Badge>}
          {w.status === 'skipped' && <Badge>Saltado</Badge>}
        </div>
        {template && <p className="text-ink-2">{template.exercises.length} ejercicios. Se puede mover a otro día desde Entreno.</p>}
        {!done && (
          <label className="flex items-center gap-3">
            <CalendarDays size={15} className="text-mute" />
            <span className="text-mute">Mover a</span>
            <input
              type="date"
              defaultValue={w.date}
              onChange={(e) => {
                if (!e.target.value) return
                useStore.getState().updateScheduled(w.id, { date: e.target.value })
                toast('Entreno movido')
              }}
              className="h-9 rounded-lg border border-line px-2"
            />
          </label>
        )}
      </div>
    </Modal>
  )
}
