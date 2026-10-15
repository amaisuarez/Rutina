import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check as CheckIcon, Info, Minus, Plus, Repeat2, SkipForward, Timer, Trash2, Undo2, X } from 'lucide-react'
import type { SessionExercise, SetLog, WorkoutSession } from '../../types'
import { useStore } from '../../store'
import { confirm, toast } from '../../store/ui'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge, EmptyState, Panel } from '../../components/ui/Misc'
import { Check } from '../../components/ui/Check'
import { Field, Input, Textarea } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { ProgressBar } from '../../components/ui/Progress'
import { cx } from '../../components/ui/cx'
import { ExerciseDetail, ExercisePicker, useExercises } from './forms'
import { formatTarget } from './library'
import { MUSCLE_LABEL } from './labels'
import { INTENSITY_LABEL, sessionCompletion, workoutScore } from '../gamification/scoring'
import { capitalize, fmt, minutesBetween } from '../../utils/dates'
import { duration } from '../../utils/format'
import { sessionVolume, setsDone } from './stats'

function useElapsed(startedAt: string, running: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds)
  const [total, setTotal] = useState(seconds)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (left <= 0) {
      if ('vibrate' in navigator) navigator.vibrate?.(200)
      done.current()
      return
    }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(id)
  }, [left])
  return (
    <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 lg:bottom-6" role="timer" aria-live="off">
      <div className="flex w-full max-w-md animate-rise items-center gap-3 rounded-[18px] bg-ink p-3 pl-4 text-paper shadow-pop">
        <Timer size={18} className="text-sage-mid" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] opacity-70">Descanso</p>
          <p className="display-num text-2xl leading-none font-semibold">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-sage-mid transition-[width] duration-1000 ease-linear" style={{ width: `${(left / total) * 100}%` }} />
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-white/10"
          onClick={() => {
            setLeft((l) => l + 15)
            setTotal((t) => t + 15)
          }}
        >
          +15 s
        </button>
        <button type="button" className="rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-white/10" onClick={onDone}>
          Saltar
        </button>
      </div>
    </div>
  )
}

export default function SessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useStore((s) => s.sessions.find((x) => x.id === id))
  const scoring = useStore((s) => s.settings.scoring)
  const { byId } = useExercises()
  const [rest, setRest] = useState<{ key: number; sec: number } | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [replacing, setReplacing] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const active = session?.status === 'active'
  const elapsed = useElapsed(session?.startedAt ?? new Date().toISOString(), !!active)

  const completion = session ? sessionCompletion(session) : 0

  if (!session)
    return (
      <EmptyState
        title="No encontramos esta sesión"
        body="Puede que se haya eliminado."
        action={
          <Link to="/entreno" className="text-sm font-medium text-sage-ink underline">
            Volver a Entreno
          </Link>
        }
      />
    )

  const update = (fn: (s: WorkoutSession) => WorkoutSession) => useStore.getState().updateSession(session.id, fn)
  const updateEx = (i: number, fn: (e: SessionExercise) => SessionExercise) => update((s) => ({ ...s, exercises: s.exercises.map((e, j) => (j === i ? fn(e) : e)) }))
  const updateSet = (i: number, k: number, patch: Partial<SetLog>) => updateEx(i, (e) => ({ ...e, sets: e.sets.map((x, j) => (j === k ? { ...x, ...patch } : x)) }))

  const cancel = async () => {
    const ok = await confirm({ title: 'Cancelar entreno', body: 'Se descarta el registro de esta sesión y no suma puntos.', confirmLabel: 'Cancelar entreno', tone: 'danger' })
    if (!ok) return
    useStore.getState().cancelSession(session.id)
    toast('Entreno cancelado')
    navigate('/entreno')
  }

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <div className="mb-5 flex items-center gap-2">
        <Link to="/entreno" className="inline-flex items-center gap-1.5 rounded-lg py-1 pr-2 text-sm text-mute hover:text-ink">
          <ArrowLeft size={16} /> Entreno
        </Link>
      </div>

      <Panel tone="sage" className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-sage-ink">{active ? 'Entreno en curso' : session.status === 'completed' ? capitalize(fmt(session.date, "EEEE d 'de' MMMM")) : 'Entreno cancelado'}</p>
            <h1 className="mt-1 text-[28px] leading-tight sm:text-[34px]">{session.name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge className="bg-white/70 text-sage-ink">{INTENSITY_LABEL[session.intensity]}</Badge>
              <Badge className="bg-white/70 text-sage-ink">
                {setsDone(session)} series hechas
              </Badge>
              {!active && session.durationMin && <Badge className="bg-white/70 text-sage-ink">{duration(session.durationMin)}</Badge>}
              {!active && sessionVolume(session) > 0 && <Badge className="bg-white/70 text-sage-ink">{Math.round(sessionVolume(session)).toLocaleString('es-ES')} kg de volumen</Badge>}
            </div>
          </div>
          {active && (
            <div className="text-right">
              <p className="text-[12.5px] text-sage-ink">Tiempo</p>
              <p className="display-num text-[34px] leading-none font-semibold" aria-label={`Tiempo transcurrido ${elapsed}`}>
                {elapsed}
              </p>
            </div>
          )}
        </div>
        <ProgressBar value={completion} color="var(--color-sage-ink)" className="mt-4 bg-white/60" label={`${Math.round(completion * 100)} % de las series completadas`} />
      </Panel>

      <ol className="space-y-3">
        {session.exercises.map((ex, i) => {
          const def = byId.get(ex.exerciseId)
          const time = def?.kind === 'time'
          const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.done)
          return (
            <li key={`${ex.exerciseId}-${i}`}>
              <article className={cx('rounded-panel border bg-card p-4 transition-colors', ex.skipped ? 'border-dashed border-line-strong opacity-60' : allDone ? 'border-sage-mid' : 'border-line')}>
                <header className="mb-3 flex items-start gap-3">
                  <span className={cx('num grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold', allDone ? 'bg-sage-ink text-white' : 'bg-sage text-sage-ink')}>
                    {allDone ? <CheckIcon size={16} /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setDetail(ex.exerciseId)} className="group flex items-center gap-1.5 text-left">
                      <h2 className={cx('text-[17px]', ex.skipped && 'line-through')}>{def?.name ?? 'Ejercicio'}</h2>
                      <Info size={14} className="text-mute group-hover:text-ink" aria-label="Ver instrucciones" />
                    </button>
                    <p className="text-[13px] text-mute">
                      {def ? MUSCLE_LABEL[def.primary] : ''}, objetivo {def ? formatTarget(def, ex.targetReps) : ex.targetReps}
                      {ex.restSec ? `, descanso ${ex.restSec} s` : ''}
                      {ex.replacedFrom && `, sustituye a ${byId.get(ex.replacedFrom)?.name ?? 'otro ejercicio'}`}
                    </p>
                  </div>
                  {active && (
                    <div className="flex">
                      <IconButton size="sm" label="Sustituir ejercicio" onClick={() => setReplacing(i)}>
                        <Repeat2 size={16} />
                      </IconButton>
                      <IconButton size="sm" label={ex.skipped ? 'Retomar ejercicio' : 'Saltar ejercicio'} onClick={() => updateEx(i, (e) => ({ ...e, skipped: !e.skipped }))}>
                        {ex.skipped ? <Undo2 size={16} /> : <SkipForward size={16} />}
                      </IconButton>
                    </div>
                  )}
                </header>
                {!ex.skipped && (
                  <>
                    <div className="grid grid-cols-[32px_1fr_1fr_40px] items-center gap-x-2 gap-y-1.5 text-sm">
                      <span className="text-[12px] text-mute">Serie</span>
                      <span className="text-[12px] text-mute">{time ? 'Segundos' : 'Reps'}</span>
                      <span className="text-[12px] text-mute">{time ? '' : 'Peso (kg)'}</span>
                      <span />
                      {ex.sets.map((s, k) => (
                        <SetRow
                          key={k}
                          n={k + 1}
                          set={s}
                          time={time}
                          disabled={!active}
                          onChange={(patch) => updateSet(i, k, patch)}
                          onToggle={() => {
                            updateSet(i, k, { done: !s.done })
                            if (!s.done && ex.restSec > 0 && active) setRest({ key: Date.now(), sec: ex.restSec })
                          }}
                        />
                      ))}
                    </div>
                    {active && (
                      <div className="mt-2 flex gap-1">
                        <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => updateEx(i, (e) => ({ ...e, sets: [...e.sets, { ...(e.sets[e.sets.length - 1] ?? {}), done: false }] }))}>
                          Serie
                        </Button>
                        {ex.sets.length > 1 && (
                          <Button size="sm" variant="ghost" icon={<Minus size={14} />} onClick={() => updateEx(i, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}>
                            Quitar serie
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </article>
            </li>
          )
        })}
      </ol>

      {active && (
        <Button className="mt-3 w-full border-dashed" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
          Añadir ejercicio
        </Button>
      )}

      <Panel className="mt-5">
        <Field label="Notas de la sesión" htmlFor="s-notes">
          <Textarea id="s-notes" rows={2} disabled={!active} value={session.notes ?? ''} onChange={(e) => update((s) => ({ ...s, notes: e.target.value }))} placeholder="Cómo te has sentido, molestias, ajustes para la próxima vez…" />
        </Field>
        <div className="mt-4">
          <label htmlFor="s-effort" className="text-[13px] font-medium text-ink-2">
            Esfuerzo percibido: <span className="num font-semibold text-ink">{session.effort ?? '—'}</span>/10
          </label>
          <input id="s-effort" type="range" min={1} max={10} disabled={!active} value={session.effort ?? 5} onChange={(e) => update((s) => ({ ...s, effort: Number(e.target.value) }))} className="mt-2 w-full accent-[var(--color-sage-ink)]" />
        </div>
      </Panel>

      {active && (
        <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 mt-6 flex gap-2 rounded-[18px] border border-line bg-paper/95 p-2 backdrop-blur lg:bottom-4">
          <Button variant="ghost" icon={<X size={16} />} onClick={cancel}>
            Cancelar
          </Button>
          <Button variant="primary" className="flex-1" size="lg" icon={<CheckIcon size={18} />} onClick={() => setFinishing(true)}>
            Terminar entreno
          </Button>
        </div>
      )}
      {session.status === 'completed' && (
        <div className="mt-6 flex justify-end">
          <Button
            variant="ghost"
            className="text-danger"
            icon={<Trash2 size={16} />}
            onClick={async () => {
              const ok = await confirm({ title: 'Eliminar del historial', body: 'Se borra la sesión y se retiran los puntos que te dio. Esta acción no se puede deshacer.', confirmLabel: 'Eliminar', tone: 'danger' })
              if (!ok) return
              const r = useStore.getState().deleteSession(session.id)
              toast(r < 0 ? `Sesión eliminada. Se retiran ${-r} puntos` : 'Sesión eliminada')
              navigate('/entreno?v=historial')
            }}
          >
            Eliminar sesión
          </Button>
        </div>
      )}

      {rest && <RestTimer key={rest.key} seconds={rest.sec} onDone={() => setRest(null)} />}
      {detail && byId.get(detail) && <ExerciseDetail exercise={byId.get(detail)!} onClose={() => setDetail(null)} />}
      {replacing !== null && (
        <ExercisePicker
          title="Sustituir ejercicio"
          defaultMuscle={byId.get(session.exercises[replacing].exerciseId)?.primary}
          onClose={() => setReplacing(null)}
          onPick={(e) => {
            updateEx(replacing, (old) => ({
              exerciseId: e.id,
              restSec: e.restSec,
              targetReps: e.reps,
              replacedFrom: old.replacedFrom ?? old.exerciseId,
              sets: old.sets.map(() => ({ reps: parseInt(e.reps, 10) || undefined, done: false })),
            }))
            setReplacing(null)
            toast(`Sustituido por ${e.name}`)
          }}
        />
      )}
      {adding && (
        <ExercisePicker
          onClose={() => setAdding(false)}
          onPick={(e) => {
            update((s) => ({
              ...s,
              exercises: [...s.exercises, { exerciseId: e.id, restSec: e.restSec, targetReps: e.reps, sets: Array.from({ length: e.sets }, () => ({ reps: parseInt(e.reps, 10) || undefined, done: false })) }],
            }))
            setAdding(false)
          }}
        />
      )}
      {finishing && <FinishDialog session={session} onClose={() => setFinishing(false)} onDone={() => navigate('/entreno?v=historial')} scoring={scoring} />}
    </div>
  )
}

function SetRow({ n, set, time, disabled, onChange, onToggle }: { n: number; set: SetLog; time: boolean; disabled: boolean; onChange: (p: Partial<SetLog>) => void; onToggle: () => void }) {
  const cls = 'num h-10 w-full rounded-lg border border-line bg-card px-2.5 text-[15px] disabled:bg-transparent disabled:border-transparent'
  return (
    <>
      <span className={cx('num text-center text-sm', set.done ? 'text-sage-ink' : 'text-mute')}>{n}</span>
      <input
        aria-label={`Serie ${n}, ${time ? 'segundos' : 'repeticiones'}`}
        type="number"
        inputMode="numeric"
        min={0}
        disabled={disabled}
        className={cls}
        value={(time ? set.seconds : set.reps) ?? ''}
        onChange={(e) => onChange(time ? { seconds: parseInt(e.target.value, 10) || undefined } : { reps: parseInt(e.target.value, 10) || undefined })}
      />
      {time ? (
        <span />
      ) : (
        <input
          aria-label={`Serie ${n}, peso en kilos`}
          type="number"
          inputMode="decimal"
          step={0.5}
          min={0}
          disabled={disabled}
          className={cls}
          value={set.weight ?? ''}
          placeholder="—"
          onChange={(e) => onChange({ weight: parseFloat(e.target.value) || undefined })}
        />
      )}
      <Check checked={set.done} onChange={onToggle} disabled={disabled} label={set.done ? `Desmarcar serie ${n}` : `Marcar serie ${n} como hecha`} color="var(--color-sage-ink)" size={30} />
    </>
  )
}

function FinishDialog({ session, onClose, onDone, scoring }: { session: WorkoutSession; onClose: () => void; onDone: () => void; scoring: ReturnType<typeof useStore.getState>['settings']['scoring'] }) {
  const elapsed = Math.max(1, minutesBetween(session.startedAt, new Date().toISOString()))
  // Long-forgotten sessions: suggest the elapsed time but let the user correct it.
  const [mins, setMins] = useState(String(Math.min(elapsed, 240)))
  const m = Math.max(1, Math.min(600, parseInt(mins, 10) || 1))
  const score = useMemo(() => workoutScore({ ...session, durationMin: m }, scoring), [session, m, scoring])
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="Terminar entreno"
      tone="sage"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Seguir entrenando
          </Button>
          <Button
            variant="primary"
            data-autofocus
            onClick={() => {
              const p = useStore.getState().finishSession(session.id, { durationMin: m })
              toast(p > 0 ? `Entreno completado: +${p} puntos` : 'Entreno guardado', { tone: p > 0 ? 'points' : 'default' })
              onDone()
            }}
          >
            Guardar entreno
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Duración (min)" htmlFor="fin-min" hint={elapsed > 240 ? 'La sesión lleva abierta mucho tiempo: ajusta la duración real.' : undefined}>
          <Input id="fin-min" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <div className="rounded-ctl bg-sage/60 p-4 text-sm">
          <p className="font-display text-2xl font-semibold text-sage-ink">+{score.points} puntos</p>
          <ul className="mt-2 space-y-1 text-ink-2">
            <li>Base por intensidad {INTENSITY_LABEL[session.intensity].toLowerCase()}: {score.base}</li>
            <li>Series completadas: {Math.round(score.completion * 100)} %{score.completion < scoring.minCompletion && score.completion > 0 ? ' (la base se reduce en proporción)' : ''}</li>
            {score.durationBonus > 0 && <li>Extra por duración: +{score.durationBonus}</li>}
            {score.capped && <li>Limitado al máximo por sesión ({scoring.sessionCap})</li>}
          </ul>
          {score.points === 0 && <p className="mt-2 text-danger">No has marcado ninguna serie como hecha, así que esta sesión no suma puntos.</p>}
        </div>
      </div>
    </Modal>
  )
}
