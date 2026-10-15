import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlarmClock, ArrowDown, ArrowDownLeft, ArrowUp, ArrowUpRight, BarChart3, CalendarDays, Dumbbell, EyeOff, Flame, ListPlus, Moon, Play, Plus, Settings2, Sparkles, X } from 'lucide-react'
import type { WidgetId } from '../../types'
import { useStore } from '../../store'
import { openComposer, toast } from '../../store/ui'
import { useToday } from '../../hooks/useToday'
import { useMoney } from '../../hooks/useMoney'
import { Button, IconButton } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Misc'
import { ProgressBar, ProgressRing, Tally } from '../../components/ui/Progress'
import { cx } from '../../components/ui/cx'
import { TaskItem } from '../tasks/TaskItem'
import { PRIORITY_ORDER, isOpen, isOverdue, productivityScore } from '../tasks/logic'
import { WorkoutRow, useWorkoutActions } from '../fitness/workoutActions'
import { currentStreak, longestStreak, productiveDays, sumPoints, totalPoints } from '../gamification/stats'
import { levelFor } from '../gamification/scoring'
import { goalSaved, monthElapsed, totals } from '../finance/calc'
import { useCalendarItems } from '../calendar/items'
import { WIDGET_LABEL } from '../../store/defaults'
import { WEEKDAY_SHORT, addDaysISO, capitalize, dateOf, fmt, greeting, monthEnd, monthStart, relativeDay, weekDays, weekEnd, weekStart } from '../../utils/dates'
import { num, pct, plural } from '../../utils/format'

/* ------------------------------------------------------------------ */
/* Hero: the day, and the week as tally marks                          */
/* ------------------------------------------------------------------ */

function Hero() {
  const t0 = useToday()
  const name = useStore((s) => s.settings.name)
  const tasks = useStore((s) => s.tasks)
  const scheduled = useStore((s) => s.scheduled)
  const sessions = useStore((s) => s.sessions)
  const templates = useStore((s) => s.templates)

  const todayTasks = tasks.filter((t) => t.date === t0)
  const open = todayTasks.filter(isOpen).length
  const overdue = tasks.filter((t) => isOverdue(t, t0)).length
  const workout = scheduled.find((w) => w.date === t0 && w.status === 'planned')
  const wName = workout ? templates.find((t) => t.id === workout.templateId)?.name : null

  const parts: string[] = []
  if (open) parts.push(plural(open, 'tarea pendiente', 'tareas pendientes'))
  if (wName) parts.push(`${wName.toLowerCase()}${workout?.time ? ` a las ${workout.time}` : ''}`)
  const summary = parts.length
    ? `Hoy tienes ${parts.join(' y ')}${overdue ? `, y ${plural(overdue, 'tarea vencida', 'tareas vencidas')} por resolver` : ''}.`
    : overdue
      ? `Nada nuevo para hoy, pero hay ${plural(overdue, 'tarea vencida', 'tareas vencidas')} por resolver.`
      : todayTasks.length
        ? 'Todo lo de hoy está hecho. Buen trabajo.'
        : 'Día despejado. Un buen momento para planificar la semana.'

  const days = weekDays(t0)
  const doneByDay = new Map<string, { t: number; w: number }>()
  for (const d of days) doneByDay.set(d, { t: 0, w: 0 })
  for (const t of tasks) {
    const day = t.status === 'completed' && t.completedAt ? doneByDay.get(dateOf(t.completedAt)) : undefined
    if (day) day.t++
  }
  for (const s of sessions) if (s.status === 'completed' && doneByDay.has(s.date)) doneByDay.get(s.date)!.w++

  return (
    <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end" aria-labelledby="hero-h">
      <div className="min-w-0">
        <p className="text-[15px] text-mute">
          {greeting()}
          {name ? `, ${name}` : ''}
        </p>
        <h1 id="hero-h" className="mt-1 text-[44px] leading-[0.95] font-bold tracking-[-0.035em] sm:text-[64px]" style={{ fontVariationSettings: '"wdth" 80' }}>
          {capitalize(fmt(t0, 'EEEE'))}
          <span className="block text-mute/80">{fmt(t0, "d 'de' MMMM")}</span>
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-snug text-ink-2">{summary}</p>
      </div>
      <div className="rounded-panel border border-line bg-card p-4" aria-label="Tu semana: tareas y entrenos completados por día">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
          {days.map((d, i) => {
            const x = doneByDay.get(d)!
            const future = d > t0
            return (
              <div key={d} className={cx('flex min-w-9 flex-col items-center gap-2 rounded-[12px] px-1 py-2 sm:min-w-11', d === t0 && 'bg-sunken')}>
                <span className={cx('text-[12px] font-semibold', d === t0 ? 'text-ink' : 'text-mute')}>{WEEKDAY_SHORT[i]}</span>
                <div className="flex h-[54px] flex-col items-center justify-end gap-1.5">
                  {x.w > 0 && (
                    <span className="flex gap-0.5" aria-label={`${x.w} entrenos`}>
                      {Array.from({ length: Math.min(x.w, 3) }, (_, k) => (
                        <span key={k} className="size-2 rounded-full bg-sage-ink" />
                      ))}
                    </span>
                  )}
                  {x.t > 0 ? (
                    <Tally count={Math.min(x.t, 10)} color="var(--color-sky-ink)" height={20} label={`${x.t} tareas`} />
                  ) : (
                    <span className={cx('h-[3px] w-4 rounded-full', future ? 'bg-line' : 'bg-line-strong')} aria-hidden />
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex justify-center gap-4 text-[12px] text-mute">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-[3px] rounded-full bg-sky-ink" /> Tareas hechas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-sage-ink" /> Entrenos
          </span>
        </div>
      </div>
    </section>
  )
}

function QuickActions() {
  const navigate = useNavigate()
  const t0 = useToday()
  const actions = [
    { label: 'Nueva tarea', icon: ListPlus, run: () => openComposer({ kind: 'task', date: t0 }), tone: 'bg-sky text-sky-ink' },
    { label: 'Programar entreno', icon: Dumbbell, run: () => openComposer({ kind: 'workout', date: t0 }), tone: 'bg-sage text-sage-ink' },
    { label: 'Registrar gasto', icon: ArrowUpRight, run: () => openComposer({ kind: 'transaction', type: 'expense' }), tone: 'bg-peach text-peach-ink' },
    { label: 'Registrar ingreso', icon: ArrowDownLeft, run: () => openComposer({ kind: 'transaction', type: 'income' }), tone: 'bg-peach text-peach-ink' },
    { label: 'Ver agenda', icon: CalendarDays, run: () => navigate('/agenda'), tone: 'bg-sunken text-ink' },
    { label: 'Estadísticas', icon: BarChart3, run: () => navigate('/logros'), tone: 'bg-lilac text-lilac-ink' },
  ]
  return (
    <nav aria-label="Acciones rápidas" className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.run}
          className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-card pr-4 pl-1.5 text-sm font-medium transition-colors hover:border-line-strong active:scale-[0.98]"
        >
          <span className={cx('grid size-8 place-items-center rounded-full', a.tone)}>
            <a.icon size={16} />
          </span>
          {a.label}
        </button>
      ))}
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/* Widgets                                                             */
/* ------------------------------------------------------------------ */

function FocusWidget() {
  const t0 = useToday()
  const tasks = useStore((s) => s.tasks)
  const scoring = useStore((s) => s.settings.scoring)
  const dailyGoal = useStore((s) => s.settings.goals.dailyTasks)
  const focus = useMemo(() => {
    const overdue = tasks.filter((t) => isOverdue(t, t0))
    const today = tasks.filter((t) => t.date === t0 && isOpen(t))
    return [...overdue, ...today].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.startTime ?? '99').localeCompare(b.startTime ?? '99')).slice(0, 6)
  }, [tasks, t0])
  const todays = tasks.filter((t) => t.date === t0)
  const doneToday = tasks.filter((t) => t.status === 'completed' && t.completedAt && dateOf(t.completedAt) === t0)
  const score = productivityScore(todays, scoring.task)
  const remaining = todays.filter(isOpen).length

  return (
    <Panel className="h-full">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[19px]">¿En qué centrarte hoy?</h2>
          <p className="mt-0.5 text-[13px] text-mute">
            {doneToday.length} hechas, {remaining} por hacer. Objetivo diario: {dailyGoal}.
          </p>
        </div>
        <ProgressRing value={score / 100} size={58} stroke={6} color="var(--color-sky-ink)" label={`Puntuación de productividad de hoy: ${score} de 100`}>
          <span className="num text-[15px] font-semibold">{score}</span>
        </ProgressRing>
      </div>
      {focus.length ? (
        <ul className="-mx-3 divide-y divide-line/70">
          {focus.map((t) => (
            <TaskItem key={t.id} task={t} showDate={t.date !== t0} />
          ))}
        </ul>
      ) : (
        <div className="rounded-[16px] bg-sky/50 px-4 py-6 text-center">
          <p className="font-display text-[17px] font-semibold">{todays.length ? 'Todo listo por hoy' : 'Nada pendiente para hoy'}</p>
          <p className="mt-1 text-sm text-ink-2">{todays.length ? 'Has completado todo lo planificado.' : 'Elige una o dos cosas importantes y empieza por ahí.'}</p>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={() => openComposer({ kind: 'task', date: t0 })}>
          Añadir tarea
        </Button>
        <Link to="/tareas" className="text-[13px] font-medium text-sky-ink hover:underline">
          Ver todas las tareas
        </Link>
      </div>
    </Panel>
  )
}

function WorkoutWidget() {
  const t0 = useToday()
  const scheduled = useStore((s) => s.scheduled)
  const active = useStore((s) => s.sessions.find((x) => x.status === 'active'))
  const todays = scheduled.filter((w) => w.date === t0)
  const next = scheduled.filter((w) => w.date > t0 && w.status === 'planned').sort((a, b) => a.date.localeCompare(b.date))[0]
  const nextTpl = useStore((s) => (next ? s.templates.find((t) => t.id === next.templateId) : undefined))
  const navigate = useNavigate()
  const a = useWorkoutActions()
  const planned = todays.find((w) => w.status === 'planned')
  return (
    <Panel tone="sage" className="h-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px]">Entreno de hoy</h2>
        <Dumbbell size={18} className="text-sage-ink" />
      </div>
      {active ? (
        <>
          <p className="font-display text-xl font-semibold">{active.name}</p>
          <p className="text-sm text-ink-2">En curso</p>
          <Button className="mt-4 w-full" variant="primary" icon={<Play size={15} />} onClick={() => navigate(`/entreno/sesion/${active.id}`)}>
            Continuar
          </Button>
        </>
      ) : todays.length ? (
        <div className="space-y-2">
          {todays.map((w) => (
            <WorkoutRow key={w.id} w={w} compact />
          ))}
          {planned && (
            <Button className="mt-2 w-full" variant="primary" icon={<Play size={15} />} onClick={() => a.start(planned)}>
              Empezar entreno
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="flex items-center gap-2 font-display text-lg font-semibold">
            <Moon size={17} className="text-sage-ink" /> Día de descanso
          </p>
          <p className="mt-1 text-sm text-ink-2">{next && nextTpl ? `Próximo: ${nextTpl.name}, ${relativeDay(next.date, t0).toLowerCase()}.` : 'No tienes entrenos programados.'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" className="bg-white/70" onClick={() => navigate('/entreno?v=recomendador')} icon={<Sparkles size={14} />}>
              Pedir una sesión
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openComposer({ kind: 'workout', date: t0 })}>
              Programar
            </Button>
          </div>
        </>
      )}
    </Panel>
  )
}

function WeekTasksWidget() {
  const t0 = useToday()
  const tasks = useStore((s) => s.tasks)
  const goal = useStore((s) => s.settings.goals.weeklyTasks)
  const ws = weekStart(t0)
  const we = weekEnd(t0)
  const planned = tasks.filter((t) => t.date && t.date >= ws && t.date <= we && t.status !== 'missed')
  const done = tasks.filter((t) => t.status === 'completed' && t.completedAt && dateOf(t.completedAt) >= ws && dateOf(t.completedAt) <= we).length
  const rate = planned.length ? planned.filter((t) => t.status === 'completed').length / planned.length : 0
  return (
    <Panel className="h-full">
      <p className="text-[13px] text-mute">Tareas de la semana</p>
      <div className="mt-2 flex items-center gap-4">
        <ProgressRing value={rate} size={64} stroke={7} color="var(--color-sky-ink)" label={`${pct(rate)} de las tareas de la semana completadas`}>
          <span className="num text-[13px] font-semibold">{pct(rate)}</span>
        </ProgressRing>
        <div>
          <p className="display-num text-[28px] leading-none font-semibold">
            {done}
            <span className="text-base font-normal text-mute"> / {goal}</span>
          </p>
          <p className="mt-1 text-[13px] text-mute">completadas, objetivo semanal</p>
        </div>
      </div>
      <ProgressBar value={done / Math.max(1, goal)} color="var(--color-sky-ink)" className="mt-4" label="Progreso hacia el objetivo semanal de tareas" />
    </Panel>
  )
}

function WeekFitnessWidget() {
  const t0 = useToday()
  const sessions = useStore((s) => s.sessions)
  const goal = useStore((s) => s.settings.goals.weeklyWorkouts)
  const ws = weekStart(t0)
  const done = sessions.filter((s) => s.status === 'completed' && s.date >= ws && s.date <= weekEnd(t0)).length
  const last4 = [3, 2, 1].map((k) => {
    const s = addDaysISO(ws, -7 * k)
    return sessions.filter((x) => x.status === 'completed' && x.date >= s && x.date <= addDaysISO(s, 6)).length
  })
  return (
    <Panel className="h-full">
      <p className="text-[13px] text-mute">Constancia de entreno</p>
      <p className="display-num mt-2 text-[28px] leading-none font-semibold">
        {done}
        <span className="text-base font-normal text-mute"> / {goal} esta semana</span>
      </p>
      <div className="mt-3">
        <Tally count={done} target={goal} color="var(--color-sage-ink)" height={24} label={`${done} de ${goal} entrenos esta semana`} />
      </div>
      <p className="mt-3 text-[13px] text-mute">
        Semanas anteriores: {last4.join(', ')}
      </p>
    </Panel>
  )
}

function PointsWidget() {
  const t0 = useToday()
  const ledger = useStore((s) => s.ledger)
  const total = totalPoints(ledger)
  const lvl = levelFor(total)
  const f = sumPoints(ledger, monthStart(t0), monthEnd(t0), 'fitness')
  const p = sumPoints(ledger, monthStart(t0), monthEnd(t0), 'productivity')
  return (
    <Link to="/logros" className="block h-full rounded-panel bg-lilac p-5 transition-[filter] hover:brightness-[.98]">
      <p className="text-[13px] text-lilac-ink">Puntos y nivel</p>
      <div className="mt-2 flex items-end justify-between">
        <p className="display-num text-[28px] leading-none font-semibold">Nivel {lvl.level}</p>
        <p className="num text-sm text-lilac-ink">{num(total)} pts</p>
      </div>
      <ProgressBar value={lvl.progress} color="var(--color-lilac-ink)" className="mt-3 bg-white/60" label={`Progreso al nivel ${lvl.level + 1}`} />
      <p className="mt-3 text-[13px] text-ink-2">
        Este mes: {num(f)} de fitness y {num(p)} de productividad.
      </p>
    </Link>
  )
}

function StreakWidget() {
  const tasks = useStore((s) => s.tasks)
  const sessions = useStore((s) => s.sessions)
  const days = useMemo(() => productiveDays({ tasks, sessions }), [tasks, sessions])
  const cur = currentStreak(days)
  const best = longestStreak(days)
  return (
    <Panel className="h-full">
      <p className="flex items-center gap-1.5 text-[13px] text-mute">
        <Flame size={14} /> Racha de días productivos
      </p>
      <p className="display-num mt-2 text-[28px] leading-none font-semibold">{plural(cur, 'día', 'días')}</p>
      <div className="mt-3 min-h-6">
        {cur > 0 ? <Tally count={Math.min(cur, 15)} color="var(--color-ink)" height={22} label={`${cur} días seguidos`} /> : <p className="text-sm text-mute">Completa una tarea o un entreno hoy para empezar.</p>}
      </div>
      <p className="mt-2 text-[13px] text-mute">Tu mejor racha: {plural(best, 'día', 'días')}</p>
    </Panel>
  )
}

function MoneyWidget() {
  const t0 = useToday()
  const txs = useStore((s) => s.transactions)
  const m = useMoney()
  const t = totals(txs, t0, t0)
  const count = txs.filter((x) => x.date === t0).length
  return (
    <Panel className="h-full">
      <p className="text-[13px] text-mute">Movimientos de hoy</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[12.5px] text-mute">Ingresos</p>
          <p className="display-num text-xl font-semibold text-ok">{m(t.income)}</p>
        </div>
        <div>
          <p className="text-[12.5px] text-mute">Gastos</p>
          <p className="display-num text-xl font-semibold">{m(t.expense)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[13px] text-mute">{plural(count, 'movimiento', 'movimientos')}</span>
        <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => openComposer({ kind: 'transaction', type: 'expense' })}>
          Gasto
        </Button>
      </div>
    </Panel>
  )
}

function BudgetWidget() {
  const t0 = useToday()
  const txs = useStore((s) => s.transactions)
  const budget = useStore((s) => s.budget)
  const m = useMoney()
  const spent = totals(txs, monthStart(t0), monthEnd(t0)).expense
  const limit = budget.monthlyTotal
  return (
    <Panel tone="peach" className="h-full">
      <p className="text-[13px] text-peach-ink">Gasto del mes</p>
      <p className="display-num mt-2 text-[28px] leading-none font-semibold">{m(spent)}</p>
      {limit ? (
        <>
          <ProgressBar value={spent / limit} marker={monthElapsed(t0)} color={spent > limit ? 'var(--color-danger)' : 'var(--color-peach-ink)'} className="mt-3 bg-white/60" label="Gasto frente a presupuesto" />
          <p className="mt-2 text-[13px] text-ink-2">{spent > limit ? `${m(spent - limit)} por encima del presupuesto` : `Quedan ${m(limit - spent)} de ${m(limit)}`}</p>
        </>
      ) : (
        <Link to="/finanzas?v=presupuesto" className="mt-3 inline-block text-[13px] font-medium text-peach-ink hover:underline">
          Define un presupuesto mensual
        </Link>
      )}
    </Panel>
  )
}

function GoalsWidget() {
  const goals = useStore((s) => s.goals)
  const m = useMoney()
  return (
    <Panel className="h-full">
      <p className="text-[13px] text-mute">Metas de ahorro</p>
      {goals.length ? (
        <ul className="mt-3 space-y-3">
          {goals.slice(0, 3).map((g) => {
            const saved = goalSaved(g)
            return (
              <li key={g.id}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{g.name}</span>
                  <span className="num shrink-0 text-mute">{pct(saved / g.target)}</span>
                </div>
                <ProgressBar value={saved / g.target} color="var(--color-peach-ink)" label={`${g.name}: ${m(saved)} de ${m(g.target)}`} />
              </li>
            )
          })}
        </ul>
      ) : (
        <Link to="/finanzas?v=metas" className="mt-3 inline-block text-[13px] font-medium text-peach-ink hover:underline">
          Crea tu primera meta de ahorro
        </Link>
      )}
    </Panel>
  )
}

function UpcomingWidget() {
  const t0 = useToday()
  const items = useCalendarItems(addDaysISO(t0, 1), addDaysISO(t0, 7)).filter((i) => !i.done && !(i.kind === 'workout' && i.skipped))
  const tasks = useStore((s) => s.tasks)
  const deadlines = useMemo(() => tasks.filter((t) => isOpen(t) && t.deadline && t.deadline >= t0 && t.deadline <= addDaysISO(t0, 7)), [tasks, t0])
  return (
    <Panel className="h-full">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] text-mute">Próximos 7 días</p>
        <Link to="/agenda" className="text-[13px] font-medium text-ink hover:underline">
          Agenda
        </Link>
      </div>
      {deadlines.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {deadlines.slice(0, 3).map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm text-danger">
              <AlarmClock size={14} className="shrink-0" />
              <span className="truncate">{t.title}</span>
              <span className="ml-auto shrink-0 text-[12.5px]">{relativeDay(t.deadline!, t0)}</span>
            </li>
          ))}
        </ul>
      )}
      {items.length ? (
        <ul className="space-y-1.5">
          {items.slice(0, 6).map((i) => (
            <li key={i.key} className="flex items-center gap-2 text-sm">
              <span className={cx('h-4 w-[3px] shrink-0 rounded-full', i.kind === 'workout' ? 'bg-sage-ink' : i.kind === 'deadline' ? 'bg-danger' : 'bg-sky-ink')} aria-hidden />
              <span className="truncate">{i.title}</span>
              <span className="ml-auto shrink-0 text-[12.5px] text-mute">{relativeDay(i.date, t0)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-mute">Nada programado para los próximos días.</p>
      )}
    </Panel>
  )
}

const WIDGETS: Record<WidgetId, { render: () => ReactNode; span?: string }> = {
  focus: { render: () => <FocusWidget />, span: 'md:col-span-2 lg:row-span-2' },
  workout: { render: () => <WorkoutWidget /> },
  weekTasks: { render: () => <WeekTasksWidget /> },
  weekFitness: { render: () => <WeekFitnessWidget /> },
  points: { render: () => <PointsWidget /> },
  streak: { render: () => <StreakWidget /> },
  money: { render: () => <MoneyWidget /> },
  budget: { render: () => <BudgetWidget /> },
  goals: { render: () => <GoalsWidget /> },
  upcoming: { render: () => <UpcomingWidget /> },
}

export default function DashboardPage() {
  const layout = useStore((s) => s.settings.dashboard)
  const updateSettings = useStore((s) => s.updateSettings)
  const [editing, setEditing] = useState(false)
  const visible = layout.order.filter((id) => !layout.hidden.includes(id) && WIDGETS[id])
  const hidden = layout.order.filter((id) => layout.hidden.includes(id))

  const move = (id: WidgetId, dir: -1 | 1) => {
    const order = [...layout.order]
    const vis = order.filter((x) => !layout.hidden.includes(x))
    const i = vis.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= vis.length) return
    const a = order.indexOf(vis[i])
    const b = order.indexOf(vis[j])
    ;[order[a], order[b]] = [order[b], order[a]]
    updateSettings({ dashboard: { ...layout, order } })
  }

  return (
    <>
      <Hero />
      <QuickActions />
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] text-mute">Tu panel</h2>
        <Button size="sm" variant={editing ? 'primary' : 'ghost'} icon={<Settings2 size={15} />} onClick={() => setEditing((e) => !e)}>
          {editing ? 'Listo' : 'Personalizar'}
        </Button>
      </div>
      <div className="grid auto-rows-auto gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((id, i) => (
          <div key={id} className={cx('relative min-w-0', WIDGETS[id].span, editing && 'rounded-panel ring-2 ring-dashed ring-line-strong ring-offset-4 ring-offset-paper')}>
            {WIDGETS[id].render()}
            {editing && (
              <div className="absolute top-2 right-2 z-10 flex gap-0.5 rounded-full border border-line bg-card p-0.5 shadow-lift">
                <IconButton size="sm" label={`Subir ${WIDGET_LABEL[id]}`} disabled={i === 0} onClick={() => move(id, -1)}>
                  <ArrowUp size={14} />
                </IconButton>
                <IconButton size="sm" label={`Bajar ${WIDGET_LABEL[id]}`} disabled={i === visible.length - 1} onClick={() => move(id, 1)}>
                  <ArrowDown size={14} />
                </IconButton>
                <IconButton
                  size="sm"
                  label={`Ocultar ${WIDGET_LABEL[id]}`}
                  onClick={() => {
                    updateSettings({ dashboard: { ...layout, hidden: [...layout.hidden, id] } })
                    toast(`«${WIDGET_LABEL[id]}» oculto`)
                  }}
                >
                  <EyeOff size={14} />
                </IconButton>
              </div>
            )}
          </div>
        ))}
      </div>
      {editing && hidden.length > 0 && (
        <div className="mt-5 rounded-panel border border-dashed border-line-strong p-4">
          <p className="mb-2 text-sm text-mute">Ocultos</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((id) => (
              <Button key={id} size="sm" icon={<Plus size={14} />} onClick={() => updateSettings({ dashboard: { ...layout, hidden: layout.hidden.filter((x) => x !== id) } })}>
                {WIDGET_LABEL[id]}
              </Button>
            ))}
          </div>
        </div>
      )}
      {editing && (
        <p className="mt-3 flex items-center gap-1.5 text-[13px] text-mute">
          <X size={13} /> Ocultar un bloque no borra ningún dato.
        </p>
      )}
    </>
  )
}
