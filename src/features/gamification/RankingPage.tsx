import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Award, ChevronLeft, ChevronRight, Dumbbell, Flame, ListChecks, Lock, Medal, Scale } from 'lucide-react'
import { useStore } from '../../store'
import { useToday } from '../../hooks/useToday'
import { IconButton } from '../../components/ui/Button'
import { Badge, EmptyState, PageHeader, Panel, PanelTitle, Stat } from '../../components/ui/Misc'
import { ProgressBar, ProgressRing, Tally } from '../../components/ui/Progress'
import { cx } from '../../components/ui/cx'
import { ChartFrame, ChartTooltip, CHART, Legend, axisProps } from '../../components/charts'
import { ACHIEVEMENTS, currentStreak, longestStreak, pointsByMonth, productiveDays, sumPoints, totalPoints, weeklyBreakdown } from './stats'
import { levelFor, levelThreshold, levelTitle } from './scoring'
import { addMonthsISO, capitalize, dateOf, fmt, monthEnd, monthStart, relativeDay } from '../../utils/dates'
import { num } from '../../utils/format'

/**
 * Points, levels, achievements and the monthly ranking.
 * Reads only tasks, workout sessions and the points ledger — never finance data.
 */
export default function RankingPage() {
  const t0 = useToday()
  const [anchor, setAnchor] = useState(monthStart(t0))
  const ledger = useStore((s) => s.ledger)
  const tasks = useStore((s) => s.tasks)
  const sessions = useStore((s) => s.sessions)
  const unlocked = useStore((s) => s.achievements)
  const goals = useStore((s) => s.settings.goals)

  const ms = monthStart(anchor)
  const me = monthEnd(anchor)
  const prevMs = monthStart(addMonthsISO(anchor, -1))
  const fitness = sumPoints(ledger, ms, me, 'fitness')
  const productivity = sumPoints(ledger, ms, me, 'productivity')
  const combined = fitness + productivity
  const prevCombined = sumPoints(ledger, prevMs, monthEnd(prevMs))
  const total = totalPoints(ledger)
  const lvl = levelFor(total)

  const data = useMemo(() => {
    const days = productiveDays({ tasks, sessions })
    const monthDays = [...days].filter((d) => d >= ms && d <= me).length
    const weeks = weeklyBreakdown(ledger, ms, me).map((w) => ({ ...w, label: `${fmt(w.start, 'd')}–${fmt(w.end, 'd MMM')}` }))
    const byMonth = pointsByMonth(ledger)
    const ranking = [...byMonth]
      .map(([k, v]) => ({ key: k, fitness: Math.max(0, v.fitness), productivity: Math.max(0, v.productivity), total: Math.max(0, v.fitness + v.productivity) }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total)
    const year = ms.slice(0, 4)
    const yearly = Array.from({ length: 12 }, (_, i) => {
      const k = `${year}-${String(i + 1).padStart(2, '0')}`
      const v = byMonth.get(k)
      return { key: k, label: capitalize(fmt(`${k}-01`, 'MMM')), fitness: Math.max(0, v?.fitness ?? 0), productivity: Math.max(0, v?.productivity ?? 0) }
    })
    // Milestones
    const perDay = new Map<string, number>()
    for (const e of ledger) perDay.set(e.date, (perDay.get(e.date) ?? 0) + e.points)
    const bestDay = [...perDay].sort((a, b) => b[1] - a[1])[0]
    const tasksDone = tasks.filter((t) => t.status === 'completed').length
    const workoutsDone = sessions.filter((s) => s.status === 'completed').length
    const monthTasks = tasks.filter((t) => t.status === 'completed' && t.completedAt && dateOf(t.completedAt) >= ms && dateOf(t.completedAt) <= me).length
    const monthWorkouts = sessions.filter((s) => s.status === 'completed' && s.date >= ms && s.date <= me).length
    const history = ledger.filter((e) => e.date >= ms && e.date <= me).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return {
      current: currentStreak(days, t0),
      longest: longestStreak(days),
      monthDays,
      weeks,
      ranking,
      yearly,
      bestDay,
      tasksDone,
      workoutsDone,
      monthTasks,
      monthWorkouts,
      history,
    }
  }, [ledger, tasks, sessions, ms, me, t0])

  const rank = data.ranking.findIndex((r) => r.key === ms.slice(0, 7)) + 1
  const goalRatio = combined / Math.max(1, goals.monthlyPoints)
  const unlockedMap = new Map(unlocked.map((u) => [u.id, u.unlockedAt]))
  const achInput = { tasks, sessions, ledger }
  const isCurrent = ms === monthStart(t0)

  return (
    <>
      <PageHeader title="Logros" sub="Tu constancia en entreno y tareas, mes a mes. Sin datos de dinero.">
        <div className="flex items-center gap-1">
          <IconButton label="Mes anterior" onClick={() => setAnchor(addMonthsISO(ms, -1))}>
            <ChevronLeft size={18} />
          </IconButton>
          <h2 className="min-w-40 text-center text-xl" aria-live="polite">
            {capitalize(fmt(ms, 'MMMM yyyy'))}
          </h2>
          <IconButton label="Mes siguiente" onClick={() => setAnchor(addMonthsISO(ms, 1))} disabled={isCurrent}>
            <ChevronRight size={18} />
          </IconButton>
        </div>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Panel tone="lilac" className="relative overflow-hidden">
          <div className="flex flex-wrap items-center gap-6">
            <div className="relative">
              <ProgressRing value={goalRatio} size={168} stroke={14} color="var(--color-lilac-ink)" track="rgb(255 255 255 / .65)" label={`${combined} de ${goals.monthlyPoints} puntos del objetivo mensual`}>
                <div>
                  <p className="display-num text-[44px] leading-none font-semibold">{num(combined)}</p>
                  <p className="text-[12.5px] text-lilac-ink">de {num(goals.monthlyPoints)}</p>
                </div>
              </ProgressRing>
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-sm text-lilac-ink">Puntos de actividad del mes</p>
                <p className="mt-1 text-[15px] text-ink-2">
                  {goalRatio >= 1
                    ? 'Objetivo mensual conseguido.'
                    : isCurrent
                      ? `Te faltan ${num(goals.monthlyPoints - combined)} puntos para el objetivo del mes.`
                      : `Te quedaste a ${num(goals.monthlyPoints - combined)} puntos del objetivo.`}
                </p>
              </div>
              <div className="space-y-2.5">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <Dumbbell size={14} /> Fitness
                    </span>
                    <span className="num font-semibold">{num(fitness)}</span>
                  </div>
                  <ProgressBar value={combined ? fitness / combined : 0} color={CHART.fitness} className="bg-white/60" label={`Fitness: ${fitness} puntos`} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <ListChecks size={14} /> Productividad
                    </span>
                    <span className="num font-semibold">{num(productivity)}</span>
                  </div>
                  <ProgressBar value={combined ? productivity / combined : 0} color={CHART.tasks} className="bg-white/60" label={`Productividad: ${productivity} puntos`} />
                </div>
              </div>
              <p className="text-[13px] text-ink-2">
                {prevCombined ? (
                  <>
                    {combined >= prevCombined ? '▲' : '▼'} {num(Math.abs(combined - prevCombined))} puntos respecto a {fmt(prevMs, 'MMMM')}
                  </>
                ) : (
                  `Sin puntos en ${fmt(prevMs, 'MMMM')} para comparar.`
                )}
                {rank > 0 && `. Puesto ${rank} de ${data.ranking.length} en tus meses.`}
              </p>
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-mute">Nivel</p>
              <p className="display-num text-[48px] leading-none font-semibold">{lvl.level}</p>
              <p className="mt-1 font-display text-[17px] font-semibold text-lilac-ink">{levelTitle(lvl.level)}</p>
            </div>
            <Medal size={28} className="text-lilac-mid" />
          </div>
          <div className="mt-5">
            <ProgressBar value={lvl.progress} color="var(--color-lilac-ink)" label={`Progreso al nivel ${lvl.level + 1}`} />
            <p className="mt-1.5 text-[13px] text-mute">
              {num(total)} puntos acumulados. Nivel {lvl.level + 1} a los {num(levelThreshold(lvl.level + 1))}.
            </p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
            <div>
              <p className="flex items-center gap-1.5 text-[13px] text-mute">
                <Flame size={14} /> Racha actual
              </p>
              <p className="display-num text-2xl font-semibold">{data.current} días</p>
              <Tally count={Math.min(data.current, 20)} color="var(--color-lilac-ink)" height={16} label={`Racha de ${data.current} días`} />
            </div>
            <div>
              <p className="text-[13px] text-mute">Mejor racha</p>
              <p className="display-num text-2xl font-semibold">{data.longest} días</p>
              <p className="text-[12.5px] text-mute">{data.monthDays} días activos este mes</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelTitle action={<Legend items={[{ label: 'Fitness', color: CHART.fitness }, { label: 'Productividad', color: CHART.tasks }]} />}>Semana a semana</PanelTitle>
          {combined > 0 ? (
            <ChartFrame
              summary={`Puntos por semana en ${fmt(ms, 'MMMM')}: ${data.weeks.map((w) => `${w.label}: ${w.fitness} de fitness y ${w.productivity} de productividad`).join('; ')}.`}
              table={{ head: ['Semana', 'Fitness', 'Productividad'], rows: data.weeks.map((w) => [w.label, w.fitness, w.productivity]) }}
            >
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={data.weeks} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barGap={2}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis allowDecimals={false} {...axisProps} />
                    <Tooltip cursor={{ fill: 'rgba(37,42,46,.04)' }} content={<ChartTooltip format={(v) => `${v} pts`} />} />
                    <Bar dataKey="fitness" name="Fitness" fill={CHART.fitness} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="productivity" name="Productividad" fill={CHART.tasks} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartFrame>
          ) : (
            <EmptyState title="Sin puntos este mes" body="Completa tareas o entrenos y verás aquí cómo se reparten por semanas." className="py-8" />
          )}
        </Panel>

        <Panel>
          <PanelTitle sub="Tus meses ordenados por puntos de actividad">Clasificación de tus meses</PanelTitle>
          {data.ranking.length ? (
            <ol className="space-y-1">
              {data.ranking.slice(0, 6).map((r, i) => {
                const sel = r.key === ms.slice(0, 7)
                return (
                  <li key={r.key}>
                    <button
                      type="button"
                      onClick={() => setAnchor(`${r.key}-01`)}
                      className={cx('flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left transition-colors', sel ? 'bg-lilac' : 'hover:bg-sunken')}
                    >
                      <span className={cx('num grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold', i === 0 ? 'bg-lilac-ink text-white' : 'bg-sunken text-ink-2')}>{i + 1}</span>
                      <span className="flex-1 font-medium">{capitalize(fmt(`${r.key}-01`, 'MMMM yyyy'))}</span>
                      <span className="num text-[12.5px] text-mute">
                        {r.fitness} + {r.productivity}
                      </span>
                      <span className="num w-14 text-right font-semibold">{num(r.total)}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="text-sm text-mute">Cuando acumules puntos, tus meses aparecerán aquí ordenados.</p>
          )}
        </Panel>
      </div>

      <section className="mt-8" aria-labelledby="ach-h">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="ach-h" className="text-[22px]">
            Logros
          </h2>
          <span className="text-sm text-mute">
            {unlocked.length} de {ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const at = unlockedMap.get(a.id)
            const progress = a.progress(achInput, goals)
            const Icon = a.category === 'fitness' ? Dumbbell : a.category === 'productivity' ? ListChecks : Scale
            return (
              <article key={a.id} className={cx('flex gap-3 rounded-[18px] border p-4', at ? 'border-lilac-mid/60 bg-lilac/60' : 'border-line bg-card')}>
                <span className={cx('grid size-11 shrink-0 place-items-center rounded-full', at ? 'bg-lilac-ink text-white' : 'bg-sunken text-faint')}>{at ? <Award size={20} /> : <Lock size={17} />}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-display text-[15.5px] font-semibold">
                    {a.title}
                    <Icon size={13} className="text-mute" aria-hidden />
                  </p>
                  <p className="text-[13px] text-ink-2">{a.description}</p>
                  {at ? (
                    <p className="mt-1.5 text-[12.5px] text-lilac-ink">Conseguido {relativeDay(dateOf(at), t0).toLowerCase()}</p>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar value={progress} color="var(--color-lilac-ink)" className="flex-1" label={`${Math.round(progress * 100)} % de ${a.title}`} />
                      <span className="num text-[12px] text-mute">{Math.round(progress * 100)} %</span>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelTitle action={<Legend items={[{ label: 'Fitness', color: CHART.fitness }, { label: 'Productividad', color: CHART.tasks }]} />} sub={`Puntos por mes en ${ms.slice(0, 4)}`}>
            Historial anual
          </PanelTitle>
          <ChartFrame
            summary={`Puntos por mes en ${ms.slice(0, 4)}.`}
            table={{ head: ['Mes', 'Fitness', 'Productividad'], rows: data.yearly.map((y) => [y.label, y.fitness, y.productivity]) }}
          >
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.yearly} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} />
                  <Tooltip cursor={{ fill: 'rgba(37,42,46,.04)' }} content={<ChartTooltip format={(v) => `${v} pts`} />} />
                  <Bar dataKey="fitness" stackId="a" name="Fitness" fill={CHART.fitness} stroke="#fff" strokeWidth={1} maxBarSize={26} />
                  <Bar dataKey="productivity" stackId="a" name="Productividad" fill={CHART.tasks} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartFrame>
        </Panel>
        <Panel>
          <PanelTitle>Hitos personales</PanelTitle>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Tareas este mes" value={data.monthTasks} sub={`${num(data.tasksDone)} en total`} />
            <Stat label="Entrenos este mes" value={data.monthWorkouts} sub={`${num(data.workoutsDone)} en total`} />
            <Stat label="Mejor día" value={data.bestDay ? `${data.bestDay[1]} pts` : '—'} sub={data.bestDay ? capitalize(fmt(data.bestDay[0], "d 'de' MMMM yyyy")) : undefined} />
            <Stat label="Mejor mes" value={data.ranking[0] ? `${num(data.ranking[0].total)} pts` : '—'} sub={data.ranking[0] ? capitalize(fmt(`${data.ranking[0].key}-01`, 'MMMM yyyy')) : undefined} />
          </div>
        </Panel>
      </div>

      <Panel className="mt-5">
        <PanelTitle sub="Cada punto ganado o retirado queda anotado. Sirve para comprobar que nada se ha contado dos veces.">Registro de puntos</PanelTitle>
        {data.history.length ? (
          <details>
            <summary className="cursor-pointer text-sm text-mute hover:text-ink">Ver los {data.history.length} movimientos de {fmt(ms, 'MMMM')}</summary>
            <ul className="mt-3 max-h-96 divide-y divide-line/70 overflow-y-auto">
              {data.history.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-20 shrink-0 text-[12.5px] text-mute">{fmt(e.date, 'd MMM')}</span>
                  <span className="min-w-0 flex-1 truncate">{e.reason}</span>
                  {e.kind !== 'award' && <Badge>{e.kind === 'reversal' ? 'Retirada' : 'Recálculo'}</Badge>}
                  <span className={cx('num w-12 shrink-0 text-right font-semibold', e.points < 0 ? 'text-danger' : e.category === 'fitness' ? 'text-sage-ink' : 'text-sky-ink')}>
                    {e.points > 0 ? '+' : ''}
                    {e.points}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="text-sm text-mute">Sin movimientos de puntos en este mes.</p>
        )}
      </Panel>
    </>
  )
}
