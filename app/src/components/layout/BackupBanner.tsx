import { useMemo } from 'react'
import { Download, ShieldAlert } from 'lucide-react'
import { selectData, useStore } from '../../store'
import { backupStatus, downloadBackup, snoozeBackupReminder } from '../../services/backup'
import { toast } from '../../store/ui'

/** Gentle reminder to export a backup, since data lives only in this browser. */
export function BackupBanner() {
  const tasks = useStore((s) => s.tasks)
  const transactions = useStore((s) => s.transactions)
  const sessions = useStore((s) => s.sessions)
  const settings = useStore((s) => s.settings)
  const status = useMemo(() => backupStatus(selectData(useStore.getState())), [tasks, transactions, sessions, settings])
  if (!status.due) return null
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-[16px] bg-warn-soft px-4 py-3 text-sm">
      <ShieldAlert size={18} className="shrink-0 text-warn" />
      <p className="min-w-0 flex-1 text-ink-2">
        <span className="font-medium text-ink">{status.never ? 'Aún no has guardado ninguna copia.' : `Hace ${status.daysSince} días que no guardas una copia.`}</span> Tus datos solo
        están en este navegador: descarga una copia para no perderlos.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => snoozeBackupReminder(1)} className="rounded-lg px-3 py-2 font-medium text-mute hover:bg-white/60 hover:text-ink">
          Mañana
        </button>
        <button
          type="button"
          onClick={() => {
            downloadBackup()
            toast('Copia de seguridad descargada')
          }}
          className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 font-medium text-paper"
        >
          <Download size={15} /> Descargar copia
        </button>
      </div>
    </div>
  )
}
