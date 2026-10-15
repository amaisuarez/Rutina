import type { Equipment, Exercise, ExerciseLevel, Intensity, MuscleGroup, Objective, PlannedExercise, WorkoutSession } from '../../types'
import { addDaysISO, today } from '../../utils/dates'
import { MUSCLE_LABEL } from './labels'

/**
 * Rule-based workout recommender. No AI model is involved: every pick is made by
 * the scoring rules below, and each rule that influenced the result is returned
 * in `reasons` so the UI can show exactly why.
 */

export type Ease = 'easy' | 'normal' | 'hard'

export interface RecommendInput {
  focus: MuscleGroup | 'any'
  minutes: number
  ease: Ease
  equipment: Equipment[]
  objective?: Objective
  /** Recently completed sessions, used for recovery. */
  history: WorkoutSession[]
  library: Exercise[]
  ref?: string
}

export interface Recommendation {
  name: string
  focus: MuscleGroup[]
  intensity: Intensity
  objective: Objective
  exercises: PlannedExercise[]
  estimatedMin: number
  reasons: string[]
  warnings: string[]
}

const LEVEL_RANK: Record<ExerciseLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 }
const EASE_MAX_LEVEL: Record<Ease, number> = { easy: 0, normal: 1, hard: 2 }
const WARMUP_MIN = 5

/** Muscle groups worked in sessions completed within the last `hours`. */
export function recentlyTrained(history: WorkoutSession[], library: Exercise[], ref = today(), days = 2): Map<MuscleGroup, string> {
  const byId = new Map(library.map((e) => [e.id, e]))
  const since = addDaysISO(ref, -days + 1)
  const out = new Map<MuscleGroup, string>()
  for (const s of history) {
    if (s.status !== 'completed' || s.date < since || s.date > ref) continue
    for (const se of s.exercises) {
      if (se.skipped || !se.sets.some((x) => x.done)) continue
      const ex = byId.get(se.exerciseId)
      if (!ex || ex.primary === 'mobility' || ex.primary === 'cardio') continue
      const prev = out.get(ex.primary)
      if (!prev || s.date > prev) out.set(ex.primary, s.date)
    }
  }
  return out
}

function hasEquipment(ex: Exercise, available: Equipment[]): boolean {
  // An exercise lists alternatives; one available option is enough. Bodyweight is always available.
  return ex.equipment.some((e) => e === 'none' || e === 'mat' || available.includes(e))
}

export function recommend(input: RecommendInput): Recommendation {
  const ref = input.ref ?? today()
  const reasons: string[] = []
  const warnings: string[] = []
  const recent = recentlyTrained(input.history, input.library, ref)
  const maxLevel = EASE_MAX_LEVEL[input.ease]
  const objective: Objective =
    input.objective ??
    (input.focus === 'cardio' ? 'endurance' : input.focus === 'mobility' ? 'mobility' : input.ease === 'easy' ? 'endurance' : 'hypertrophy')

  reasons.push(
    input.ease === 'easy'
      ? 'Solo ejercicios de nivel principiante, porque pediste algo suave.'
      : input.ease === 'normal'
        ? 'Ejercicios de nivel principiante e intermedio.'
        : 'Incluye ejercicios avanzados, porque pediste un reto.',
  )

  let pool = input.library.filter((e) => LEVEL_RANK[e.level] <= maxLevel && hasEquipment(e, input.equipment))
  const excludedByEquipment = input.library.filter((e) => !hasEquipment(e, input.equipment)).length
  if (excludedByEquipment) reasons.push(`${excludedByEquipment} ejercicios descartados por el material que tienes marcado.`)

  let targets: MuscleGroup[]
  if (input.focus === 'any') {
    // Full body: rotate through groups, preferring ones not trained recently.
    const groups: MuscleGroup[] = ['legs', 'back', 'chest', 'glutes', 'shoulders', 'core', 'arms']
    targets = groups.filter((g) => !recent.has(g))
    const rested = groups.filter((g) => recent.has(g))
    if (rested.length) reasons.push(`Dejamos descansar ${rested.map((g) => MUSCLE_LABEL[g].toLowerCase()).join(', ')}: los entrenaste en las últimas 48 h.`)
    if (targets.length < 3) targets = groups
  } else if (input.focus === 'full_body') {
    targets = ['legs', 'back', 'chest', 'glutes', 'core', 'shoulders']
    pool = pool.filter((e) => e.primary !== 'mobility' && e.primary !== 'cardio')
  } else {
    targets = [input.focus]
    const last = recent.get(input.focus)
    if (last) warnings.push(`Ya entrenaste ${MUSCLE_LABEL[input.focus].toLowerCase()} el ${last === ref ? 'día de hoy' : last}. Considera una sesión más ligera o elige otro grupo.`)
  }

  const score = (e: Exercise): number => {
    let s = 0
    if (targets.includes(e.primary)) s += 10
    if (e.secondary.some((g) => targets.includes(g))) s += 3
    if (e.objectives.includes(objective)) s += 4
    if (input.focus === 'any' && recent.has(e.primary)) s -= 8
    // Prefer harder movements when asked, simpler ones otherwise.
    s += input.ease === 'hard' ? LEVEL_RANK[e.level] : -LEVEL_RANK[e.level]
    if (e.primary === 'full_body' && (input.focus === 'full_body' || input.focus === 'any')) s += 4
    return s
  }

  const ranked = pool
    .map((e) => ({ e, s: score(e) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.minutes - b.e.minutes)

  // Fill the time budget, keeping variety: at most two exercises per primary group (unless single focus).
  const budget = Math.max(10, input.minutes) - WARMUP_MIN
  const perGroupMax = targets.length === 1 ? 6 : 2
  const picked: Exercise[] = []
  const perGroup = new Map<MuscleGroup, number>()
  let used = 0
  const setsFactor = input.ease === 'easy' ? 0.75 : input.ease === 'hard' ? 1.25 : 1
  const fit = (e: Exercise) => Math.max(2, Math.round(e.minutes * setsFactor))
  // Round-robin across target groups so a single group doesn't eat the whole budget.
  for (let round = 0; round < perGroupMax; round++) {
    for (const g of targets) {
      const cand = ranked.find(({ e }) => !picked.includes(e) && (e.primary === g || (targets.length === 1 && e.secondary.includes(g))))
      if (!cand) continue
      if ((perGroup.get(cand.e.primary) ?? 0) >= perGroupMax) continue
      if (used + fit(cand.e) > budget) continue
      picked.push(cand.e)
      perGroup.set(cand.e.primary, (perGroup.get(cand.e.primary) ?? 0) + 1)
      used += fit(cand.e)
    }
  }
  // Top up with any remaining high scorers.
  for (const { e } of ranked) {
    if (picked.includes(e) || used + fit(e) > budget) continue
    if (targets.length > 1 && (perGroup.get(e.primary) ?? 0) >= perGroupMax) continue
    picked.push(e)
    perGroup.set(e.primary, (perGroup.get(e.primary) ?? 0) + 1)
    used += fit(e)
    if (picked.length >= 8) break
  }

  reasons.push(`${picked.length} ejercicios que caben en ${input.minutes} min (incluye ${WARMUP_MIN} min de calentamiento).`)
  if (input.objective) reasons.push(`Priorizamos ejercicios orientados a ${objectiveWord(objective)}.`)
  if (picked.length === 0) warnings.push('No hay ejercicios que encajen con estos filtros. Prueba con más tiempo o más material.')

  const sets = (e: Exercise) =>
    e.kind === 'time' && e.sets === 1 ? 1 : Math.max(1, Math.round(e.sets * (input.ease === 'easy' ? 0.7 : input.ease === 'hard' ? 1.25 : 1)))

  const intensity: Intensity = input.ease === 'easy' ? 'light' : input.ease === 'hard' ? (input.minutes >= 50 ? 'advanced' : 'challenging') : 'standard'
  const focus = input.focus === 'any' ? [...new Set(picked.map((e) => e.primary))] : [input.focus]

  return {
    name: input.focus === 'any' ? 'Sesión recomendada' : `${MUSCLE_LABEL[input.focus]} en ${input.minutes} min`,
    focus,
    intensity,
    objective,
    exercises: picked.map((e) => ({ exerciseId: e.id, sets: sets(e), reps: e.reps, restSec: e.restSec })),
    estimatedMin: used + WARMUP_MIN,
    reasons,
    warnings,
  }
}

function objectiveWord(o: Objective): string {
  return { strength: 'fuerza', hypertrophy: 'ganar masa muscular', endurance: 'resistencia', mobility: 'movilidad', fat_loss: 'quemar grasa', recovery: 'recuperación' }[o]
}
