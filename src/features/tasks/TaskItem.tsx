import { useState } from 'react'
import { AlarmClock, ArrowRight, CalendarClock, Copy, Flag, ListChecks, Pencil, PlayCircle, Repeat, RotateCcw, Trash2, XCircle } from 'lucide-react'
import type { Task } from '../../types'
import { useStore } from '../../store'
import { choose, confirm, openComposer, pointsToast, toast } from '../../store/ui'
import { Check } from '../../components/ui/Check'
import { Badge, Menu } from '../../components/ui/Misc'
import { cx } from '../../components/ui/cx'
import { PRIORITY_LABEL, isOverdue } from './logic'
import { DIFFICULTY_LABEL, netForSource } from '../gamification/scoring'
import { addDaysISO, relativeDay, today } from '../../utils/dates'

/** Actions shared by every place a task appears, with consistent feedback. */
export function useTaskActions() {
  const s = useStore.getState
  return {
    toggle(task: Task) {
      if (task.status === 'completed') {
        const p = s().reopenTask(task.id)
        pointsToast(p, 'Tarea reabierta')
      } else {
        const p = s().completeTask(task.id)
        if (p > 0) toast(`Tarea completada: +${p} puntos`, { tone: 'points', action: { label: 'Deshacer', run: () => pointsToast(s().reopenTask(task.id), 'Tarea reabierta') } })
        else toast('Tarea completada')
      }
    },
    move(task: Task, date: string) {
      s().moveTask(task.id, date)
      toast(`Tarea movida a ${relativeDay(date).toLowerCase()}`)
    },
    missed(task: Task) {
      s().setTaskStatus(task.id, 'missed')
      toast('Marcada como no realizada')
    },
    start(task: Task) {
      s().setTaskStatus(task.id, task.status === 'in_progress' ? 'pending' : 'in_progress')
    },
    duplicate(task: Task) {
      const c = s().duplicateTask(task.id)
      if (c) toast('Tarea duplicada', { action: { label: 'Editar', run: () => openComposer({ kind: 'task', task: c }) } })
    },
    async remove(task: Task) {
      const held = netForSource(s().ledger, 'task', task.id)
      let scope: 'one' | 'future' = 'one'
      const pointsNote = held > 0 ? ` La tarea está completada: se retirarán los ${held} puntos que te dio.` : ''
      if (task.seriesId) {
        const r = await choose({
          title: `Eliminar «${task.title}»`,
          body: `Esta tarea se repite. Las anteriores se conservan.${pointsNote}`,
          confirmLabel: 'Esta y las siguientes',
          altLabel: 'Solo esta',
          tone: 'danger',
        })
        if (!r) return
        scope = r === 'main' ? 'future' : 'one'
      } else {
        const ok = await confirm({ title: `Eliminar «${task.title}»`, body: `Esta acción no se puede deshacer.${pointsNote}`, confirmLabel: 'Eliminar', tone: 'danger' })
        if (!ok) return
      }
      s().deleteTask(task.id, scope)
      toast(scope === 'future' ? 'Tarea y repeticiones siguientes eliminadas' : 'Tarea eliminada')
    },
  }
}

const priorityTone = { urgent: 'danger', high: 'warn', medium: 'neutral', low: 'neutral' } as const

export function TaskItem({ task, showDate, draggable, compact }: { task: Task; showDate?: boolean; draggable?: boolean; compact?: boolean }) {
  const a = useTaskActions()
  const [justDone, setJustDone] = useState(false)
  const done = task.status === 'completed'
  const missed = task.status === 'missed'
  const overdue = isOverdue(task)
  const subDone = task.subtasks.filter((s) => s.done).length
  const t0 = today()

  return (
    <li
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/x-task', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cx(
        'row-done group relative flex items-start gap-3 rounded-[14px] px-3 py-3 transition-colors hover:bg-sunken/70',
        (done || missed) && 'opacity-60',
        justDone && 'animate-[pop_320ms_ease-out]',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <div className="pt-0.5">
        <Check
          checked={done}
          label={done ? `Reabrir «${task.title}»` : `Completar «${task.title}»`}
          onChange={() => {
            if (!done) setJustDone(true)
            a.toggle(task)
          }}
        />
      </div>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openComposer({ kind: 'task', task })} aria-label={`Editar «${task.title}»`}>
        <p className={cx('text-[15px] leading-snug font-medium break-words', (done || missed) && 'line-through decoration-ink/40')}>{task.title}</p>
        {!compact && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-mute">
            {showDate && task.date && <span className={cx(overdue && 'text-danger')}>{relativeDay(task.date, t0)}</span>}
            {task.startTime && (
              <span className="num">
                {task.startTime}
                {task.endTime && `–${task.endTime}`}
              </span>
            )}
            <span>{task.category}</span>
            <span>{DIFFICULTY_LABEL[task.difficulty]}</span>
            {task.subtasks.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListChecks size={13} /> {subDone}/{task.subtasks.length}
              </span>
            )}
            {task.seriesId && <Repeat size={13} aria-label="Se repite" />}
            {task.deadline && (
              <span className={cx('inline-flex items-center gap-1', task.deadline < t0 && !done ? 'text-danger' : '')}>
                <AlarmClock size={13} /> Límite {relativeDay(task.deadline, t0).toLowerCase()}
              </span>
            )}
          </div>
        )}
      </button>
      <div className="flex shrink-0 items-center gap-1.5">
        {missed && <Badge>No realizada</Badge>}
        {task.status === 'in_progress' && <Badge tone="sky">En curso</Badge>}
        {overdue && <Badge tone="danger">Vencida</Badge>}
        {(task.priority === 'urgent' || task.priority === 'high') && !done && !missed && (
          <Badge tone={priorityTone[task.priority]} title={`Prioridad ${PRIORITY_LABEL[task.priority].toLowerCase()}`}>
            <Flag size={12} />
            <span className="hidden sm:inline">{PRIORITY_LABEL[task.priority]}</span>
          </Badge>
        )}
        <Menu
          label={`Opciones de «${task.title}»`}
          items={[
            { label: 'Editar', icon: <Pencil size={15} />, onSelect: () => openComposer({ kind: 'task', task }) },
            { label: task.status === 'in_progress' ? 'Quitar «en curso»' : 'Marcar en curso', icon: <PlayCircle size={15} />, onSelect: () => a.start(task), hidden: done || missed },
            { label: 'Pasar a hoy', icon: <ArrowRight size={15} />, onSelect: () => a.move(task, t0), hidden: done || task.date === t0 },
            { label: 'Pasar a mañana', icon: <CalendarClock size={15} />, onSelect: () => a.move(task, addDaysISO(t0, 1)), hidden: done },
            { label: 'Marcar como no realizada', icon: <XCircle size={15} />, onSelect: () => a.missed(task), hidden: done || missed },
            { label: 'Reabrir', icon: <RotateCcw size={15} />, onSelect: () => useStore.getState().setTaskStatus(task.id, 'pending'), hidden: !missed },
            { label: 'Duplicar', icon: <Copy size={15} />, onSelect: () => a.duplicate(task) },
            { label: 'Eliminar', icon: <Trash2 size={15} />, onSelect: () => a.remove(task), danger: true },
          ]}
        />
      </div>
    </li>
  )
}

/** Inline resolution bar for overdue tasks: reschedule, leave, or mark missed — never auto-complete. */
export function OverdueBar({ tasks }: { tasks: Task[] }) {
  const t0 = today()
  if (!tasks.length) return null
  const { moveTask, setTaskStatus } = useStore.getState()
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[14px] bg-danger-soft px-4 py-3 text-sm text-danger">
      <AlarmClock size={16} />
      <span className="mr-auto font-medium">
        {tasks.length === 1 ? '1 tarea vencida' : `${tasks.length} tareas vencidas`}
      </span>
      <button
        type="button"
        className="rounded-lg px-2.5 py-1.5 font-medium hover:bg-white/50"
        onClick={() => {
          tasks.forEach((t) => moveTask(t.id, t0))
          toast(`${tasks.length === 1 ? 'Tarea pasada' : 'Tareas pasadas'} a hoy`)
        }}
      >
        Pasar todas a hoy
      </button>
      <button
        type="button"
        className="rounded-lg px-2.5 py-1.5 font-medium hover:bg-white/50"
        onClick={async () => {
          const ok = await confirm({ title: 'Marcar como no realizadas', body: `Las ${tasks.length} tareas vencidas quedarán como no realizadas. No restan puntos.`, confirmLabel: 'Marcar' })
          if (!ok) return
          tasks.forEach((t) => setTaskStatus(t.id, 'missed'))
          toast('Marcadas como no realizadas')
        }}
      >
        No realizadas
      </button>
    </div>
  )
}
