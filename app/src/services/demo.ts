import type { Account, PointEntry, RecurringRule, SavingsGoal, ScheduledWorkout, Task, Transaction, WorkoutSeries, WorkoutSession, WorkoutTemplate } from '../types'
import { useStore, awardEntry, sessionFromPlan } from '../store'
import { taskPoints, workoutScore } from '../features/gamification/scoring'
import { occurrences } from '../features/finance/calc'
import { addDaysISO, addMonthsISO, monthStart, today, weekStart, weekday, fromISO } from '../utils/dates'
import { uid } from '../utils/id'

/**
 * Optional demo mode. Every generated record carries `demo: true` so
 * "Borrar datos de ejemplo" removes exactly these and nothing the user created.
 * Points for demo activity go through the same scoring functions as real activity.
 */

// Deterministic pseudo-random so the demo looks the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

const iso = (d: string, h: number) => {
  const x = fromISO(d)
  x.setHours(h, Math.floor(h * 7) % 60)
  return x.toISOString()
}

export function loadDemo() {
  const s = useStore.getState()
  const rand = rng(42)
  const t0 = today()
  const cfg = s.settings.scoring
  const ledger: PointEntry[] = []

  /* ---------- workout routines ---------- */
  const templates: WorkoutTemplate[] = [
    {
      id: uid('wt'), name: 'Pierna y glúteo', focus: ['legs', 'glutes'], objective: 'strength', intensity: 'challenging', estimatedMin: 50, createdAt: iso(t0, 9), demo: true,
      exercises: [
        { exerciseId: 'goblet_squat', sets: 4, reps: '10', restSec: 90, weight: 20 },
        { exerciseId: 'rdl', sets: 3, reps: '10', restSec: 90, weight: 30 },
        { exerciseId: 'bulgarian_split', sets: 3, reps: '8', restSec: 75, weight: 10 },
        { exerciseId: 'hip_thrust', sets: 3, reps: '12', restSec: 75, weight: 40 },
        { exerciseId: 'calf_raise', sets: 3, reps: '15', restSec: 45 },
      ],
    },
    {
      id: uid('wt'), name: 'Torso: empuje y tirón', focus: ['chest', 'back', 'shoulders'], objective: 'hypertrophy', intensity: 'standard', estimatedMin: 45, createdAt: iso(t0, 9), demo: true,
      exercises: [
        { exerciseId: 'db_press', sets: 3, reps: '10', restSec: 90, weight: 16 },
        { exerciseId: 'db_row', sets: 3, reps: '10', restSec: 75, weight: 18 },
        { exerciseId: 'db_shoulder_press', sets: 3, reps: '10', restSec: 75, weight: 12 },
        { exerciseId: 'lateral_raise', sets: 3, reps: '12', restSec: 45, weight: 6 },
        { exerciseId: 'plank', sets: 3, reps: '40', restSec: 30 },
      ],
    },
    {
      id: uid('wt'), name: 'Movilidad y cardio suave', focus: ['mobility', 'cardio'], objective: 'recovery', intensity: 'light', estimatedMin: 30, createdAt: iso(t0, 9), demo: true,
      exercises: [
        { exerciseId: 'worlds_greatest', sets: 2, reps: '5 por lado', restSec: 20 },
        { exerciseId: 'cat_cow', sets: 2, reps: '10', restSec: 15 },
        { exerciseId: 'bike', sets: 1, reps: '900', restSec: 0 },
        { exerciseId: 'hamstring_stretch', sets: 2, reps: '45', restSec: 15 },
      ],
    },
  ]
  const [legs, upper, mobility] = templates

  const seriesStart = addDaysISO(weekStart(t0), -35)
  const workoutSeries: WorkoutSeries[] = [
    { id: uid('wsr'), templateId: legs.id, weekdays: [1, 4], time: '19:00', startDate: seriesStart, generatedUntil: addDaysISO(seriesStart, -1), demo: true },
    { id: uid('wsr'), templateId: upper.id, weekdays: [2, 5], time: '19:00', startDate: seriesStart, generatedUntil: addDaysISO(seriesStart, -1), demo: true },
    { id: uid('wsr'), templateId: mobility.id, weekdays: [6], time: '10:30', startDate: seriesStart, generatedUntil: addDaysISO(seriesStart, -1), demo: true },
  ]

  // Past planned workouts: most completed, a few skipped — realistic, not perfect.
  const scheduled: ScheduledWorkout[] = []
  const sessions: WorkoutSession[] = []
  for (const sr of workoutSeries) {
    const tpl = templates.find((t) => t.id === sr.templateId)!
    for (let d = seriesStart; d < t0; d = addDaysISO(d, 1)) {
      if (!sr.weekdays.includes(weekday(d))) continue
      const sch: ScheduledWorkout = { id: uid('sw'), templateId: tpl.id, date: d, time: sr.time, status: 'planned', seriesId: sr.id, demo: true }
      if (rand() < 0.8) {
        const progress = Math.floor((-addDaysDiff(d, t0)) / 7) // older = lighter
        const plan = tpl.exercises.map((p) => ({ ...p, weight: p.weight ? Math.max(2, p.weight - progress * 2) : undefined }))
        const session = sessionFromPlan(tpl.name, tpl.intensity, plan, d)
        session.exercises = session.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, done: rand() > 0.06 })) }))
        Object.assign(session, {
          templateId: tpl.id, scheduledId: sch.id, status: 'completed', demo: true,
          startedAt: iso(d, 19), endedAt: iso(d, 20), durationMin: tpl.estimatedMin + Math.round(rand() * 10 - 5), effort: 6 + Math.round(rand() * 3),
        })
        sessions.push(session)
        sch.status = 'completed'
        sch.sessionId = session.id
        const pts = workoutScore(session, cfg).points
        if (pts > 0) ledger.push({ ...awardEntry('workout', session.id, pts, d, `Entreno completado: ${tpl.name}`, true) })
      } else if (rand() < 0.5) sch.status = 'skipped'
      scheduled.push(sch)
    }
    sr.generatedUntil = addDaysISO(t0, -1)
  }

  /* ---------- tasks ---------- */
  const titles: [string, string, Task['difficulty'], Task['priority'], number][] = [
    ['Preparar presentación del proyecto', 'Trabajo', 'hard', 'high', 120],
    ['Responder correos pendientes', 'Trabajo', 'easy', 'medium', 30],
    ['Repasar tema 4', 'Estudios', 'medium', 'high', 60],
    ['Entregar práctica de estadística', 'Estudios', 'very_hard', 'urgent', 180],
    ['Comprar fruta y verdura', 'Recados', 'easy', 'low', 30],
    ['Llamar al dentista', 'Salud', 'easy', 'medium', 10],
    ['Ordenar escritorio', 'Hogar', 'easy', 'low', 20],
    ['Revisar contrato del alquiler', 'Personal', 'medium', 'medium', 45],
    ['Leer 30 páginas', 'Personal', 'easy', 'low', 40],
    ['Planificar menú semanal', 'Hogar', 'medium', 'medium', 30],
    ['Actualizar CV', 'Trabajo', 'medium', 'high', 60],
    ['Poner lavadora', 'Hogar', 'easy', 'low', 10],
  ]
  const tasks: Task[] = []
  for (let i = -20; i <= 7; i++) {
    const d = addDaysISO(t0, i)
    const n = weekday(d) >= 6 ? 1 : 2 + Math.floor(rand() * 2)
    for (let k = 0; k < n; k++) {
      const [title, category, difficulty, priority, est] = titles[Math.floor(rand() * titles.length)]
      const createdAt = iso(addDaysISO(d, -2), 9)
      const task: Task = {
        id: uid('t'), title, category, difficulty, priority, estimatedMin: est, date: d, status: 'pending',
        subtasks: [], createdAt, updatedAt: createdAt, demo: true,
      }
      if (i < 0) {
        const r = rand()
        if (r < 0.78) {
          task.status = 'completed'
          task.completedAt = iso(d, 12 + Math.floor(rand() * 8))
          ledger.push(awardEntry('task', task.id, taskPoints(task, cfg), d, `Tarea completada: ${title}`, true))
        } else if (r < 0.88) task.status = 'missed'
      }
      if (i === 0 && k === 0) {
        task.startTime = '10:00'
        task.endTime = '11:30'
        task.subtasks = [
          { id: uid('st'), title: 'Esquema de diapositivas', done: true },
          { id: uid('st'), title: 'Gráficos de resultados', done: false },
          { id: uid('st'), title: 'Ensayo en voz alta', done: false },
        ]
      }
      if (i === 3 && k === 0) task.deadline = addDaysISO(t0, 5)
      tasks.push(task)
    }
  }

  /* ---------- finance ---------- */
  const accounts: Account[] = [
    { id: uid('acc'), name: 'Cuenta nómina', kind: 'bank', initialBalance: 245000, demo: true },
    { id: uid('acc'), name: 'Tarjeta', kind: 'card', initialBalance: 0, demo: true },
    { id: uid('acc'), name: 'Cuenta ahorro', kind: 'savings', initialBalance: 300000, demo: true },
  ]
  const [bank, card] = accounts
  const start = addMonthsISO(monthStart(t0), -5)
  const recurring: RecurringRule[] = [
    { id: uid('rr'), type: 'income', amount: 185000, categoryId: 'salary', accountId: bank.id, description: 'Nómina', freq: 'monthly', startDate: addDaysISO(start, 0), active: true, demo: true },
    { id: uid('rr'), type: 'expense', amount: 68000, categoryId: 'housing', accountId: bank.id, description: 'Alquiler', freq: 'monthly', startDate: addDaysISO(start, 2), active: true, demo: true },
    { id: uid('rr'), type: 'expense', amount: 3990, categoryId: 'health', accountId: card.id, description: 'Gimnasio', freq: 'monthly', startDate: addDaysISO(start, 4), active: true, demo: true },
    { id: uid('rr'), type: 'expense', amount: 1299, categoryId: 'subscriptions', accountId: card.id, description: 'Streaming', freq: 'monthly', startDate: addDaysISO(start, 14), active: true, demo: true },
    { id: uid('rr'), type: 'expense', amount: 4500, categoryId: 'transport', accountId: card.id, description: 'Abono transporte', freq: 'monthly', startDate: addDaysISO(start, 0), active: true, demo: true },
  ]
  const transactions: Transaction[] = []
  for (const r of recurring) {
    for (const d of occurrences(r, r.startDate, t0))
      transactions.push({ id: uid('tx'), type: r.type, amount: r.amount, date: d, categoryId: r.categoryId, accountId: r.accountId, description: r.description, recurringId: r.id, source: 'recurring', createdAt: iso(d, 8), demo: true })
    r.generatedThrough = t0
  }
  const spends: [string, string, number, number][] = [
    ['Supermercado', 'food', 2500, 7500],
    ['Café y desayuno', 'food', 250, 900],
    ['Cena con amigos', 'entertainment', 1800, 4500],
    ['Cine', 'entertainment', 900, 1600],
    ['Ropa', 'shopping', 2000, 7000],
    ['Farmacia', 'health', 600, 2500],
    ['Libro', 'education', 1200, 2800],
    ['Gasolina', 'transport', 3000, 6000],
    ['Regalo', 'personal', 1500, 4000],
  ]
  for (let d = start; d <= t0; d = addDaysISO(d, 1)) {
    const count = rand() < 0.55 ? 1 : rand() < 0.3 ? 2 : 0
    for (let k = 0; k < count; k++) {
      const [desc, cat, min, max] = spends[Math.floor(rand() * spends.length)]
      transactions.push({ id: uid('tx'), type: 'expense', amount: Math.round((min + rand() * (max - min)) / 10) * 10, date: d, categoryId: cat, accountId: rand() < 0.7 ? card.id : bank.id, description: desc, source: 'manual', createdAt: iso(d, 18), demo: true })
    }
  }
  for (let m = 0; m < 6; m += 2) {
    const d = addDaysISO(addMonthsISO(start, m), 18)
    if (d <= t0) transactions.push({ id: uid('tx'), type: 'income', amount: 42000, date: d, categoryId: 'freelance', accountId: bank.id, description: 'Proyecto diseño web', source: 'manual', createdAt: iso(d, 10), demo: true })
  }

  const goals: SavingsGoal[] = [
    {
      id: uid('goal'), name: 'Fondo de emergencia', target: 600000, targetDate: addMonthsISO(t0, 8), createdAt: iso(start, 9), demo: true,
      contributions: [0, 1, 2, 3, 4, 5].map((m) => ({ id: uid('gc'), date: addDaysISO(addMonthsISO(start, m), 1), amount: 40000 })).filter((c) => c.date <= t0),
    },
    {
      id: uid('goal'), name: 'Viaje a Japón', target: 250000, targetDate: addMonthsISO(t0, 11), createdAt: iso(start, 9), demo: true,
      contributions: [1, 3, 5].map((m) => ({ id: uid('gc'), date: addDaysISO(addMonthsISO(start, m), 3), amount: 15000 })).filter((c) => c.date <= t0),
    },
  ]

  const st = useStore.getState()
  useStore.setState({
    templates: [...st.templates, ...templates],
    workoutSeries: [...st.workoutSeries, ...workoutSeries],
    scheduled: [...st.scheduled, ...scheduled],
    sessions: [...st.sessions, ...sessions],
    tasks: [...st.tasks, ...tasks],
    accounts: [...st.accounts, ...accounts],
    recurring: [...st.recurring, ...recurring],
    transactions: [...st.transactions, ...transactions],
    goals: [...st.goals, ...goals],
    ledger: [...st.ledger, ...ledger],
    budget:
      st.budget.monthlyTotal == null && Object.keys(st.budget.byCategory).length === 0
        ? { monthlyTotal: 140000, byCategory: { food: 32000, entertainment: 15000, shopping: 12000, transport: 10000 }, demo: true }
        : st.budget,
    settings: { ...st.settings, onboarded: true },
  })
  useStore.getState().maintain()
  useStore.getState().syncAchievements()
}

function addDaysDiff(a: string, b: string) {
  return (fromISO(a).getTime() - fromISO(b).getTime()) / 86400000
}

export function hasDemo(): boolean {
  const s = useStore.getState()
  return s.tasks.some((t) => t.demo) || s.transactions.some((t) => t.demo) || s.templates.some((t) => t.demo)
}
