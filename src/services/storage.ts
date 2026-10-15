import { DATA_VERSION, emptyData, type AppData } from '../store/defaults'

/**
 * Persistence boundary. The app only talks to a `StorageAdapter`, so a remote
 * sync provider (e.g. a backend with auth) can replace `localAdapter` later
 * without touching features. Today everything stays in this browser.
 */
export interface StorageAdapter {
  load(): unknown | null
  save(data: AppData): void
  clear(): void
}

const KEY = 'rutina:data'

export const localAdapter: StorageAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  save(data) {
    localStorage.setItem(KEY, JSON.stringify(data))
  },
  clear() {
    localStorage.removeItem(KEY)
  },
}

/** In-memory adapter for tests. */
export function memoryAdapter(initial: unknown = null): StorageAdapter & { value: unknown } {
  const a = {
    value: initial,
    load: () => (a.value == null ? null : JSON.parse(JSON.stringify(a.value))),
    save: (d: AppData) => {
      a.value = JSON.parse(JSON.stringify(d))
    },
    clear: () => {
      a.value = null
    },
  }
  return a
}

const ARRAY_KEYS = [
  'tasks',
  'taskSeries',
  'templates',
  'scheduled',
  'workoutSeries',
  'sessions',
  'customExercises',
  'accounts',
  'transactions',
  'categories',
  'recurring',
  'goals',
  'ledger',
  'achievements',
] as const satisfies readonly (keyof AppData)[]

export class BackupError extends Error {}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Validates and normalises stored or imported data. Missing collections fall
 * back to defaults; records without an id are dropped; unknown keys are ignored.
 * Throws `BackupError` with a readable message if the payload is not Rutina data.
 */
export function normalize(input: unknown): AppData {
  const raw = isObj(input) && isObj(input.data) && input.app === 'rutina' ? input.data : input
  if (!isObj(raw)) throw new BackupError('El archivo no contiene datos de Rutina.')
  const known = ARRAY_KEYS.some((k) => k in raw) || 'settings' in raw
  if (!known) throw new BackupError('El archivo no tiene el formato de una copia de Rutina.')
  if (typeof raw.version === 'number' && raw.version > DATA_VERSION)
    throw new BackupError('Esta copia es de una versión más reciente de Rutina. Actualiza la página e inténtalo de nuevo.')

  const base = emptyData()
  const out: AppData = { ...base }
  for (const k of ARRAY_KEYS) {
    const v = raw[k]
    if (v === undefined) continue
    if (!Array.isArray(v)) throw new BackupError(`El apartado "${k}" está dañado.`)
    const items = v.filter((x) => isObj(x) && (k === 'achievements' ? typeof x.id === 'string' : typeof x.id === 'string'))
    ;(out as unknown as Record<string, unknown>)[k] = items
  }
  if (isObj(raw.budget)) {
    out.budget = {
      monthlyTotal: typeof raw.budget.monthlyTotal === 'number' ? raw.budget.monthlyTotal : null,
      byCategory: isObj(raw.budget.byCategory) ? (raw.budget.byCategory as Record<string, number>) : {},
    }
  }
  if (isObj(raw.settings)) {
    const s = raw.settings as Partial<AppData['settings']>
    out.settings = {
      ...base.settings,
      ...s,
      goals: { ...base.settings.goals, ...(isObj(s.goals) ? s.goals : {}) },
      scoring: {
        ...base.settings.scoring,
        ...(isObj(s.scoring) ? s.scoring : {}),
      },
      dashboard: isObj(s.dashboard) && Array.isArray(s.dashboard.order) ? s.dashboard : base.settings.dashboard,
    }
  }
  if (out.categories.length === 0) out.categories = base.categories
  if (out.accounts.length === 0) out.accounts = base.accounts
  out.version = DATA_VERSION
  return out
}

export function makeBackup(data: AppData): string {
  return JSON.stringify({ app: 'rutina', exportedAt: new Date().toISOString(), data }, null, 2)
}
