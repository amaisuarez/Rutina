import type { Exercise, MuscleGroup, WorkoutSession } from '../../types'
import { inRange } from '../../utils/dates'

/** Volume = Σ reps × weight across completed sets (kg). Bodyweight sets count reps only via `reps`. */
export function sessionVolume(s: WorkoutSession): number {
  let v = 0
  for (const ex of s.exercises) {
    if (ex.skipped) continue
    for (const set of ex.sets) if (set.done && set.reps && set.weight) v += set.reps * set.weight
  }
  return v
}

export function setsDone(s: WorkoutSession): number {
  return s.exercises.reduce((n, ex) => n + (ex.skipped ? 0 : ex.sets.filter((x) => x.done).length), 0)
}

export function completedIn(sessions: WorkoutSession[], start: string, end: string): WorkoutSession[] {
  return sessions.filter((s) => s.status === 'completed' && inRange(s.date, start, end))
}

export function muscleSetCounts(sessions: WorkoutSession[], byId: Map<string, Exercise>): Map<MuscleGroup, number> {
  const m = new Map<MuscleGroup, number>()
  for (const s of sessions)
    for (const ex of s.exercises) {
      if (ex.skipped) continue
      const def = byId.get(ex.exerciseId)
      if (!def) continue
      const n = ex.sets.filter((x) => x.done).length
      if (n) m.set(def.primary, (m.get(def.primary) ?? 0) + n)
    }
  return m
}

export interface PersonalRecord {
  exerciseId: string
  weight: number
  reps: number
  date: string
}

/** Heaviest completed set per exercise (ties broken by reps). */
export function personalRecords(sessions: WorkoutSession[]): Map<string, PersonalRecord> {
  const prs = new Map<string, PersonalRecord>()
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    for (const ex of s.exercises) {
      if (ex.skipped) continue
      for (const set of ex.sets) {
        if (!set.done || !set.weight) continue
        const cur = prs.get(ex.exerciseId)
        if (!cur || set.weight > cur.weight || (set.weight === cur.weight && (set.reps ?? 0) > cur.reps))
          prs.set(ex.exerciseId, { exerciseId: ex.exerciseId, weight: set.weight, reps: set.reps ?? 0, date: s.date })
      }
    }
  }
  return prs
}

/** Best weight per session for one exercise, chronological. */
export function weightProgress(sessions: WorkoutSession[], exerciseId: string) {
  return sessions
    .filter((s) => s.status === 'completed')
    .map((s) => {
      let best = 0
      for (const ex of s.exercises)
        if (ex.exerciseId === exerciseId && !ex.skipped) for (const set of ex.sets) if (set.done && set.weight) best = Math.max(best, set.weight)
      return { date: s.date, weight: best }
    })
    .filter((x) => x.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}
