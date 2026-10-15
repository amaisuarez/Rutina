import { useStore, selectData } from '../store'
import { BackupError, localAdapter, normalize, type StorageAdapter } from './storage'
import { emptyData, type AppData } from '../store/defaults'
import { create } from 'zustand'

export const useSaveStatus = create<{ state: 'idle' | 'saving' | 'saved' | 'error'; error?: string }>(() => ({ state: 'idle' }))

let adapter: StorageAdapter = localAdapter
let unsub: (() => void) | null = null

/** Loads persisted data into the store and starts auto-saving every change. */
export function startPersistence(a: StorageAdapter = localAdapter): { recovered: boolean } {
  adapter = a
  unsub?.()
  let recovered = false
  const raw = adapter.load()
  if (raw) {
    try {
      useStore.getState().hydrate(normalize(raw))
    } catch {
      recovered = true
      useStore.getState().hydrate(emptyData())
    }
  }
  useStore.getState().maintain()
  useStore.getState().syncAchievements()

  let timer: ReturnType<typeof setTimeout> | null = null
  let last = selectData(useStore.getState())
  const flush = () => {
    timer = null
    try {
      adapter.save(last)
      useSaveStatus.setState({ state: 'saved', error: undefined })
    } catch (e) {
      const quota = e instanceof DOMException && /quota/i.test(e.name + e.message)
      useSaveStatus.setState({
        state: 'error',
        error: quota ? 'El almacenamiento del navegador está lleno. Exporta una copia y borra datos antiguos.' : 'No se pudieron guardar los cambios.',
      })
    }
  }
  unsub = useStore.subscribe((s) => {
    const next = selectData(s)
    if (Object.keys(next).every((k) => next[k as keyof AppData] === last[k as keyof AppData])) return
    last = next
    useSaveStatus.setState({ state: 'saving' })
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, 250)
  })
  // Never lose the last edit when the tab closes.
  const onHide = () => {
    if (timer) {
      clearTimeout(timer)
      flush()
    }
  }
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide()
    else useStore.getState().maintain()
  })
  return { recovered }
}

/** Replaces all data with an imported backup. Throws BackupError with a readable message. */
export function restoreBackup(json: string): void {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new BackupError('El archivo no es un JSON válido.')
  }
  const data = normalize(parsed)
  data.settings.onboarded = true
  // The user holds this exact file, so it counts as an up-to-date backup.
  data.settings.lastBackupAt = new Date().toISOString()
  useStore.getState().hydrate(data)
  useStore.getState().maintain()
}

export function resetAll(): void {
  const fresh = emptyData()
  useStore.getState().hydrate(fresh)
  adapter.save(fresh)
}
