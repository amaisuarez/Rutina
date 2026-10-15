import { create } from 'zustand'
import { selectData, useStore } from '../store'
import type { AppData } from '../store/defaults'
import { makeBackup } from './storage'
import { download } from '../utils/csv'
import { today } from '../utils/dates'

/** Days without a backup before the reminder appears. */
export const BACKUP_INTERVAL_DAYS = 7
const DAY = 86_400_000

/** Oldest timestamp of anything the user created (demo data excluded). */
function firstActivity(d: AppData): string | null {
  let first: string | null = null
  const consider = (t?: string, demo?: boolean) => {
    if (t && !demo && (!first || t < first)) first = t
  }
  for (const x of d.tasks) consider(x.createdAt, x.demo)
  for (const x of d.transactions) consider(x.createdAt, x.demo)
  for (const x of d.sessions) consider(x.startedAt, x.demo)
  for (const x of d.templates) consider(x.createdAt, x.demo)
  for (const x of d.goals) consider(x.createdAt, x.demo)
  return first
}

/**
 * Whether to remind the user to export a backup. Due when there is real
 * (non-demo) data and the last backup — or, if none, the first activity —
 * is older than BACKUP_INTERVAL_DAYS, unless snoozed.
 */
export function backupStatus(d: AppData, now = Date.now()): { due: boolean; daysSince: number | null; never: boolean } {
  const base = d.settings.lastBackupAt ?? firstActivity(d)
  const daysSince = base ? Math.floor((now - new Date(base).getTime()) / DAY) : null
  const snoozed = !!d.settings.backupSnoozedUntil && new Date(d.settings.backupSnoozedUntil).getTime() > now
  return {
    due: daysSince !== null && daysSince >= BACKUP_INTERVAL_DAYS && !snoozed,
    daysSince,
    never: !d.settings.lastBackupAt,
  }
}

export function downloadBackup() {
  const data = selectData(useStore.getState())
  download(`rutina-copia-${today()}.json`, makeBackup(data), 'application/json')
  useStore.getState().updateSettings({ lastBackupAt: new Date().toISOString(), backupSnoozedUntil: undefined })
}

export function snoozeBackupReminder(days = 1) {
  useStore.getState().updateSettings({ backupSnoozedUntil: new Date(Date.now() + days * DAY).toISOString() })
}

/* ------------------------------------------------------------------ */
/* Persistent storage                                                  */
/* ------------------------------------------------------------------ */

/**
 * `granted`: the browser promised not to evict our data under storage pressure.
 * `denied`: it may still evict it (common until the site is used more or installed).
 * `unsupported`: the Storage API is not available (older browsers).
 */
export type PersistState = 'unknown' | 'granted' | 'denied' | 'unsupported'

export const usePersistState = create<{ state: PersistState }>(() => ({ state: 'unknown' }))

export async function checkPersistence(request: boolean): Promise<PersistState> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
  if (!storage?.persist || !storage.persisted) {
    usePersistState.setState({ state: 'unsupported' })
    return 'unsupported'
  }
  let granted = await storage.persisted().catch(() => false)
  if (!granted && request) granted = await storage.persist().catch(() => false)
  const state: PersistState = granted ? 'granted' : 'denied'
  usePersistState.setState({ state })
  return state
}
