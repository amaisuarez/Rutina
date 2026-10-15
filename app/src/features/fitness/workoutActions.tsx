import { useNavigate } from 'react-router-dom'
import { BookOpen, Check as CheckIcon, Dumbbell, Play, Repeat, Trash2, Undo2 } from 'lucide-react'
import type { ScheduledWorkout, WorkoutTemplate } from '../../types'
import { useStore } from '../../store'
import { choose, confirm, pointsToast, toast } from '../../store/ui'
import { useToday } from '../../hooks/useToday'
import { Button } from '../../components/ui/Button'
import { Menu } from '../../components/ui/Misc'
import { cx } from '../../components/ui/cx'
import { duration } from '../../utils/format'

export function useWorkoutActions() {
  const navigate = useNavigate()
  const s = useStore.getState
  return {
    start(w: ScheduledWorkout) {
      navigate(`/entreno/sesion/${s().startSession({ scheduledId: w.id })}`)
    },
    startTemplate(t: WorkoutTemplate) {
      navigate(`/entreno/sesion/${s().startSession({ templateId: t.id })}`)
    },
    quickDone(w: ScheduledWorkout) {
      const p = s().quickCompleteScheduled(w.id)
      if (p > 0) toast(`Entreno completado: +${p} puntos`, { tone: 'points', action: { label: 'Deshacer', run: () => pointsToast(s().reopenScheduled(w.id), 'Entreno desmarcado') } })
      else toast('Entreno completado')
    },
    undo(w: ScheduledWorkout) {
      pointsToast(s().reopenScheduled(w.id), 'Entreno marcado como no hecho')
    },
    skip(w: ScheduledWorkout) {
      s().skipScheduled(w.id)
      toast(w.status === 'skipped' ? 'Entreno recuperado' : 'Entreno saltado. Descansar también es parte del plan.')
    },
    async remove(w: ScheduledWorkout) {
      if (w.seriesId) {
        const r = await choose({ title: 'Quitar entreno del plan', body: 'Este entreno forma parte de un plan semanal.', confirmLabel: 'Este y los siguientes', altLabel: 'Solo este', tone: 'danger' })
        if (!r) return
        s().deleteScheduled(w.id, r === 'main' ? 'future' : 'one')
      } else {
        const ok = await confirm({ title: 'Quitar entreno programado', confirmLabel: 'Quitar', tone: 'danger' })
        if (!ok) return
        s().deleteScheduled(w.id)
      }
      toast('Entreno quitado del plan')
    },
  }
}

export function WorkoutRow({ w, compact }: { w: ScheduledWorkout; compact?: boolean }) {
  const tpl = useStore((s) => s.templates.find((t) => t.id === w.templateId))
  const a = useWorkoutActions()
  const t0 = useToday()
  const done = w.status === 'completed'
  const skipped = w.status === 'skipped'
  const navigate = useNavigate()
  return (
    <div className={cx('flex items-center gap-3 rounded-[14px] p-2.5', done ? 'bg-sage/60' : skipped ? 'bg-sunken/70' : 'bg-card')}>
      <span className={cx('grid size-9 shrink-0 place-items-center rounded-full', done ? 'bg-sage-ink text-white' : 'bg-sage text-sage-ink')}>{done ? <CheckIcon size={16} /> : <Dumbbell size={16} />}</span>
      <div className="min-w-0 flex-1">
        <p className={cx('truncate text-[14.5px] font-medium', skipped && 'text-mute line-through')}>{tpl?.name ?? 'Rutina eliminada'}</p>
        <p className="text-[12.5px] text-mute">
          {w.time && <span className="num">{w.time}, </span>}
          {tpl ? duration(tpl.estimatedMin) : ''}
          {w.seriesId && <Repeat size={11} className="ml-1.5 inline" aria-label="Plan semanal" />}
          {skipped && ', saltado'}
        </p>
      </div>
      {!compact && !done && !skipped && w.date <= t0 && tpl && (
        <Button size="sm" variant="primary" icon={<Play size={14} />} onClick={() => a.start(w)}>
          Empezar
        </Button>
      )}
      <Menu
        label={`Opciones de ${tpl?.name ?? 'entreno'}`}
        items={[
          { label: 'Empezar ahora', icon: <Play size={15} />, onSelect: () => a.start(w), hidden: done || !tpl },
          { label: 'Marcar como hecho', icon: <CheckIcon size={15} />, onSelect: () => a.quickDone(w), hidden: done || !tpl || w.date > t0 },
          { label: 'Ver sesión', icon: <BookOpen size={15} />, onSelect: () => navigate(`/entreno/sesion/${w.sessionId}`), hidden: !done || !w.sessionId },
          { label: 'Marcar como no hecho', icon: <Undo2 size={15} />, onSelect: () => a.undo(w), hidden: !done },
          { label: skipped ? 'Recuperar' : 'Saltar (descanso)', icon: <Undo2 size={15} />, onSelect: () => a.skip(w), hidden: done },
          { label: 'Quitar del plan', icon: <Trash2 size={15} />, onSelect: () => a.remove(w), danger: true, hidden: done },
        ]}
      />
    </div>
  )
}
