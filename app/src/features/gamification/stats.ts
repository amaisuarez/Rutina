import type { PointCategory, PointEntry, Task, UnlockedAchievement, WorkoutSession } from '../../types'
import { addDaysISO, dateOf, inRange, monthKey, today, weekStart, diffDays } from '../../utils/dates'

/** Activity inputs for streaks and achievements. Deliberately excludes any finance data. */
export interface ActivityInput {
  tasks: Task[]
  sessions: WorkoutSession[]
  ledger: PointEntry[]
}

export function sumPoints(ledger: PointEntry[], start: string, end: string, category?: PointCategory): number {
  let n = 0
  for (const e of ledger) {
    if (category && e.category !== category) continue
    if (inRange(e.date, start, end)) n += e.points
  }
  return Math.max(0, n)
}

export function totalPoints(ledger: PointEntry[], category?: PointCategory): number {
  let n = 0
  for (const e of ledger) if (!category || e.category === category) n += e.points
  return Math.max(0, n)
}

export function completedTaskDates(tasks: Task[]): string[] {
  return tasks.filter((t) => t.status === 'completed' && t.completedAt).map((t) => dateOf(t.completedAt!))
}

export function completedSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions.filter((s) => s.status === 'completed')
}

/** Days with at least one completed task or workout. */
export function productiveDays({ tasks, sessions }: Pick<ActivityInput, 'tasks' | 'sessions'>): Set<string> {
  const set = new Set<string>(completedTaskDates(tasks))
  for (const s of completedSessions(sessions)) set.add(s.date)
  return set
}

/** Current streak: consecutive productive days ending today (or yesterday, if today has nothing yet). */
export function currentStreak(days: Set<string>, ref = today()): number {
  let d = days.has(ref) ? ref : addDaysISO(ref, -1)
  let n = 0
  while (days.has(d)) {
    n++
    d = addDaysISO(d, -1)
  }
  return n
}

export function longestStreak(days: Set<string>): number {
  const sorted = [...days].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const d of sorted) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

/** Points per category for each week (Mon–Sun) that overlaps the month. */
export function weeklyBreakdown(ledger: PointEntry[], monthStartISO: string, monthEndISO: string) {
  const weeks: { start: string; end: string; fitness: number; productivity: number }[] = []
  for (let ws = weekStart(monthStartISO); ws <= monthEndISO; ws = addDaysISO(ws, 7)) {
    const s = ws < monthStartISO ? monthStartISO : ws
    const we = addDaysISO(ws, 6)
    const e = we > monthEndISO ? monthEndISO : we
    weeks.push({
      start: s,
      end: e,
      fitness: sumPoints(ledger, s, e, 'fitness'),
      productivity: sumPoints(ledger, s, e, 'productivity'),
    })
  }
  return weeks
}

export function pointsByMonth(ledger: PointEntry[]) {
  const map = new Map<string, { fitness: number; productivity: number }>()
  for (const e of ledger) {
    const k = monthKey(e.date)
    const m = map.get(k) ?? { fitness: 0, productivity: 0 }
    m[e.category] += e.points
    map.set(k, m)
  }
  return map
}

/* ------------------------------------------------------------------ */
/* Achievements                                                        */
/* ------------------------------------------------------------------ */

export interface AchievementDef {
  id: string
  title: string
  description: string
  category: PointCategory | 'balance'
  /** Returns progress 0..1; 1 = unlocked. */
  progress: (a: ActivityInput, goals: AchievementGoals) => number
}

export interface AchievementGoals {
  dailyTasks: number
  weeklyTasks: number
  monthlyPoints: number
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

function dailyGoalRun(tasks: Task[], goal: number): number {
  const counts = new Map<string, number>()
  for (const d of completedTaskDates(tasks)) counts.set(d, (counts.get(d) ?? 0) + 1)
  const hit = new Set([...counts].filter(([, n]) => n >= Math.max(1, goal)).map(([d]) => d))
  return longestStreak(hit)
}

/** Best week: ≥3 workouts, weekly task goal met, and at least two rest days. Rewards balance, not volume. */
function bestBalancedWeek(a: ActivityInput, weeklyTasks: number): number {
  const weeks = new Map<string, { workouts: Set<string>; tasks: number }>()
  for (const s of completedSessions(a.sessions)) {
    const w = weeks.get(weekStart(s.date)) ?? { workouts: new Set(), tasks: 0 }
    w.workouts.add(s.date)
    weeks.set(weekStart(s.date), w)
  }
  for (const d of completedTaskDates(a.tasks)) {
    const w = weeks.get(weekStart(d)) ?? { workouts: new Set(), tasks: 0 }
    w.tasks++
    weeks.set(weekStart(d), w)
  }
  let best = 0
  for (const w of weeks.values()) {
    const workoutPart = Math.min(1, w.workouts.size / 3)
    const restOk = 7 - w.workouts.size >= 2 ? 1 : 0.5
    const taskPart = Math.min(1, w.tasks / Math.max(1, weeklyTasks))
    best = Math.max(best, ((workoutPart + taskPart) / 2) * restOk)
  }
  return best
}

function activeWeeksRun(sessions: WorkoutSession[]): number {
  const counts = new Map<string, number>()
  for (const s of completedSessions(sessions)) counts.set(weekStart(s.date), (counts.get(weekStart(s.date)) ?? 0) + 1)
  const weeks = [...counts].filter(([, n]) => n >= 2).map(([w]) => w).sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const w of weeks) {
    run = prev && diffDays(w, prev) === 7 ? run + 1 : 1
    best = Math.max(best, run)
    prev = w
  }
  return best
}

function bestMonthPoints(ledger: PointEntry[]): number {
  let best = 0
  for (const m of pointsByMonth(ledger).values()) best = Math.max(best, m.fitness + m.productivity)
  return best
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_workout',
    title: 'Primer entrenamiento',
    description: 'Completa tu primera sesión de entrenamiento.',
    category: 'fitness',
    progress: (a) => clamp01(completedSessions(a.sessions).length),
  },
  {
    id: 'first_10_tasks',
    title: 'Diez tareas hechas',
    description: 'Completa tus primeras 10 tareas.',
    category: 'productivity',
    progress: (a) => clamp01(completedTaskDates(a.tasks).length / 10),
  },
  {
    id: 'seven_days',
    title: 'Siete días seguidos',
    description: 'Completa algo (una tarea o un entreno) siete días consecutivos.',
    category: 'balance',
    progress: (a) => clamp01(longestStreak(productiveDays(a)) / 7),
  },
  {
    id: 'fitness_10',
    title: 'Diez sesiones',
    description: 'Completa 10 entrenamientos.',
    category: 'fitness',
    progress: (a) => clamp01(completedSessions(a.sessions).length / 10),
  },
  {
    id: 'four_active_weeks',
    title: 'Un mes en movimiento',
    description: 'Entrena al menos dos veces por semana durante cuatro semanas seguidas.',
    category: 'fitness',
    progress: (a) => clamp01(activeWeeksRun(a.sessions) / 4),
  },
  {
    id: 'productivity_streak',
    title: 'Racha productiva',
    description: 'Cumple tu objetivo diario de tareas cinco días seguidos.',
    category: 'productivity',
    progress: (a, g) => clamp01(dailyGoalRun(a.tasks, g.dailyTasks) / 5),
  },
  {
    id: 'monthly_goal',
    title: 'Objetivo mensual',
    description: 'Alcanza tu objetivo de puntos en un mes.',
    category: 'balance',
    progress: (a, g) => clamp01(bestMonthPoints(a.ledger) / Math.max(1, g.monthlyPoints)),
  },
  {
    id: 'balanced_week',
    title: 'Semana equilibrada',
    description: 'Tres entrenos, tu objetivo semanal de tareas y al menos dos días de descanso en la misma semana.',
    category: 'balance',
    progress: (a, g) => clamp01(bestBalancedWeek(a, g.weeklyTasks)),
  },
  {
    id: 'fifty_tasks',
    title: 'Cincuenta tareas',
    description: 'Completa 50 tareas en total.',
    category: 'productivity',
    progress: (a) => clamp01(completedTaskDates(a.tasks).length / 50),
  },
]

export function newlyUnlocked(a: ActivityInput, goals: AchievementGoals, unlocked: UnlockedAchievement[]): string[] {
  const have = new Set(unlocked.map((u) => u.id))
  return ACHIEVEMENTS.filter((d) => !have.has(d.id) && d.progress(a, goals) >= 1).map((d) => d.id)
}
