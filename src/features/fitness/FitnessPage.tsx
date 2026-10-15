import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarPlus, Check as CheckIcon, ChevronLeft, ChevronRight, Clock, Copy, Dumbbell, Flame, History, Pencil, Play, Plus, Repeat, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { WorkoutRow, useWorkoutActions } from './workoutActions'
import type { Equipment, Exercise, MuscleGroup, Objective, WorkoutTemplate } from '../../types'
import { useStore } from '../../store'
import { confirm, openComposer, toast } from '../../store/ui'
import { useParamState } from '../../hooks/useParamState'
import { useToday } from '../../hooks/useToday'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge, EmptyState, Menu, PageHeader, Panel, PanelTitle, Stat, Tabs } from '../../components/ui/Misc'
import { Chips, Field, Segmented, Select } from '../../components/ui/Form'
import { ProgressBar, Tally } from '../../components/ui/Progress'
import { cx } from '../../components/ui/cx'
import { ChartFrame, ChartTooltip, CHART, axisProps } from '../../components/charts'
import { EMPTY_FILTER, ExerciseDetail, ExerciseForm, LibraryFilters, TemplateEditor, filterExercises, useExercises, type LibraryFilter } from './forms'
import { EQUIPMENT, EQUIPMENT_LABEL, LEVEL_LABEL, MUSCLES, MUSCLE_LABEL, OBJECTIVES, OBJECTIVE_LABEL } from './labels'
import { recommend, type Ease } from './recommend'
import { completedIn, muscleSetCounts, personalRecords, sessionVolume, setsDone, weightProgress } from './stats'
import { INTENSITY_LABEL } from '../gamification/scoring'
import { netForSource } from '../gamification/scoring'
import { WEEKDAY_NAMES, addDaysISO, capitalize, fmt, monthEnd, monthStart, relativeDay, weekDays, weekEnd, weekStart } from '../../utils/dates'
import { duration, num } from '../../utils/format'

const VIEWS = ['plan', 'rutinas', 'recomendador', 'biblioteca', 'historial', 'progreso'] as const
type View = (typeof VIEWS)[number]

export default function FitnessPage() {
  const [view, setView] = useParamState<View>('v', 'plan', VIEWS)
  const active = useStore((s) => s.sessions.find((x) => x.status === 'active'))
  const navigate = useNavigate()
  return (
    <>
      <PageHeader
        title="Entreno"
        sub="Planifica la semana, registra cada serie y mira cómo progresas."
        actions={
          <>
            <Button icon={<CalendarPlus size={17} />} onClick={() => openComposer({ kind: 'workout' })}>
              Programar
            </Button>
            <Button
              variant="primary"
              icon={<Play size={16} />}
              onClick={() => {
                if (active) return navigate(`/entreno/sesion/${active.id}`)
                navigate(`/entreno/sesion/${useStore.getState().startSession({ adhoc: { name: 'Entreno libre', intensity: 'standard', plan: [] } })}`)
              }}
            >
              {active ? 'Continuar entreno' : 'Entreno libre'}
            </Button>
          </>
        }
      >
        <Tabs
          label="Secciones de entreno"
          value={view}
          onChange={setView}
          tabs={[
            { value: 'plan', label: 'Semana' },
            { value: 'rutinas', label: 'Rutinas' },
            { value: 'recomendador', label: 'Recomendador' },
            { value: 'biblioteca', label: 'Ejercicios' },
            { value: 'historial', label: 'Historial' },
            { value: 'progreso', label: 'Progreso' },
          ]}
        />
      </PageHeader>
      {active && view !== 'plan' && (
        <button
          type="button"
          onClick={() => navigate(`/entreno/sesion/${active.id}`)}
          className="mb-5 flex w-full items-center gap-3 rounded-[16px] bg-sage px-4 py-3 text-left text-sage-ink"
        >
          <Flame size={18} />
          <span className="flex-1 text-sm font-medium">Tienes «{active.name}» en curso</span>
          <span className="text-sm font-semibold">Continuar</span>
        </button>
      )}
      {view === 'plan' && <PlanView />}
      {view === 'rutinas' && <RoutinesView />}
      {view === 'recomendador' && <RecommendView />}
      {view === 'biblioteca' && <LibraryView />}
      {view === 'historial' && <HistoryView />}
      {view === 'progreso' && <ProgressView />}
    </>
  )
}

/* ------------------------------------------------------------------ */

function PlanView() {
  const t0 = useToday()
  const [anchor, setAnchor] = useState(t0)
  const scheduled = useStore((s) => s.scheduled)
  const sessions = useStore((s) => s.sessions)
  const series = useStore((s) => s.workoutSeries)
  const templates = useStore((s) => s.templates)
  const goal = useStore((s) => s.settings.goals.weeklyWorkouts)
  const active = sessions.find((x) => x.status === 'active')
  const navigate = useNavigate()
  const days = weekDays(anchor)
  const doneThisWeek = completedIn(sessions, weekStart(anchor), weekEnd(anchor))

  return (
    <div className="space-y-6">
      {active && (
        <Panel tone="sage" className="flex flex-wrap items-center gap-4">
          <Flame className="text-sage-ink" />
          <div className="flex-1">
            <p className="font-display text-lg font-semibold">{active.name}</p>
            <p className="text-sm text-ink-2">Entreno en curso, {setsDone(active)} series hechas</p>
          </div>
          <Button variant="primary" onClick={() => navigate(`/entreno/sesion/${active.id}`)}>
            Continuar
          </Button>
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <IconButton label="Semana anterior" onClick={() => setAnchor(addDaysISO(anchor, -7))}>
                <ChevronLeft size={18} />
              </IconButton>
              <h2 className="text-lg">
                {fmt(weekStart(anchor), 'd MMM')} – {fmt(weekEnd(anchor), 'd MMM')}
              </h2>
              <IconButton label="Semana siguiente" onClick={() => setAnchor(addDaysISO(anchor, 7))}>
                <ChevronRight size={18} />
              </IconButton>
            </div>
            {weekStart(anchor) !== weekStart(t0) && (
              <Button size="sm" onClick={() => setAnchor(t0)}>
                Esta semana
              </Button>
            )}
          </div>
          <ol className="divide-y divide-line rounded-panel border border-line bg-card">
            {days.map((d) => {
              const list = scheduled.filter((w) => w.date === d)
              const extra = sessions.filter((s) => s.status === 'completed' && s.date === d && !s.scheduledId)
              return (
                <li key={d} className={cx('grid gap-2 px-3 py-3 sm:grid-cols-[120px_1fr] sm:items-center', d === t0 && 'bg-sage/25')}>
                  <div className="flex items-center justify-between sm:block">
                    <p className={cx('font-medium', d === t0 && 'text-sage-ink')}>{capitalize(fmt(d, 'EEEE'))}</p>
                    <p className="num text-[12.5px] text-mute">{fmt(d, "d 'de' MMM")}</p>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    {list.map((w) => (
                      <WorkoutRow key={w.id} w={w} />
                    ))}
                    {extra.map((s) => (
                      <button key={s.id} type="button" onClick={() => navigate(`/entreno/sesion/${s.id}`)} className="flex items-center gap-3 rounded-[14px] bg-sage/60 p-2.5 text-left">
                        <span className="grid size-9 place-items-center rounded-full bg-sage-ink text-white">
                          <CheckIcon size={16} />
                        </span>
                        <span className="text-[14.5px] font-medium">{s.name}</span>
                        <span className="ml-auto pr-2 text-[12.5px] text-mute">{duration(s.durationMin ?? 0)}</span>
                      </button>
                    ))}
                    {!list.length && !extra.length && (
                      <div className="flex items-center justify-between gap-2 px-1">
                        <span className="text-sm text-mute">Descanso</span>
                        <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => openComposer({ kind: 'workout', date: d })}>
                          Programar
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        <aside className="space-y-4">
          <Panel tone="sage">
            <p className="text-sm text-sage-ink">Entrenos esta semana</p>
            <p className="display-num mt-1 text-[40px] leading-none font-semibold">
              {doneThisWeek.length}
              <span className="text-xl text-sage-ink"> / {goal}</span>
            </p>
            <div className="mt-3">
              <Tally count={doneThisWeek.length} target={goal} color="var(--color-sage-ink)" height={26} label={`${doneThisWeek.length} de ${goal} entrenos`} />
            </div>
            <p className="mt-3 text-sm text-ink-2">
              {doneThisWeek.length >= goal ? 'Objetivo semanal cumplido. Recuperar bien también cuenta.' : `Te faltan ${goal - doneThisWeek.length} para tu objetivo semanal.`}
            </p>
          </Panel>
          <Panel>
            <PanelTitle sub="Rutinas que se repiten cada semana">Planes semanales</PanelTitle>
            {series.length ? (
              <ul className="space-y-2">
                {series.map((s) => (
                  <li key={s.id} className="flex items-start gap-2 text-sm">
                    <Repeat size={15} className="mt-0.5 shrink-0 text-sage-ink" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{templates.find((t) => t.id === s.templateId)?.name ?? 'Rutina'}</p>
                      <p className="text-[12.5px] text-mute">
                        {s.weekdays
                          .sort()
                          .map((d) => WEEKDAY_NAMES[d - 1].toLowerCase())
                          .join(', ')}
                        {s.time ? ` a las ${s.time}` : ''}
                      </p>
                    </div>
                    <IconButton
                      size="sm"
                      label="Detener plan"
                      onClick={async () => {
                        const ok = await confirm({ title: 'Detener plan semanal', body: 'Se quitan los entrenos futuros de este plan. Los ya hechos se conservan.', confirmLabel: 'Detener', tone: 'danger' })
                        if (!ok) return
                        useStore.getState().stopWorkoutSeries(s.id)
                        toast('Plan detenido')
                      }}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mute">Programa una rutina y marca «Repetir cada semana» para organizar tu semana por días.</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function RoutinesView() {
  const templates = useStore((s) => s.templates)
  const { byId } = useExercises()
  const [editing, setEditing] = useState<WorkoutTemplate | 'new' | null>(null)
  const a = useWorkoutActions()
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
          Nueva rutina
        </Button>
      </div>
      {templates.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <article key={t.id} className="flex flex-col rounded-panel border border-line bg-card p-5 transition-shadow hover:shadow-lift">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-lg">{t.name}</h3>
                  <p className="text-[13px] text-mute">{t.focus.map((f) => MUSCLE_LABEL[f]).join(', ')}</p>
                </div>
                <Menu
                  label={`Opciones de ${t.name}`}
                  items={[
                    { label: 'Editar', icon: <Pencil size={15} />, onSelect: () => setEditing(t) },
                    { label: 'Programar', icon: <CalendarPlus size={15} />, onSelect: () => openComposer({ kind: 'workout', templateId: t.id }) },
                    {
                      label: 'Duplicar',
                      icon: <Copy size={15} />,
                      onSelect: () => {
                        const { id: _id, createdAt: _c, demo: _d, ...rest } = t
                        useStore.getState().saveTemplate({ ...rest, name: `${t.name} (copia)` })
                        toast('Rutina duplicada')
                      },
                    },
                    {
                      label: 'Eliminar',
                      icon: <Trash2 size={15} />,
                      danger: true,
                      onSelect: async () => {
                        const ok = await confirm({ title: `Eliminar «${t.name}»`, body: 'También se quitan los entrenos futuros programados con esta rutina. El historial se conserva.', confirmLabel: 'Eliminar', tone: 'danger' })
                        if (!ok) return
                        useStore.getState().deleteTemplate(t.id)
                        toast('Rutina eliminada')
                      },
                    },
                  ]}
                />
              </div>
              <div className="mb-4 flex flex-wrap gap-1.5">
                <Badge tone="sage">{INTENSITY_LABEL[t.intensity]}</Badge>
                <Badge>
                  <Clock size={12} /> {duration(t.estimatedMin)}
                </Badge>
                <Badge>{OBJECTIVE_LABEL[t.objective]}</Badge>
              </div>
              <ol className="mb-4 space-y-1 text-sm text-ink-2">
                {t.exercises.slice(0, 5).map((p, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{byId.get(p.exerciseId)?.name ?? 'Ejercicio'}</span>
                    <span className="num shrink-0 text-mute">
                      {p.sets}×{p.reps}
                    </span>
                  </li>
                ))}
                {t.exercises.length > 5 && <li className="text-mute">y {t.exercises.length - 5} más</li>}
              </ol>
              <div className="mt-auto flex gap-2">
                <Button size="sm" variant="primary" icon={<Play size={14} />} onClick={() => a.startTemplate(t)}>
                  Empezar
                </Button>
                <Button size="sm" icon={<CalendarPlus size={14} />} onClick={() => openComposer({ kind: 'workout', templateId: t.id })}>
                  Programar
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Dumbbell size={20} />}
          title="Aún no tienes rutinas"
          body="Crea una rutina con tus ejercicios o pide una al recomendador según el tiempo y el material que tengas."
          action={
            <Button variant="primary" onClick={() => setEditing('new')}>
              Crear rutina
            </Button>
          }
        />
      )}
      {editing && <TemplateEditor template={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */

const FOCUS_OPTIONS: { value: MuscleGroup | 'any'; label: string }[] = [
  { value: 'any', label: 'Lo que más me convenga' },
  { value: 'full_body', label: 'Cuerpo completo' },
  { value: 'legs', label: 'Piernas' },
  { value: 'glutes', label: 'Glúteos' },
  { value: 'chest', label: 'Pecho' },
  { value: 'back', label: 'Espalda' },
  { value: 'shoulders', label: 'Hombros' },
  { value: 'arms', label: 'Brazos' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Movilidad' },
]

function RecommendView() {
  const { list, byId } = useExercises()
  const sessions = useStore((s) => s.sessions)
  const templates = useStore((s) => s.templates)
  const equipment = useStore((s) => s.settings.equipment)
  const updateSettings = useStore((s) => s.updateSettings)
  const [focus, setFocus] = useState<MuscleGroup | 'any'>('any')
  const [minutes, setMinutes] = useState('30')
  const [ease, setEase] = useState<Ease>('normal')
  const [objective, setObjective] = useState<Objective | ''>('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const rec = useMemo(
    () => recommend({ focus, minutes: Number(minutes), ease, equipment, objective: objective || undefined, history: sessions, library: list }),
    [focus, minutes, ease, equipment, objective, sessions, list],
  )
  const matching = templates.filter((t) => (focus === 'any' || t.focus.includes(focus)) && t.estimatedMin <= Number(minutes) + 10)

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Panel tone="sage" className="self-start">
        <PanelTitle sub="Elige y la propuesta se actualiza al momento.">¿Qué te apetece hoy?</PanelTitle>
        <div className="space-y-5">
          <Field label="Quiero entrenar" htmlFor="rec-focus">
            <Select id="rec-focus" value={focus} onChange={(e) => setFocus(e.target.value as MuscleGroup | 'any')}>
              {FOCUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tengo">
            <Segmented
              label="Tiempo disponible"
              size="sm"
              value={minutes}
              onChange={setMinutes}
              options={['15', '20', '30', '45', '60', '90'].map((m) => ({ value: m, label: `${m}′` }))}
              className="bg-white/60"
            />
          </Field>
          <Field label="Hoy quiero algo">
            <Segmented
              label="Exigencia"
              value={ease}
              onChange={setEase}
              className="bg-white/60"
              options={[
                { value: 'easy', label: 'Suave' },
                { value: 'normal', label: 'Normal' },
                { value: 'hard', label: 'Exigente' },
              ]}
            />
          </Field>
          <Field label="Objetivo (opcional)" htmlFor="rec-obj">
            <Select id="rec-obj" value={objective} onChange={(e) => setObjective(e.target.value as Objective | '')}>
              <option value="">Sin preferencia</option>
              {OBJECTIVES.map((o) => (
                <option key={o} value={o}>
                  {OBJECTIVE_LABEL[o]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Material disponible" hint="Se guarda para la próxima vez.">
            <Chips<Equipment>
              label="Material disponible"
              value={equipment}
              onChange={(v) => updateSettings({ equipment: v })}
              options={EQUIPMENT.filter((e) => e !== 'none' && e !== 'mat').map((e) => ({ value: e, label: EQUIPMENT_LABEL[e] }))}
            />
          </Field>
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[13px] text-sage-ink">
                <Wand2 size={14} /> Propuesta
              </p>
              <h2 className="mt-1 text-2xl">{rec.name}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="sage">{INTENSITY_LABEL[rec.intensity]}</Badge>
                <Badge>
                  <Clock size={12} /> unos {rec.estimatedMin} min
                </Badge>
                <Badge>{OBJECTIVE_LABEL[rec.objective]}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={<Plus size={15} />} onClick={() => setSaving(true)} disabled={!rec.exercises.length}>
                Guardar como rutina
              </Button>
              <Button
                variant="primary"
                icon={<Play size={15} />}
                disabled={!rec.exercises.length}
                onClick={() => navigate(`/entreno/sesion/${useStore.getState().startSession({ adhoc: { name: rec.name, intensity: rec.intensity, plan: rec.exercises } })}`)}
              >
                Empezar ahora
              </Button>
            </div>
          </div>
          {rec.warnings.map((w) => (
            <p key={w} className="mb-3 rounded-ctl bg-warn-soft px-3 py-2 text-sm text-warn">
              {w}
            </p>
          ))}
          <ol className="divide-y divide-line">
            {rec.exercises.map((p, i) => {
              const ex = byId.get(p.exerciseId)!
              return (
                <li key={p.exerciseId} className="flex items-center gap-3 py-2.5">
                  <span className="num w-5 text-sm text-mute">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{ex.name}</p>
                    <p className="text-[12.5px] text-mute">
                      {MUSCLE_LABEL[ex.primary]}, {LEVEL_LABEL[ex.level].toLowerCase()}
                    </p>
                  </div>
                  <span className="num text-sm text-ink-2">
                    {p.sets} × {ex.kind === 'time' ? `${p.reps} s` : p.reps}
                  </span>
                </li>
              )
            })}
          </ol>
          <details className="mt-4 rounded-ctl bg-sunken px-4 py-3 text-sm" open>
            <summary className="cursor-pointer font-medium">Por qué esta propuesta</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-ink-2">
              {rec.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="mt-2 text-[12.5px] text-mute">Se elige con reglas fijas a partir de tu historial y la biblioteca de ejercicios. No se usa inteligencia artificial.</p>
          </details>
        </Panel>
        {matching.length > 0 && (
          <Panel>
            <PanelTitle sub="Encajan con el tiempo y el grupo que has elegido">También puedes usar tus rutinas</PanelTitle>
            <ul className="space-y-2">
              {matching.slice(0, 4).map((t) => (
                <li key={t.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                  <span className="text-[13px] text-mute">{t.estimatedMin} min</span>
                  <Button size="sm" onClick={() => navigate(`/entreno/sesion/${useStore.getState().startSession({ templateId: t.id })}`)}>
                    Empezar
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
      {saving && (
        <TemplateEditor
          draft={{ name: rec.name, focus: rec.focus, objective: rec.objective, intensity: rec.intensity, exercises: rec.exercises, estimatedMin: rec.estimatedMin }}
          onClose={() => setSaving(false)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function LibraryView() {
  const { list } = useExercises()
  const [f, setF] = useState<LibraryFilter>(EMPTY_FILTER)
  const [detail, setDetail] = useState<Exercise | null>(null)
  const [creating, setCreating] = useState(false)
  const shown = filterExercises(list, f)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <LibraryFilters value={f} onChange={setF} />
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          Nuevo ejercicio
        </Button>
      </div>
      <p className="text-[13px] text-mute">{shown.length} ejercicios</p>
      {shown.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setDetail(e)}
              className="group flex items-start gap-3 rounded-[18px] border border-line bg-card p-4 text-left transition-colors hover:border-sage-mid hover:bg-sage/20"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sage text-sage-ink">
                <Dumbbell size={17} />
              </span>
              <span className="min-w-0">
                <span className="block font-medium">
                  {e.name}
                  {e.custom && <Badge className="ml-2 align-middle">Tuyo</Badge>}
                </span>
                <span className="block text-[13px] text-mute">
                  {MUSCLE_LABEL[e.primary]}, {LEVEL_LABEL[e.level].toLowerCase()}
                </span>
                <span className="mt-1 block text-[12.5px] text-mute">{e.equipment.map((q) => EQUIPMENT_LABEL[q]).join(' o ')}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="Ningún ejercicio coincide" body="Quita algún filtro para ver más." action={<Button onClick={() => setF(EMPTY_FILTER)}>Quitar filtros</Button>} />
      )}
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
      {creating && <ExerciseForm onClose={() => setCreating(false)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function HistoryView() {
  const sessions = useStore((s) => s.sessions)
  const ledger = useStore((s) => s.ledger)
  const navigate = useNavigate()
  const done = useMemo(() => sessions.filter((s) => s.status === 'completed').sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt)), [sessions])
  const groups = useMemo(() => {
    const m = new Map<string, typeof done>()
    for (const s of done) {
      const k = s.date.slice(0, 7)
      m.set(k, [...(m.get(k) ?? []), s])
    }
    return [...m]
  }, [done])
  if (!done.length)
    return <EmptyState icon={<History size={20} />} title="Todavía no hay entrenos completados" body="Cuando termines una sesión aparecerá aquí con sus series, pesos y notas." />
  return (
    <div className="space-y-6">
      {groups.map(([month, list]) => (
        <section key={month}>
          <h2 className="mb-2 text-[15px] text-mute">{capitalize(fmt(`${month}-01`, 'MMMM yyyy'))}</h2>
          <ul className="divide-y divide-line rounded-panel border border-line bg-card">
            {list.map((s) => {
              const pts = netForSource(ledger, 'workout', s.id)
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => navigate(`/entreno/sesion/${s.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken/60">
                    <div className="w-14 shrink-0 text-center">
                      <p className="display-num text-2xl leading-none font-semibold">{parseInt(s.date.slice(8), 10)}</p>
                      <p className="text-[12px] text-mute">{fmt(s.date, 'EEE')}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="text-[13px] text-mute">
                        {duration(s.durationMin ?? 0)}, {setsDone(s)} series
                        {sessionVolume(s) > 0 && `, ${num(Math.round(sessionVolume(s)))} kg`}
                        {s.effort && `, esfuerzo ${s.effort}/10`}
                      </p>
                    </div>
                    {pts > 0 && <Badge tone="lilac">+{pts}</Badge>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ProgressView() {
  const t0 = useToday()
  const sessions = useStore((s) => s.sessions)
  const goal = useStore((s) => s.settings.goals.weeklyWorkouts)
  const updateSettings = useStore((s) => s.updateSettings)
  const goals = useStore((s) => s.settings.goals)
  const { byId } = useExercises()

  const data = useMemo(() => {
    const ws = weekStart(t0)
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const s = addDaysISO(ws, -7 * (7 - i))
      const e = addDaysISO(s, 6)
      const list = completedIn(sessions, s, e)
      return { name: fmt(s, 'd MMM'), sessions: list.length, volume: Math.round(list.reduce((n, x) => n + sessionVolume(x), 0)), minutes: list.reduce((n, x) => n + (x.durationMin ?? 0), 0) }
    })
    const month = completedIn(sessions, monthStart(t0), monthEnd(t0))
    const last30 = completedIn(sessions, addDaysISO(t0, -29), t0)
    const muscles = [...muscleSetCounts(last30, byId)].sort((a, b) => b[1] - a[1])
    const prs = [...personalRecords(sessions).values()].sort((a, b) => b.date.localeCompare(a.date))
    const hit = weeks.filter((w) => w.sessions >= goal).length
    return { weeks, month, muscles, prs, hit, thisWeek: weeks[7].sessions }
  }, [sessions, t0, byId, goal])

  const [prEx, setPrEx] = useState('')
  const exId = prEx || data.prs[0]?.exerciseId || ''
  const progress = useMemo(() => (exId ? weightProgress(sessions, exId) : []), [sessions, exId])

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel tone="sage">
          <Stat label="Esta semana" value={`${data.thisWeek} de ${goal}`} sub={<Tally count={data.thisWeek} target={goal} color="var(--color-sage-ink)" height={16} label={`${data.thisWeek} de ${goal} entrenos`} />} />
        </Panel>
        <Panel>
          <Stat label="Entrenos este mes" value={data.month.length} sub={duration(data.month.reduce((n, s) => n + (s.durationMin ?? 0), 0))} />
        </Panel>
        <Panel>
          <Stat label="Constancia" value={`${data.hit} de 8`} sub="semanas cumpliendo el objetivo" />
        </Panel>
        <Panel>
          <Stat label="Récords personales" value={data.prs.length} sub="ejercicios con peso registrado" />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelTitle sub="Entrenos completados por semana, últimas 8 semanas">Constancia semanal</PanelTitle>
          <ChartFrame
            summary={`Entrenos por semana: ${data.weeks.map((w) => `${w.name}: ${w.sessions}`).join(', ')}. Objetivo: ${goal} por semana.`}
            table={{ head: ['Semana', 'Entrenos', 'Minutos'], rows: data.weeks.map((w) => [w.name, w.sessions, w.minutes]) }}
          >
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.weeks} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} {...axisProps} />
                  <Tooltip cursor={{ fill: 'rgba(37,42,46,.04)' }} content={<ChartTooltip />} />
                  <Bar dataKey="sessions" name="Entrenos" fill={CHART.fitness} radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartFrame>
        </Panel>
        <Panel>
          <PanelTitle sub="Repeticiones × kilos de las series hechas, por semana">Volumen de entrenamiento</PanelTitle>
          <ChartFrame
            summary={`Volumen semanal en kilos: ${data.weeks.map((w) => `${w.name}: ${w.volume}`).join(', ')}.`}
            table={{ head: ['Semana', 'Volumen (kg)'], rows: data.weeks.map((w) => [w.name, num(w.volume)]) }}
          >
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.weeks} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" />
                  <YAxis {...axisProps} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip cursor={{ fill: 'rgba(37,42,46,.04)' }} content={<ChartTooltip format={(v) => `${num(v)} kg`} />} />
                  <Bar dataKey="volume" name="Volumen" fill={CHART.fitness} radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartFrame>
        </Panel>

        <Panel>
          <PanelTitle sub="Series completadas por grupo muscular, últimos 30 días">Grupos trabajados</PanelTitle>
          {data.muscles.length ? (
            <ul className="space-y-3">
              {data.muscles.map(([g, n]) => (
                <li key={g}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{MUSCLE_LABEL[g]}</span>
                    <span className="num text-mute">{n} series</span>
                  </div>
                  <ProgressBar value={n / data.muscles[0][1]} color={CHART.fitness} label={`${MUSCLE_LABEL[g]}: ${n} series`} />
                </li>
              ))}
              {MUSCLES.filter((m) => !['full_body', 'cardio', 'mobility'].includes(m) && !data.muscles.some(([g]) => g === m)).length > 0 && (
                <li className="pt-1 text-[13px] text-mute">
                  Sin trabajar este mes:{' '}
                  {MUSCLES.filter((m) => !['full_body', 'cardio', 'mobility'].includes(m) && !data.muscles.some(([g]) => g === m))
                    .map((m) => MUSCLE_LABEL[m].toLowerCase())
                    .join(', ')}
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-mute">Completa entrenos para ver qué grupos trabajas más.</p>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            sub="Peso máximo levantado en cada sesión"
            action={
              data.prs.length > 0 && (
                <Select aria-label="Ejercicio" value={exId} onChange={(e) => setPrEx(e.target.value)} className="h-9 w-44 text-sm">
                  {data.prs.map((p) => (
                    <option key={p.exerciseId} value={p.exerciseId}>
                      {byId.get(p.exerciseId)?.name}
                    </option>
                  ))}
                </Select>
              )
            }
          >
            Progresión de peso
          </PanelTitle>
          {progress.length > 1 ? (
            <ChartFrame
              summary={`Progresión de ${byId.get(exId)?.name}: ${progress.map((p) => `${p.date}: ${p.weight} kg`).join(', ')}.`}
              table={{ head: ['Fecha', 'Peso (kg)'], rows: progress.map((p) => [fmt(p.date, 'd MMM yyyy'), p.weight]) }}
            >
              <div className="h-52">
                <ResponsiveContainer>
                  <LineChart data={progress.map((p) => ({ ...p, label: fmt(p.date, 'd MMM') }))} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
                    <YAxis {...axisProps} domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip content={<ChartTooltip format={(v) => `${num(v)} kg`} />} />
                    <Line type="monotone" dataKey="weight" name="Peso" stroke={CHART.fitness} strokeWidth={2} dot={{ r: 4, fill: CHART.fitness, stroke: 'white', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartFrame>
          ) : (
            <p className="text-sm text-mute">Registra el peso de tus series en al menos dos sesiones para ver la progresión.</p>
          )}
        </Panel>
      </div>

      {data.prs.length > 0 && (
        <Panel>
          <PanelTitle>Récords personales</PanelTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[12.5px] text-mute">
                  <th className="py-2 pr-4 font-medium">Ejercicio</th>
                  <th className="py-2 pr-4 font-medium">Peso</th>
                  <th className="py-2 pr-4 font-medium">Reps</th>
                  <th className="py-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.prs.map((p) => (
                  <tr key={p.exerciseId} className="border-b border-line/60">
                    <td className="py-2 pr-4">{byId.get(p.exerciseId)?.name}</td>
                    <td className="num py-2 pr-4 font-medium">{num(p.weight)} kg</td>
                    <td className="num py-2 pr-4">{p.reps}</td>
                    <td className="py-2 text-mute">{relativeDay(p.date, t0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel tone="sage">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-[17px] font-semibold">Objetivo semanal de entrenos</p>
            <p className="text-sm text-ink-2">Un objetivo sostenible es mejor que uno heroico.</p>
          </div>
          <Segmented
            label="Entrenos por semana"
            value={String(goals.weeklyWorkouts)}
            onChange={(v) => updateSettings({ goals: { ...goals, weeklyWorkouts: Number(v) } })}
            options={['1', '2', '3', '4', '5', '6'].map((n) => ({ value: n, label: n }))}
            className="bg-white/60"
          />
        </div>
      </Panel>
      <p className="flex items-center gap-1.5 text-[12.5px] text-mute">
        <Sparkles size={13} /> Los entrenos dan puntos de fitness solo al completarse. Mira el detalle en Logros.
      </p>
    </div>
  )
}
