import type { Difficulty, Intensity, PointEntry, ScoringConfig, Task, WorkoutSession } from '../../types'

/**
 * Points engine. Pure functions only — the store calls these and persists the
 * resulting ledger entries. Nothing in this module (or anything it imports)
 * touches finance data.
 */

export const DEFAULT_SCORING: ScoringConfig = {
  task: { easy: 5, medium: 10, hard: 20, very_hard: 30 },
  taskDuration: { enabled: true, perHour: 5, max: 10 },
  workout: { light: 10, standard: 20, challenging: 30, advanced: 40 },
  workoutDuration: { baselineMin: 45, per15: 2, max: 10 },
  minCompletion: 0.5,
  sessionCap: 50,
}

export function taskPoints(task: Pick<Task, 'difficulty' | 'estimatedMin'>, cfg: ScoringConfig): number {
  const base = cfg.task[task.difficulty] ?? 0
  let bonus = 0
  if (cfg.taskDuration.enabled && task.estimatedMin && task.estimatedMin > 60) {
    const extraHours = Math.floor((task.estimatedMin - 60) / 60)
    bonus = Math.min(cfg.taskDuration.max, extraHours * cfg.taskDuration.perHour)
  }
  return Math.max(0, Math.round(base + bonus))
}

export interface WorkoutScore {
  points: number
  base: number
  durationBonus: number
  completion: number
  capped: boolean
}

/** Share of planned sets (in non-skipped exercises) that were marked done. Skipped exercises count as not done. */
export function sessionCompletion(session: Pick<WorkoutSession, 'exercises'>): number {
  let total = 0
  let done = 0
  for (const ex of session.exercises) {
    total += ex.sets.length
    if (!ex.skipped) done += ex.sets.filter((s) => s.done).length
  }
  return total === 0 ? 0 : done / total
}

export function workoutScore(
  session: Pick<WorkoutSession, 'intensity' | 'durationMin' | 'exercises'>,
  cfg: ScoringConfig,
): WorkoutScore {
  const completion = sessionCompletion(session)
  const base = cfg.workout[session.intensity] ?? 0
  if (completion === 0) return { points: 0, base, durationBonus: 0, completion, capped: false }
  const factor = completion >= cfg.minCompletion ? 1 : completion
  const extra = Math.max(0, (session.durationMin ?? 0) - cfg.workoutDuration.baselineMin)
  const durationBonus = Math.min(cfg.workoutDuration.max, Math.floor(extra / 15) * cfg.workoutDuration.per15)
  const raw = Math.round(base * factor + (factor === 1 ? durationBonus : 0))
  const points = Math.min(cfg.sessionCap, raw)
  return { points, base, durationBonus: factor === 1 ? durationBonus : 0, completion, capped: raw > cfg.sessionCap }
}

/** Net points currently held by one activity. */
export function netForSource(ledger: PointEntry[], sourceType: PointEntry['sourceType'], sourceId: string): number {
  let n = 0
  for (const e of ledger) if (e.sourceType === sourceType && e.sourceId === sourceId) n += e.points
  return n
}

/**
 * Award policy (documented in Ajustes → Puntos):
 *  - An activity holds at most one award at a time (net > 0 ⇒ no new award).
 *  - Reopening posts a reversal of the net amount; completing again awards once more
 *    at the *current* rules. Net per activity therefore never exceeds one award.
 *  - Editing a completed activity changes nothing in the ledger.
 */
export function canAward(ledger: PointEntry[], sourceType: PointEntry['sourceType'], sourceId: string): boolean {
  return netForSource(ledger, sourceType, sourceId) <= 0
}

/* ------------------------------------------------------------------ */
/* Levels                                                              */
/* ------------------------------------------------------------------ */

/** Cumulative points needed to *reach* level n (n ≥ 1): 0, 100, 300, 600, 1000, … */
export function levelThreshold(n: number): number {
  return 50 * n * (n - 1)
}

export function levelFor(total: number): { level: number; current: number; next: number; progress: number } {
  let level = 1
  while (levelThreshold(level + 1) <= total) level++
  const current = levelThreshold(level)
  const next = levelThreshold(level + 1)
  return { level, current, next, progress: (total - current) / (next - current) }
}

export const LEVEL_TITLES = [
  'Primeros pasos',
  'En marcha',
  'Con ritmo',
  'Constante',
  'Disciplinado',
  'Imparable',
  'Referente',
  'Maestro de la rutina',
]

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, level - 1)]
}

export const INTENSITY_LABEL: Record<Intensity, string> = {
  light: 'Ligera',
  standard: 'Estándar',
  challenging: 'Exigente',
  advanced: 'Avanzada',
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Fácil',
  medium: 'Media',
  hard: 'Difícil',
  very_hard: 'Muy difícil',
}
