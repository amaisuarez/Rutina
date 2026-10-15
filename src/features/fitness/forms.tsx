import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Dumbbell, Plus, Search, Trash2 } from 'lucide-react'
import type { Equipment, Exercise, ExerciseLevel, Intensity, MuscleGroup, Objective, PlannedExercise, WorkoutTemplate } from '../../types'
import { exerciseLookup, useStore } from '../../store'
import { closeComposer, openComposer, toast } from '../../store/ui'
import { Modal } from '../../components/ui/Modal'
import { Button, IconButton } from '../../components/ui/Button'
import { Chips, Field, Input, Segmented, Select, Textarea } from '../../components/ui/Form'
import { Badge, EmptyState } from '../../components/ui/Misc'
import { EXERCISES, formatTarget } from './library'
import { EQUIPMENT, EQUIPMENT_LABEL, INTENSITIES, LEVEL_LABEL, MUSCLES, MUSCLE_LABEL, OBJECTIVES, OBJECTIVE_LABEL } from './labels'
import { MuscleMap } from './MuscleMap'
import { INTENSITY_LABEL } from '../gamification/scoring'
import { WEEKDAY_NAMES, WEEKDAY_SHORT, today, weekday } from '../../utils/dates'

export function useExercises() {
  const custom = useStore((s) => s.customExercises)
  return useMemo(() => ({ list: [...EXERCISES, ...custom], byId: exerciseLookup(custom) }), [custom])
}

/* ------------------------------------------------------------------ */
/* Library filters (shared by the library tab and the picker)          */
/* ------------------------------------------------------------------ */

export interface LibraryFilter {
  q: string
  muscle: MuscleGroup | ''
  level: ExerciseLevel | ''
  equipment: Equipment | ''
  objective: Objective | ''
}

export const EMPTY_FILTER: LibraryFilter = { q: '', muscle: '', level: '', equipment: '', objective: '' }

export function filterExercises(list: Exercise[], f: LibraryFilter) {
  const q = f.q.trim().toLowerCase()
  return list.filter(
    (e) =>
      (!q || e.name.toLowerCase().includes(q)) &&
      (!f.muscle || e.primary === f.muscle || e.secondary.includes(f.muscle)) &&
      (!f.level || e.level === f.level) &&
      (!f.equipment || e.equipment.includes(f.equipment)) &&
      (!f.objective || e.objectives.includes(f.objective)),
  )
}

export function LibraryFilters({ value, onChange }: { value: LibraryFilter; onChange: (f: LibraryFilter) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <div className="relative sm:col-span-2 lg:col-span-1">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-mute" />
        <Input value={value.q} onChange={(e) => onChange({ ...value, q: e.target.value })} placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" className="pl-9" />
      </div>
      <Select aria-label="Grupo muscular" value={value.muscle} onChange={(e) => onChange({ ...value, muscle: e.target.value as MuscleGroup })}>
        <option value="">Grupo muscular</option>
        {MUSCLES.map((m) => (
          <option key={m} value={m}>
            {MUSCLE_LABEL[m]}
          </option>
        ))}
      </Select>
      <Select aria-label="Nivel" value={value.level} onChange={(e) => onChange({ ...value, level: e.target.value as ExerciseLevel })}>
        <option value="">Nivel</option>
        {(Object.keys(LEVEL_LABEL) as ExerciseLevel[]).map((l) => (
          <option key={l} value={l}>
            {LEVEL_LABEL[l]}
          </option>
        ))}
      </Select>
      <Select aria-label="Material" value={value.equipment} onChange={(e) => onChange({ ...value, equipment: e.target.value as Equipment })}>
        <option value="">Material</option>
        {EQUIPMENT.map((m) => (
          <option key={m} value={m}>
            {EQUIPMENT_LABEL[m]}
          </option>
        ))}
      </Select>
      <Select aria-label="Objetivo" value={value.objective} onChange={(e) => onChange({ ...value, objective: e.target.value as Objective })}>
        <option value="">Objetivo</option>
        {OBJECTIVES.map((o) => (
          <option key={o} value={o}>
            {OBJECTIVE_LABEL[o]}
          </option>
        ))}
      </Select>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Exercise detail                                                     */
/* ------------------------------------------------------------------ */

export function ExerciseDetail({ exercise, onClose, onAdd }: { exercise: Exercise; onClose: () => void; onAdd?: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={exercise.name}
      description={`${MUSCLE_LABEL[exercise.primary]}, nivel ${LEVEL_LABEL[exercise.level].toLowerCase()}`}
      tone="sage"
      size="lg"
      footer={
        <>
          {exercise.custom && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              icon={<Trash2 size={15} />}
              onClick={() => {
                useStore.getState().deleteExercise(exercise.id)
                toast('Ejercicio eliminado')
                onClose()
              }}
            >
              Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          {onAdd && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={onAdd}>
              Añadir a la rutina
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <div className="rounded-panel bg-sage/50 p-3">
          <MuscleMap primary={exercise.primary} secondary={exercise.secondary} size={176} />
        </div>
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[12.5px] text-mute">Series</dt>
              <dd className="font-medium">{exercise.sets}</dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-mute">{exercise.kind === 'time' ? 'Duración' : 'Repeticiones'}</dt>
              <dd className="font-medium">{formatTarget(exercise, exercise.reps)}</dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-mute">Descanso</dt>
              <dd className="font-medium">{exercise.restSec ? `${exercise.restSec} s` : 'Sin pausa'}</dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-mute">Duración aprox.</dt>
              <dd className="font-medium">{exercise.minutes} min</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-1.5">
            {exercise.equipment.map((e) => (
              <Badge key={e}>{EQUIPMENT_LABEL[e]}</Badge>
            ))}
            {exercise.objectives.map((o) => (
              <Badge key={o} tone="sage">
                {OBJECTIVE_LABEL[o]}
              </Badge>
            ))}
          </div>
          {exercise.secondary.length > 0 && (
            <p className="text-sm text-ink-2">
              <span className="text-mute">También trabaja: </span>
              {exercise.secondary.map((g) => MUSCLE_LABEL[g].toLowerCase()).join(', ')}
            </p>
          )}
          <div>
            <h3 className="mb-2 text-[15px]">Cómo se hace</h3>
            <ol className="space-y-2 text-[15px]">
              {exercise.instructions.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-sage text-[12px] font-semibold text-sage-ink">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
          {exercise.tips.length > 0 && (
            <div className="rounded-ctl bg-warn-soft px-4 py-3">
              <h3 className="mb-1 text-[14px] text-warn">Técnica y seguridad</h3>
              <ul className="list-disc space-y-1 pl-4 text-sm text-ink-2">
                {exercise.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Exercise picker                                                     */
/* ------------------------------------------------------------------ */

export function ExercisePicker({ onPick, onClose, title = 'Añadir ejercicio', defaultMuscle }: { onPick: (e: Exercise) => void; onClose: () => void; title?: string; defaultMuscle?: MuscleGroup }) {
  const { list } = useExercises()
  const [f, setF] = useState<LibraryFilter>({ ...EMPTY_FILTER, muscle: defaultMuscle ?? '' })
  const shown = filterExercises(list, f)
  return (
    <Modal open onClose={onClose} title={title} tone="sage" size="lg">
      <div className="space-y-3">
        <LibraryFilters value={f} onChange={setF} />
        {shown.length ? (
          <ul className="divide-y divide-line rounded-ctl border border-line">
            {shown.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onPick(e)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-sage/40">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sage text-sage-ink">
                    <Dumbbell size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{e.name}</span>
                    <span className="block text-[12.5px] text-mute">
                      {MUSCLE_LABEL[e.primary]}, {LEVEL_LABEL[e.level].toLowerCase()}, {e.equipment.map((q) => EQUIPMENT_LABEL[q].toLowerCase()).join(' o ')}
                    </span>
                  </span>
                  <Plus size={18} className="text-mute" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Ningún ejercicio coincide" body="Quita algún filtro para ver más opciones." />
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Routine (template) editor                                           */
/* ------------------------------------------------------------------ */

export function estimateMinutes(plan: PlannedExercise[], byId: Map<string, Exercise>): number {
  let sec = 300 // warm-up
  for (const p of plan) {
    const ex = byId.get(p.exerciseId)
    const work = ex?.kind === 'time' ? parseInt(p.reps, 10) || 30 : 40
    sec += p.sets * (work + p.restSec)
  }
  return Math.max(10, Math.round(sec / 60 / 5) * 5)
}

export function TemplateEditor({ template, draft, onClose, onSaved }: { template?: WorkoutTemplate; draft?: Partial<WorkoutTemplate>; onClose: () => void; onSaved?: (t: WorkoutTemplate) => void }) {
  const { byId } = useExercises()
  const src = template ?? draft
  const [name, setName] = useState(src?.name ?? '')
  const [focus, setFocus] = useState<MuscleGroup[]>(src?.focus ?? [])
  const [objective, setObjective] = useState<Objective>(src?.objective ?? 'hypertrophy')
  const [intensity, setIntensity] = useState<Intensity>(src?.intensity ?? 'standard')
  const [plan, setPlan] = useState<PlannedExercise[]>(src?.exercises ?? [])
  const [minutes, setMinutes] = useState(src?.estimatedMin ? String(src.estimatedMin) : '')
  const [notes, setNotes] = useState(src?.notes ?? '')
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<Record<string, string>>({})
  const scoring = useStore((s) => s.settings.scoring)

  const auto = estimateMinutes(plan, byId)
  const update = (i: number, patch: Partial<PlannedExercise>) => setPlan((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const moveEx = (i: number, d: -1 | 1) =>
    setPlan((p) => {
      const n = [...p]
      const j = i + d
      if (j < 0 || j >= n.length) return p
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err: Record<string, string> = {}
    if (!name.trim()) err.name = 'Ponle un nombre a la rutina.'
    if (!plan.length) err.plan = 'Añade al menos un ejercicio.'
    const m = minutes ? parseInt(minutes, 10) : auto
    if (!m || m < 5 || m > 300) err.minutes = 'Indica una duración entre 5 y 300 minutos.'
    setError(err)
    if (Object.keys(err).length) return
    const derivedFocus = focus.length ? focus : [...new Set(plan.map((p) => byId.get(p.exerciseId)?.primary).filter(Boolean) as MuscleGroup[])]
    const saved = useStore.getState().saveTemplate({ id: template?.id, name: name.trim(), focus: derivedFocus, objective, intensity, estimatedMin: m, exercises: plan, notes: notes.trim() || undefined })
    toast(template ? 'Rutina actualizada' : 'Rutina creada')
    onSaved?.(saved)
    onClose()
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={template ? 'Editar rutina' : 'Nueva rutina'}
        tone="sage"
        size="lg"
        footer={
          <>
            <p className="mr-auto text-[13px] text-sage-ink">Intensidad {INTENSITY_LABEL[intensity].toLowerCase()}: {scoring.workout[intensity]} puntos base al completarla</p>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="tpl-form">
              {template ? 'Guardar cambios' : 'Crear rutina'}
            </Button>
          </>
        }
      >
        <form id="tpl-form" onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="Nombre" htmlFor="tpl-name" error={error.name}>
              <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Pierna y glúteo" aria-invalid={!!error.name} />
            </Field>
            <Field label="Duración (min)" htmlFor="tpl-min" error={error.minutes} hint={`Calculada: ${auto} min`}>
              <Input id="tpl-min" inputMode="numeric" value={minutes} placeholder={String(auto)} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>
          <Field label="Grupos musculares" hint="Si no eliges ninguno, se deducen de los ejercicios.">
            <Chips label="Grupos musculares" value={focus} onChange={setFocus} options={MUSCLES.map((m) => ({ value: m, label: MUSCLE_LABEL[m] }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Objetivo" htmlFor="tpl-obj">
              <Select id="tpl-obj" value={objective} onChange={(e) => setObjective(e.target.value as Objective)}>
                {OBJECTIVES.map((o) => (
                  <option key={o} value={o}>
                    {OBJECTIVE_LABEL[o]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Intensidad">
              <Segmented label="Intensidad" size="sm" value={intensity} onChange={setIntensity} options={INTENSITIES.map((i) => ({ value: i, label: INTENSITY_LABEL[i] }))} />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-medium text-ink-2">Ejercicios</p>
              <Button size="sm" icon={<Plus size={15} />} onClick={() => setPicking(true)}>
                Añadir ejercicio
              </Button>
            </div>
            {error.plan && (
              <p role="alert" className="mb-2 text-[13px] text-danger">
                {error.plan}
              </p>
            )}
            {plan.length > 0 ? (
              <ol className="divide-y divide-line rounded-ctl border border-line">
                {plan.map((p, i) => {
                  const ex = byId.get(p.exerciseId)
                  return (
                    <li key={`${p.exerciseId}-${i}`} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="num w-5 text-[13px] text-mute">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{ex?.name ?? 'Ejercicio eliminado'}</p>
                          <p className="text-[12.5px] text-mute">{ex ? MUSCLE_LABEL[ex.primary] : ''}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-7 sm:pl-0">
                        <MiniNum label="Series" value={p.sets} onChange={(v) => update(i, { sets: Math.max(1, Math.min(20, v)) })} />
                        <label className="flex flex-col text-[11px] text-mute">
                          {ex?.kind === 'time' ? 'Segundos' : 'Reps'}
                          <input value={p.reps} onChange={(e) => update(i, { reps: e.target.value.slice(0, 16) })} className="h-9 w-20 rounded-lg border border-line px-2 text-sm text-ink" />
                        </label>
                        <MiniNum label="Descanso s" value={p.restSec} onChange={(v) => update(i, { restSec: Math.max(0, Math.min(600, v)) })} />
                        {ex?.kind !== 'time' && <MiniNum label="Peso kg" value={p.weight ?? 0} onChange={(v) => update(i, { weight: v > 0 ? v : undefined })} step={0.5} />}
                        <div className="ml-auto flex">
                          <IconButton size="sm" label="Subir" onClick={() => moveEx(i, -1)} disabled={i === 0}>
                            <ArrowUp size={15} />
                          </IconButton>
                          <IconButton size="sm" label="Bajar" onClick={() => moveEx(i, 1)} disabled={i === plan.length - 1}>
                            <ArrowDown size={15} />
                          </IconButton>
                          <IconButton size="sm" label={`Quitar ${ex?.name ?? 'ejercicio'}`} onClick={() => setPlan((x) => x.filter((_, j) => j !== i))}>
                            <Trash2 size={15} />
                          </IconButton>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <EmptyState title="Sin ejercicios" body="Añade ejercicios desde la biblioteca." className="py-6" />
            )}
          </div>
          <Field label="Notas" htmlFor="tpl-notes">
            <Textarea id="tpl-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </form>
      </Modal>
      {picking && (
        <ExercisePicker
          defaultMuscle={focus[0]}
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            setPlan((p) => [...p, { exerciseId: ex.id, sets: ex.sets, reps: ex.reps, restSec: ex.restSec }])
            setPicking(false)
          }}
        />
      )}
    </>
  )
}

function MiniNum({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="flex flex-col text-[11px] text-mute">
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        value={value || ''}
        placeholder="0"
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="num h-9 w-[72px] rounded-lg border border-line px-2 text-sm text-ink"
      />
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* Schedule a workout (composer)                                       */
/* ------------------------------------------------------------------ */

export function ScheduleWorkoutForm({ date, templateId }: { date?: string; templateId?: string }) {
  const templates = useStore((s) => s.templates)
  const [tpl, setTpl] = useState(templateId ?? templates[0]?.id ?? '')
  const [d, setD] = useState(date ?? today())
  const [time, setTime] = useState('')
  const [repeat, setRepeat] = useState(false)
  const [days, setDays] = useState<string[]>([String(weekday(date ?? today()))])
  const [until, setUntil] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!tpl) return setError('Elige una rutina o crea una nueva.')
    if (!d) return setError('Indica la fecha.')
    if (repeat && !days.length) return setError('Elige al menos un día de la semana.')
    useStore.getState().scheduleWorkout({ templateId: tpl, date: d, time: time || undefined, weekdays: repeat ? days.map(Number) : undefined, until: repeat && until ? until : undefined })
    toast(repeat ? 'Plan semanal creado' : 'Entreno programado')
    closeComposer()
  }

  return (
    <>
      <Modal
        open
        onClose={closeComposer}
        title="Programar entreno"
        description="Los entrenos programados suman puntos solo cuando los completas."
        tone="sage"
        footer={
          <>
            <Button variant="ghost" onClick={closeComposer}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="sched-form" disabled={!templates.length}>
              Programar
            </Button>
          </>
        }
      >
        {templates.length === 0 ? (
          <EmptyState
            icon={<Dumbbell size={20} />}
            title="Primero crea una rutina"
            body="Una rutina es la lista de ejercicios que harás. También puedes pedir una al recomendador."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Crear rutina
                </Button>
                <Button
                  onClick={() => {
                    closeComposer()
                    location.hash = '#/entreno?v=recomendador'
                  }}
                >
                  Ir al recomendador
                </Button>
              </div>
            }
          />
        ) : (
          <form id="sched-form" onSubmit={submit} className="grid gap-4" noValidate>
            <Field label="Rutina" htmlFor="sch-tpl" error={error && !tpl ? error : null}>
              <Select id="sch-tpl" value={tpl} onChange={(e) => setTpl(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.estimatedMin} min)
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={repeat ? 'Empieza el' : 'Fecha'} htmlFor="sch-date">
                <Input id="sch-date" type="date" value={d} onChange={(e) => setD(e.target.value)} />
              </Field>
              <Field label="Hora (opcional)" htmlFor="sch-time">
                <Input id="sch-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
            </div>
            <label className="flex items-center gap-3 rounded-ctl bg-sunken p-3 text-sm">
              <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="size-4 accent-[var(--color-sage-ink)]" />
              Repetir cada semana
            </label>
            {repeat && (
              <>
                <Field label="Días de la semana">
                  <Chips
                    label="Días de la semana"
                    value={days}
                    onChange={setDays}
                    options={WEEKDAY_SHORT.map((_, i) => ({ value: String(i + 1), label: WEEKDAY_NAMES[i].slice(0, 3) }))}
                  />
                </Field>
                <Field label="Hasta (opcional)" htmlFor="sch-until">
                  <Input id="sch-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                </Field>
              </>
            )}
            <button type="button" className="justify-self-start text-sm text-sage-ink underline-offset-4 hover:underline" onClick={() => setCreating(true)}>
              Crear una rutina nueva
            </button>
            {error && tpl && (
              <p role="alert" className="text-[13px] text-danger">
                {error}
              </p>
            )}
          </form>
        )}
      </Modal>
      {creating && <TemplateEditor onClose={() => setCreating(false)} onSaved={(t) => setTpl(t.id)} />}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Custom exercise                                                     */
/* ------------------------------------------------------------------ */

export function ExerciseForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [primary, setPrimary] = useState<MuscleGroup>('full_body')
  const [level, setLevel] = useState<ExerciseLevel>('beginner')
  const [equipment, setEquipment] = useState<Equipment[]>(['none'])
  const [kind, setKind] = useState<'reps' | 'time'>('reps')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('10')
  const [rest, setRest] = useState('60')
  const [instructions, setInstructions] = useState('')
  const [error, setError] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Escribe el nombre del ejercicio.')
    useStore.getState().saveExercise({
      name: name.trim(),
      primary,
      secondary: [],
      level,
      equipment: equipment.length ? equipment : ['none'],
      objectives: [],
      kind,
      sets: Math.max(1, parseInt(sets, 10) || 1),
      reps: reps || '10',
      restSec: Math.max(0, parseInt(rest, 10) || 0),
      instructions: instructions.split('\n').map((s) => s.trim()).filter(Boolean),
      tips: [],
    })
    toast('Ejercicio añadido a tu biblioteca')
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo ejercicio"
      tone="sage"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="ex-form">
            Guardar ejercicio
          </Button>
        </>
      }
    >
      <form id="ex-form" onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Nombre" htmlFor="ex-name" error={error}>
          <Input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!error} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Grupo muscular" htmlFor="ex-mg">
            <Select id="ex-mg" value={primary} onChange={(e) => setPrimary(e.target.value as MuscleGroup)}>
              {MUSCLES.map((m) => (
                <option key={m} value={m}>
                  {MUSCLE_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nivel" htmlFor="ex-lv">
            <Select id="ex-lv" value={level} onChange={(e) => setLevel(e.target.value as ExerciseLevel)}>
              {(Object.keys(LEVEL_LABEL) as ExerciseLevel[]).map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Material">
          <Chips label="Material" value={equipment} onChange={setEquipment} options={EQUIPMENT.map((e) => ({ value: e, label: EQUIPMENT_LABEL[e] }))} />
        </Field>
        <Field label="Se mide en">
          <Segmented label="Se mide en" value={kind} onChange={setKind} options={[{ value: 'reps', label: 'Repeticiones' }, { value: 'time', label: 'Tiempo' }]} />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Series" htmlFor="ex-sets">
            <Input id="ex-sets" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label={kind === 'time' ? 'Segundos' : 'Reps'} htmlFor="ex-reps">
            <Input id="ex-reps" value={reps} onChange={(e) => setReps(e.target.value)} />
          </Field>
          <Field label="Descanso (s)" htmlFor="ex-rest">
            <Input id="ex-rest" inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
        <Field label="Instrucciones" htmlFor="ex-ins" hint="Un paso por línea.">
          <Textarea id="ex-ins" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}

export function openScheduleWorkout(date?: string, templateId?: string) {
  openComposer({ kind: 'workout', date, templateId })
}
