import { useState, type FormEvent } from 'react'
import { Plus, Repeat, X } from 'lucide-react'
import type { Difficulty, Priority, Subtask, Task, TaskRecurrenceFreq } from '../../types'
import { useStore } from '../../store'
import { closeComposer, toast } from '../../store/ui'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Segmented, Select, Textarea } from '../../components/ui/Form'
import { DIFFICULTIES, FREQ_LABEL, PRIORITIES, PRIORITY_LABEL } from './logic'
import { DIFFICULTY_LABEL, taskPoints } from '../gamification/scoring'
import { uid } from '../../utils/id'
import { today } from '../../utils/dates'

export function TaskForm({ task, date }: { task?: Task; date?: string }) {
  const settings = useStore((s) => s.settings)
  const series = useStore((s) => (task?.seriesId ? s.taskSeries.find((x) => x.id === task.seriesId) : undefined))
  const { addTask, updateTask } = useStore.getState()

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [taskDate, setTaskDate] = useState(task ? (task.date ?? '') : (date ?? today()))
  const [startTime, setStartTime] = useState(task?.startTime ?? '')
  const [endTime, setEndTime] = useState(task?.endTime ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [difficulty, setDifficulty] = useState<Difficulty>(task?.difficulty ?? 'medium')
  const [estimated, setEstimated] = useState(task?.estimatedMin ? String(task.estimatedMin) : '')
  const [category, setCategory] = useState(task?.category ?? settings.taskCategories[0] ?? 'Otros')
  const [deadline, setDeadline] = useState(task?.deadline ?? '')
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? [])
  const [newSub, setNewSub] = useState('')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [repeat, setRepeat] = useState<TaskRecurrenceFreq | ''>('')
  const [until, setUntil] = useState('')
  const [scope, setScope] = useState<'one' | 'future'>('one')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const est = estimated ? parseInt(estimated, 10) : undefined
  const preview = taskPoints({ difficulty, estimatedMin: est }, settings.scoring)

  const addSub = () => {
    const t = newSub.trim()
    if (!t) return
    setSubtasks((s) => [...s, { id: uid('st'), title: t, done: false }])
    setNewSub('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err: Record<string, string> = {}
    if (!title.trim()) err.title = 'Escribe un título para la tarea.'
    if (startTime && endTime && endTime <= startTime) err.endTime = 'La hora de fin debe ser posterior a la de inicio.'
    if (endTime && !startTime) err.startTime = 'Indica también la hora de inicio.'
    if (estimated && (!est || est < 1 || est > 1440)) err.estimated = 'Indica minutos entre 1 y 1440.'
    if (repeat && !taskDate) err.date = 'Una tarea que se repite necesita fecha de inicio.'
    if (repeat && until && until < taskDate) err.until = 'La fecha final debe ser posterior al inicio.'
    setErrors(err)
    if (Object.keys(err).length) return

    const input = {
      title: title.trim(),
      description: description.trim() || undefined,
      date: taskDate || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      priority,
      difficulty,
      estimatedMin: est,
      category,
      deadline: deadline || undefined,
      subtasks,
      notes: notes.trim() || undefined,
    }
    if (task) {
      updateTask(task.id, input, scope)
      toast(scope === 'future' ? 'Tarea y repeticiones siguientes actualizadas' : 'Tarea actualizada')
    } else {
      addTask(input, repeat ? { freq: repeat, until: until || undefined } : undefined)
      toast(repeat ? `Tarea creada. Se repite: ${FREQ_LABEL[repeat].toLowerCase()}` : 'Tarea creada')
    }
    closeComposer()
  }

  return (
    <Modal
      open
      onClose={closeComposer}
      title={task ? 'Editar tarea' : 'Nueva tarea'}
      tone="sky"
      footer={
        <>
          <p className="mr-auto text-[13px] text-sky-ink">
            {task?.status === 'completed' ? 'Los puntos ya otorgados no cambian al editar.' : `Vale ${preview} puntos al completarla`}
          </p>
          <Button variant="ghost" onClick={closeComposer}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="task-form">
            {task ? 'Guardar cambios' : 'Crear tarea'}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Título" htmlFor="t-title" error={errors.title}>
          <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Preparar la reunión del lunes" aria-invalid={!!errors.title} maxLength={140} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Fecha" htmlFor="t-date" error={errors.date} hint={!taskDate ? 'Sin fecha: aparece en «Todas».' : undefined}>
            <Input id="t-date" type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} />
          </Field>
          <Field label="Inicio" htmlFor="t-start" error={errors.startTime}>
            <Input id="t-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="Fin" htmlFor="t-end" error={errors.endTime}>
            <Input id="t-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-invalid={!!errors.endTime} />
          </Field>
        </div>

        <Field label="Prioridad">
          <Segmented label="Prioridad" value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
        </Field>
        <Field label="Dificultad" hint="La dificultad decide los puntos de productividad.">
          <Segmented
            label="Dificultad"
            value={difficulty}
            onChange={setDifficulty}
            options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABEL[d], title: `${settings.scoring.task[d]} puntos` }))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Categoría" htmlFor="t-cat">
            <Select id="t-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {[...new Set([...settings.taskCategories, category])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Duración estimada (min)" htmlFor="t-est" error={errors.estimated}>
            <Input id="t-est" inputMode="numeric" value={estimated} onChange={(e) => setEstimated(e.target.value.replace(/\D/g, ''))} placeholder="30" />
          </Field>
          <Field label="Fecha límite" htmlFor="t-deadline">
            <Input id="t-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>

        <Field label="Descripción" htmlFor="t-desc">
          <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Subtareas</p>
          {subtasks.length > 0 && (
            <ul className="mb-2 divide-y divide-line rounded-ctl border border-line">
              {subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3 text-sm">
                  <span className={s.done ? 'text-mute line-through' : ''}>{s.title}</span>
                  <button
                    type="button"
                    className="ml-auto grid size-8 place-items-center rounded-full text-mute hover:bg-sunken hover:text-ink"
                    aria-label={`Quitar subtarea ${s.title}`}
                    onClick={() => setSubtasks((x) => x.filter((y) => y.id !== s.id))}
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSub()
                }
              }}
              placeholder="Añadir un paso"
              aria-label="Nueva subtarea"
            />
            <Button onClick={addSub} icon={<Plus size={16} />} disabled={!newSub.trim()}>
              Añadir
            </Button>
          </div>
        </div>

        <Field label="Notas" htmlFor="t-notes">
          <Textarea id="t-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>

        {!task && (
          <div className="grid gap-4 rounded-ctl bg-sunken p-4 sm:grid-cols-2">
            <Field label="Repetir" htmlFor="t-repeat">
              <Select id="t-repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as TaskRecurrenceFreq | '')}>
                <option value="">No se repite</option>
                {(Object.keys(FREQ_LABEL) as TaskRecurrenceFreq[]).map((f) => (
                  <option key={f} value={f}>
                    {FREQ_LABEL[f]}
                  </option>
                ))}
              </Select>
            </Field>
            {repeat && (
              <Field label="Hasta (opcional)" htmlFor="t-until" error={errors.until}>
                <Input id="t-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
              </Field>
            )}
          </div>
        )}

        {task && series && (
          <div className="rounded-ctl bg-sunken p-4">
            <p className="mb-2 flex items-center gap-2 text-sm text-ink-2">
              <Repeat size={15} /> Esta tarea se repite ({FREQ_LABEL[series.freq].toLowerCase()}).
            </p>
            <Segmented
              label="Aplicar cambios a"
              value={scope}
              onChange={setScope}
              size="sm"
              options={[
                { value: 'one', label: 'Solo esta' },
                { value: 'future', label: 'Esta y las siguientes' },
              ]}
            />
          </div>
        )}
      </form>
    </Modal>
  )
}
