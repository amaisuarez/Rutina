import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Plus, Search } from 'lucide-react'
import type { Task } from '../../types'
import { useStore } from '../../store'
import { openComposer, toast } from '../../store/ui'
import { useParamState } from '../../hooks/useParamState'
import { useToday } from '../../hooks/useToday'
import { Button, IconButton } from '../../components/ui/Button'
import { EmptyState, PageHeader, Panel, PanelTitle, Stat, Tabs } from '../../components/ui/Misc'
import { Input, Select } from '../../components/ui/Form'
import { ProgressBar, ProgressRing } from '../../components/ui/Progress'
import { cx } from '../../components/ui/cx'
import { ChartFrame, ChartTooltip, CHART, axisProps } from '../../components/charts'
import { TaskItem, OverdueBar } from './TaskItem'
import { DIFFICULTIES, PRIORITIES, PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, isOpen, isOverdue, sortTasks } from './logic'
import { DIFFICULTY_LABEL } from '../gamification/scoring'
import { MonthGrid, MonthNav } from '../calendar/MonthGrid'
import { WEEKDAY_NAMES, addDaysISO, capitalize, dateOf, fmt, relativeDay, weekDays, weekEnd, weekStart, weekday } from '../../utils/dates'
import { duration, num, pct } from '../../utils/format'


const VIEWS = ['hoy', 'semana', 'mes', 'todas', 'progreso'] as const
type View = (typeof VIEWS)[number]

export default function TasksPage() {
  const [view, setView] = useParamState<View>('v', 'hoy', VIEWS)
  return (
    <>
      <PageHeader
        title="Tareas"
        sub="Planifica el día, reparte la semana y revisa cómo vas."
        actions={
          <Button variant="primary" icon={<Plus size={17} />} onClick={() => openComposer({ kind: 'task' })}>
            Nueva tarea
          </Button>
        }
      >
        <Tabs
          label="Vistas de tareas"
          value={view}
          onChange={setView}
          tabs={[
            { value: 'hoy', label: 'Hoy' },
            { value: 'semana', label: 'Semana' },
            { value: 'mes', label: 'Mes' },
            { value: 'todas', label: 'Todas' },
            { value: 'progreso', label: 'Progreso' },
          ]}
        />
      </PageHeader>
      {view === 'hoy' && <TodayView />}
      {view === 'semana' && <WeekView />}
      {view === 'mes' && <MonthView />}
      {view === 'todas' && <AllView />}
      {view === 'progreso' && <InsightsView />}
    </>
  )
}

function TodayView() {
  const t0 = useToday()
  const tasks = useStore((s) => s.tasks)
  const goal = useStore((s) => s.settings.goals.dailyTasks)
  const todays = useMemo(() => tasks.filter((t) => t.date === t0).sort(sortTasks), [tasks, t0])
  const overdue = useMemo(() => tasks.filter((t) => isOverdue(t, t0)).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')), [tasks, t0])
  const completedToday = tasks.filter((t) => t.status === 'completed' && t.completedAt && dateOf(t.completedAt) === t0).length
  const open = todays.filter(isOpen)
  const priorities = open.filter((t) => t.priority === 'urgent' || t.priority === 'high')
  const done = todays.filter((t) => t.status === 'completed').length

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <OverdueBar tasks={overdue} />
        {overdue.length > 0 && (
          <section aria-labelledby="ov-h">
            <h2 id="ov-h" className="mb-1 px-3 text-[15px] text-danger">
              Vencidas
            </h2>
            <ul className="divide-y divide-line/70">
              {overdue.map((t) => (
                <TaskItem key={t.id} task={t} showDate />
              ))}
            </ul>
          </section>
        )}
        <section aria-labelledby="today-h">
          <div className="mb-1 flex items-baseline justify-between px-3">
            <h2 id="today-h" className="text-[15px]">
              {capitalize(fmt(t0, "EEEE d 'de' MMMM"))}
            </h2>
            <span className="num text-[13px] text-mute">
              {done} de {todays.length}
            </span>
          </div>
          {todays.length ? (
            <ul className="divide-y divide-line/70">
              {todays.map((t) => (
                <TaskItem key={t.id} task={t} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<ClipboardList size={20} />}
              title="Nada planificado para hoy"
              body="Añade lo que quieras sacar adelante hoy. Tres tareas bien elegidas valen más que diez a medias."
              action={
                <Button variant="primary" icon={<Plus size={16} />} onClick={() => openComposer({ kind: 'task', date: t0 })}>
                  Añadir tarea para hoy
                </Button>
              }
            />
          )}
          {todays.length > 0 && (
            <button
              type="button"
              onClick={() => openComposer({ kind: 'task', date: t0 })}
              className="mt-1 flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-[15px] text-mute hover:bg-sunken/70 hover:text-ink"
            >
              <span className="grid size-6 place-items-center rounded-full border-2 border-dashed border-line-strong">
                <Plus size={13} />
              </span>
              Añadir tarea
            </button>
          )}
        </section>
      </div>
      <aside className="space-y-4">
        <Panel tone="sky">
          <div className="flex items-center gap-4">
            <ProgressRing value={goal ? completedToday / goal : 0} size={76} stroke={8} color="var(--color-sky-ink)" track="rgb(255 255 255 / .7)" label={`${completedToday} de ${goal} tareas del objetivo diario`}>
              <span className="display-num text-xl font-semibold">{completedToday}</span>
            </ProgressRing>
            <div>
              <p className="font-display text-[17px] font-semibold">Objetivo diario</p>
              <p className="text-sm text-ink-2">
                {completedToday >= goal ? 'Cumplido. Lo que venga ahora es extra.' : `Te faltan ${goal - completedToday} para llegar a ${goal}.`}
              </p>
            </div>
          </div>
        </Panel>
        <Panel>
          <PanelTitle>Prioridades de hoy</PanelTitle>
          {priorities.length ? (
            <ul className="space-y-2 text-sm">
              {priorities.map((t) => (
                <li key={t.id} className="flex items-start gap-2">
                  <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', t.priority === 'urgent' ? 'bg-danger' : 'bg-warn')} aria-hidden />
                  <span>
                    {t.title}
                    <span className="text-mute"> ({PRIORITY_LABEL[t.priority].toLowerCase()})</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">No hay tareas urgentes ni de prioridad alta pendientes hoy.</p>
          )}
        </Panel>
      </aside>
    </div>
  )
}

function WeekView() {
  const t0 = useToday()
  const [anchor, setAnchor] = useState(t0)
  const tasks = useStore((s) => s.tasks)
  const days = useMemo(() => weekDays(anchor), [anchor])
  const [over, setOver] = useState<string | null>(null)
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const d of days) m.set(d, [])
    for (const t of tasks) if (t.date && m.has(t.date)) m.get(t.date)!.push(t)
    for (const arr of m.values()) arr.sort(sortTasks)
    return m
  }, [tasks, days])
  const maxLoad = Math.max(240, ...[...byDay.values()].map((arr) => arr.filter(isOpen).reduce((s, t) => s + (t.estimatedMin ?? 30), 0)))

  const onDrop = (date: string, e: React.DragEvent) => {
    e.preventDefault()
    setOver(null)
    const id = e.dataTransfer.getData('text/x-task')
    const task = tasks.find((t) => t.id === id)
    if (task && task.date !== date) {
      useStore.getState().moveTask(id, date)
      toast(`«${task.title}» movida a ${relativeDay(date).toLowerCase()}`)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <IconButton label="Semana anterior" onClick={() => setAnchor(addDaysISO(anchor, -7))}>
            <ChevronLeft size={18} />
          </IconButton>
          <h2 className="text-lg">
            {fmt(weekStart(anchor), 'd MMM')} – {fmt(weekEnd(anchor), 'd MMM yyyy')}
          </h2>
          <IconButton label="Semana siguiente" onClick={() => setAnchor(addDaysISO(anchor, 7))}>
            <ChevronRight size={18} />
          </IconButton>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden text-[13px] text-mute md:block">Arrastra una tarea a otro día para moverla.</p>
          {weekStart(anchor) !== weekStart(t0) && (
            <Button size="sm" onClick={() => setAnchor(t0)}>
              Esta semana
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-7 md:gap-2">
        {days.map((d) => {
          const list = byDay.get(d)!
          const load = list.filter(isOpen).reduce((s, t) => s + (t.estimatedMin ?? 30), 0)
          const doneN = list.filter((t) => t.status === 'completed').length
          return (
            <section
              key={d}
              aria-label={capitalize(fmt(d, 'EEEE d'))}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(d)
              }}
              onDragLeave={() => setOver((o) => (o === d ? null : o))}
              onDrop={(e) => onDrop(d, e)}
              className={cx(
                'flex min-h-28 flex-col rounded-[18px] border bg-card p-2 transition-colors md:min-h-[420px]',
                over === d ? 'border-sky-ink bg-sky/40' : 'border-line',
                d === t0 && 'ring-2 ring-sky-mid ring-offset-2 ring-offset-paper',
              )}
            >
              <header className="mb-1 flex items-center justify-between px-1.5 pt-1">
                <div>
                  <p className={cx('text-[13px] font-semibold', d === t0 ? 'text-sky-ink' : 'text-ink')}>{capitalize(fmt(d, 'EEE d'))}</p>
                  <p className="num text-[11.5px] text-mute">
                    {list.length ? `${doneN}/${list.length} hechas, ${duration(load)}` : 'Libre'}
                  </p>
                </div>
                <IconButton label={`Añadir tarea el ${fmt(d, 'EEEE d')}`} size="sm" onClick={() => openComposer({ kind: 'task', date: d })}>
                  <Plus size={16} />
                </IconButton>
              </header>
              <div className="mx-1.5 mb-2 h-1 overflow-hidden rounded-full bg-sunken" title={`Carga pendiente: ${duration(load)}`}>
                <div className={cx('bar-progress h-full rounded-full', load > 360 ? 'bg-warn' : 'bg-sky-mid')} style={{ width: `${Math.min(100, (load / maxLoad) * 100)}%` }} />
              </div>
              <ul className="flex flex-col gap-0.5">
                {list.map((t) => (
                  <TaskItem key={t.id} task={t} draggable compact />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function MonthView() {
  const t0 = useToday()
  const [anchor, setAnchor] = useState(t0)
  const [selected, setSelected] = useState(t0)
  const tasks = useStore((s) => s.tasks)
  const byDate = useMemo(() => {
    const m = new Map<string, { tasks: Task[]; deadlines: Task[] }>()
    const get = (d: string) => m.get(d) ?? (m.set(d, { tasks: [], deadlines: [] }), m.get(d)!)
    for (const t of tasks) {
      if (t.date) get(t.date).tasks.push(t)
      if (t.deadline) get(t.deadline).deadlines.push(t)
    }
    return m
  }, [tasks])
  const sel = byDate.get(selected)

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div>
        <div className="mb-3">
          <MonthNav anchor={anchor} onChange={setAnchor} />
        </div>
        <MonthGrid
          anchor={anchor}
          selected={selected}
          onSelect={setSelected}
          onDropItem={(d, e) => {
            const id = e.dataTransfer.getData('text/x-task')
            if (id) useStore.getState().moveTask(id, d)
          }}
          renderDay={(d) => {
            const x = byDate.get(d)
            if (!x) return null
            const visible = x.tasks.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
            return (
              <>
                <div className="hidden flex-col gap-0.5 sm:flex">
                  {visible.slice(0, 3).map((t) => (
                    <span
                      key={t.id}
                      className={cx(
                        'truncate rounded-md px-1.5 py-0.5 text-[11.5px]',
                        t.status === 'completed' ? 'bg-sunken text-mute line-through' : isOverdue(t) ? 'bg-danger-soft text-danger' : 'bg-sky text-sky-ink',
                      )}
                    >
                      {t.title}
                    </span>
                  ))}
                  {visible.length > 3 && <span className="px-1 text-[11px] text-mute">+{visible.length - 3} más</span>}
                  {x.deadlines.length > 0 && <span className="truncate px-1 text-[11px] font-medium text-danger">Límite: {x.deadlines[0].title}</span>}
                </div>
                <div className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                  {visible.slice(0, 4).map((t) => (
                    <span key={t.id} className={cx('size-1.5 rounded-full', t.status === 'completed' ? 'bg-faint' : 'bg-sky-ink')} />
                  ))}
                  {x.deadlines.length > 0 && <span className="size-1.5 rounded-full bg-danger" />}
                </div>
              </>
            )
          }}
        />
      </div>
      <Panel className="self-start">
        <PanelTitle
          sub={sel ? `${sel.tasks.length} ${sel.tasks.length === 1 ? 'tarea' : 'tareas'}` : 'Sin tareas'}
          action={
            <Button size="sm" icon={<Plus size={15} />} onClick={() => openComposer({ kind: 'task', date: selected })}>
              Añadir
            </Button>
          }
        >
          {capitalize(fmt(selected, "EEEE d 'de' MMMM"))}
        </PanelTitle>
        {sel && (sel.tasks.length > 0 || sel.deadlines.length > 0) ? (
          <>
            <ul className="-mx-3 divide-y divide-line/70">
              {sel.tasks.sort(sortTasks).map((t) => (
                <TaskItem key={t.id} task={t} />
              ))}
            </ul>
            {sel.deadlines.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="mb-1 text-[13px] font-medium text-danger">Fecha límite este día</p>
                <ul className="-mx-3">
                  {sel.deadlines.map((t) => (
                    <TaskItem key={t.id} task={t} showDate />
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-mute">Día libre. Pulsa «Añadir» para planificar algo.</p>
        )}
      </Panel>
    </div>
  )
}

type DateFilter = 'all' | 'today' | 'week' | 'overdue' | 'nodate' | 'upcoming'

function AllView() {
  const t0 = useToday()
  const tasks = useStore((s) => s.tasks)
  const categories = useStore((s) => s.settings.taskCategories)
  const [q, setQ] = useState('')
  const [status, setStatus] = useParamState<string>('estado', 'open')
  const [priority, setPriority] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [when, setWhen] = useState<DateFilter>('all')
  const [sort, setSort] = useState<'date' | 'priority' | 'created'>('date')

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const ws = weekStart(t0)
    const we = weekEnd(t0)
    return tasks
      .filter((t) => {
        if (needle && !`${t.title} ${t.description ?? ''} ${t.notes ?? ''}`.toLowerCase().includes(needle)) return false
        if (status === 'open' && !isOpen(t)) return false
        if (status !== 'open' && status !== 'any' && t.status !== status) return false
        if (priority && t.priority !== priority) return false
        if (category && t.category !== category) return false
        if (difficulty && t.difficulty !== difficulty) return false
        if (when === 'today' && t.date !== t0) return false
        if (when === 'week' && !(t.date && t.date >= ws && t.date <= we)) return false
        if (when === 'overdue' && !isOverdue(t, t0)) return false
        if (when === 'nodate' && t.date) return false
        if (when === 'upcoming' && !(t.date && t.date > t0)) return false
        return true
      })
      .sort((a, b) => {
        if (sort === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.date ?? '9').localeCompare(b.date ?? '9')
        if (sort === 'created') return b.createdAt.localeCompare(a.createdAt)
        return (a.date ?? '9999').localeCompare(b.date ?? '9999') || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      })
  }, [tasks, q, status, priority, category, difficulty, when, sort, t0])

  const shown = list.slice(0, 200)
  const filtered = q || status !== 'open' || priority || category || difficulty || when !== 'all'

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(6,minmax(0,1fr))]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-mute" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tareas" aria-label="Buscar tareas" className="pl-9" />
        </div>
        <Select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Abiertas</option>
          <option value="any">Todos los estados</option>
          {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select aria-label="Fecha" value={when} onChange={(e) => setWhen(e.target.value as DateFilter)}>
          <option value="all">Cualquier fecha</option>
          <option value="today">Hoy</option>
          <option value="week">Esta semana</option>
          <option value="upcoming">Próximas</option>
          <option value="overdue">Vencidas</option>
          <option value="nodate">Sin fecha</option>
        </Select>
        <Select aria-label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Prioridad</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>
        <Select aria-label="Categoría" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Categoría</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select aria-label="Dificultad" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">Dificultad</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
            </option>
          ))}
        </Select>
        <Select aria-label="Ordenar por" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="date">Por fecha</option>
          <option value="priority">Por prioridad</option>
          <option value="created">Recientes</option>
        </Select>
      </div>
      <p className="text-[13px] text-mute" aria-live="polite">
        {list.length === 1 ? '1 tarea' : `${num(list.length)} tareas`}
        {list.length > shown.length && `, se muestran las primeras ${shown.length}`}
      </p>
      {shown.length ? (
        <ul className="divide-y divide-line/70 rounded-panel border border-line bg-card px-1 py-1">
          {shown.map((t) => (
            <TaskItem key={t.id} task={t} showDate />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Search size={20} />}
          title={filtered ? 'Ninguna tarea coincide' : 'Aún no tienes tareas'}
          body={filtered ? 'Prueba a quitar algún filtro o cambia la búsqueda.' : 'Crea tu primera tarea para empezar a organizar el día.'}
          action={
            filtered ? (
              <Button
                onClick={() => {
                  setQ('')
                  setStatus('open')
                  setPriority('')
                  setCategory('')
                  setDifficulty('')
                  setWhen('all')
                }}
              >
                Quitar filtros
              </Button>
            ) : (
              <Button variant="primary" onClick={() => openComposer({ kind: 'task' })}>
                Nueva tarea
              </Button>
            )
          }
        />
      )}
    </div>
  )
}

function InsightsView() {
  const t0 = useToday()
  const tasks = useStore((s) => s.tasks)
  const goals = useStore((s) => s.settings.goals)
  const updateSettings = useStore((s) => s.updateSettings)

  const data = useMemo(() => {
    const ws = weekStart(t0)
    const we = weekEnd(t0)
    const todays = tasks.filter((t) => t.date === t0)
    const week = tasks.filter((t) => t.date && t.date >= ws && t.date <= we)
    const completed = tasks.filter((t) => t.status === 'completed' && t.completedAt)
    const since30 = addDaysISO(t0, -29)
    const last30 = completed.filter((t) => dateOf(t.completedAt!) >= since30)
    const since56 = addDaysISO(t0, -55)
    const byWeekday = WEEKDAY_NAMES.map((name, i) => ({
      name: name.slice(0, 3),
      full: name,
      value: completed.filter((t) => dateOf(t.completedAt!) >= since56 && weekday(dateOf(t.completedAt!)) === i + 1).length,
    }))
    const catMap = new Map<string, number>()
    for (const t of last30) catMap.set(t.category, (catMap.get(t.category) ?? 0) + 1)
    const byCategory = [...catMap].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    const overdueTrend = Array.from({ length: 8 }, (_, i) => {
      const s = addDaysISO(ws, -7 * (7 - i))
      const e = addDaysISO(s, 6)
      const planned = tasks.filter((t) => t.date && t.date >= s && t.date <= e)
      const late = planned.filter((t) => t.status === 'missed' || (isOpen(t) && t.date! < t0) || (t.status === 'completed' && t.completedAt && dateOf(t.completedAt) > t.date!))
      return { name: fmt(s, 'd MMM'), value: late.length, planned: planned.length }
    })
    const best = [...byWeekday].sort((a, b) => b.value - a.value)[0]
    return {
      dayRate: todays.length ? todays.filter((t) => t.status === 'completed').length / todays.length : 0,
      dayCount: todays.length,
      weekRate: week.length ? week.filter((t) => t.status === 'completed').length / week.length : 0,
      weekDone: completed.filter((t) => dateOf(t.completedAt!) >= ws && dateOf(t.completedAt!) <= we).length,
      avgPerDay: last30.length / 30,
      byWeekday,
      byCategory,
      overdueTrend,
      best: best.value > 0 ? best.full : null,
    }
  }, [tasks, t0])

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel tone="sky">
          <Stat label="Completadas hoy" value={pct(data.dayRate)} sub={data.dayCount ? `de ${data.dayCount} planificadas` : 'Sin tareas hoy'} />
        </Panel>
        <Panel>
          <Stat label="Completadas esta semana" value={pct(data.weekRate)} sub={`${data.weekDone} hechas`} />
        </Panel>
        <Panel>
          <Stat label="Media diaria (30 días)" value={data.avgPerDay.toLocaleString('es-ES', { maximumFractionDigits: 1 })} sub="tareas completadas por día" />
        </Panel>
        <Panel>
          <Stat label="Tu mejor día" value={data.best ?? '—'} sub="según las últimas 8 semanas" />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelTitle sub="Tareas completadas por día de la semana, últimas 8 semanas">Días más productivos</PanelTitle>
          <ChartFrame
            summary={`Tareas completadas por día de la semana: ${data.byWeekday.map((d) => `${d.full} ${d.value}`).join(', ')}.`}
            table={{ head: ['Día', 'Completadas'], rows: data.byWeekday.map((d) => [d.full, d.value]) }}
          >
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.byWeekday} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} />
                  <Tooltip cursor={{ fill: 'rgba(37,42,46,.04)' }} content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Completadas" fill={CHART.tasks} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartFrame>
        </Panel>

        <Panel>
          <PanelTitle sub="Tareas planificadas que acabaron fuera de plazo o sin hacer, por semana">Tareas vencidas</PanelTitle>
          <ChartFrame
            summary={`Tareas vencidas por semana: ${data.overdueTrend.map((d) => `${d.name} ${d.value}`).join(', ')}.`}
            table={{ head: ['Semana', 'Vencidas', 'Planificadas'], rows: data.overdueTrend.map((d) => [d.name, d.value, d.planned]) }}
          >
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.overdueTrend} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} {...axisProps} />
                  <Tooltip cursor={{ fill: 'rgba(37,42,46,.04)' }} content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Vencidas" fill={CHART.expense} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartFrame>
        </Panel>

        <Panel>
          <PanelTitle sub="Últimos 30 días">Completadas por categoría</PanelTitle>
          {data.byCategory.length ? (
            <ul className="space-y-3">
              {data.byCategory.map((c) => (
                <li key={c.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{c.name}</span>
                    <span className="num text-mute">{c.value}</span>
                  </div>
                  <ProgressBar value={c.value / data.byCategory[0].value} color={CHART.tasks} label={`${c.name}: ${c.value}`} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">Completa tareas para ver en qué se te va el tiempo.</p>
          )}
        </Panel>

        <Panel tone="sky">
          <PanelTitle sub="Se usan en el panel de Hoy y en los logros">Tus objetivos</PanelTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <GoalStepper label="Tareas al día" value={goals.dailyTasks} onChange={(v) => updateSettings({ goals: { ...goals, dailyTasks: v } })} max={30} />
            <GoalStepper label="Tareas a la semana" value={goals.weeklyTasks} onChange={(v) => updateSettings({ goals: { ...goals, weeklyTasks: v } })} max={150} />
          </div>
          <div className="mt-4 flex items-center gap-2 text-[13px] text-sky-ink">
            <CalendarDays size={14} /> Esta semana llevas {data.weekDone} de {goals.weeklyTasks}.
          </div>
        </Panel>
      </div>
    </div>
  )
}

export function GoalStepper({ label, value, onChange, max = 100, min = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; max?: number; min?: number; suffix?: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-ink-2">{label}</p>
      <div className="flex h-11 items-center justify-between rounded-ctl bg-card px-1">
        <IconButton label={`Reducir ${label.toLowerCase()}`} size="sm" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
          <span className="text-lg leading-none">−</span>
        </IconButton>
        <span className="display-num text-lg font-semibold" aria-live="polite">
          {value}
          {suffix}
        </span>
        <IconButton label={`Aumentar ${label.toLowerCase()}`} size="sm" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
          <Plus size={15} />
        </IconButton>
      </div>
    </div>
  )
}
