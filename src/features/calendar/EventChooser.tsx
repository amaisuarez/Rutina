import { Dumbbell, ListChecks } from 'lucide-react'
import { openComposer } from '../../store/ui'
import { Modal } from '../../components/ui/Modal'
import { capitalize, fmt } from '../../utils/dates'

/** Composer: choose whether to add a task or a workout on a date. */
export function EventChooser({ date, onClose }: { date: string; onClose: () => void }) {
  return (
    <Modal open size="sm" onClose={onClose} title="Añadir a la agenda" description={capitalize(fmt(date, "EEEE d 'de' MMMM"))}>
      <div className="grid gap-2">
        <button type="button" data-autofocus onClick={() => openComposer({ kind: 'task', date })} className="flex items-center gap-3 rounded-[16px] bg-sky p-4 text-left hover:brightness-[.97]">
          <ListChecks className="text-sky-ink" />
          <span>
            <span className="block font-medium">Tarea</span>
            <span className="block text-[13px] text-ink-2">Algo que hacer ese día, con hora opcional</span>
          </span>
        </button>
        <button type="button" onClick={() => openComposer({ kind: 'workout', date })} className="flex items-center gap-3 rounded-[16px] bg-sage p-4 text-left hover:brightness-[.97]">
          <Dumbbell className="text-sage-ink" />
          <span>
            <span className="block font-medium">Entreno</span>
            <span className="block text-[13px] text-ink-2">Programa una de tus rutinas</span>
          </span>
        </button>
      </div>
    </Modal>
  )
}
