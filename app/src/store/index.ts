import { create } from 'zustand'
import type {
  Account,
  Category,
  Exercise,
  ID,
  ISODate,
  PlannedExercise,
  PointEntry,
  RecurringRule,
  SavingsGoal,
  ScheduledWorkout,
  SessionExercise,
  Settings,
  Task,
  TaskRecurrenceFreq,
  TaskSeries,
  Transaction,
  WorkoutSeries,
  WorkoutSession,
  WorkoutTemplate,
} from '../types'
import { emptyData, type AppData } from './defaults'
import { canAward, netForSource, taskPoints, workoutScore } from '../features/gamification/scoring'
import { newlyUnlocked } from '../features/gamification/stats'
import { SERIES_HORIZON_DAYS, pendingSeriesDates } from '../features/tasks/logic'
import { generateRecurring } from '../features/finance/calc'
import { EXERCISE_BY_ID } from '../features/fitness/library'
import { addDaysISO, dateOf, minutesBetween, today, weekday } from '../utils/dates'
import { uid } from '../utils/id'

export type { AppData }

const now = () => new Date().toISOString()

/* ------------------------------------------------------------------ */
/* Ledger helpers                                                      */
/* ------------------------------------------------------------------ */

export function awardEntry(
  sourceType: PointEntry['sourceType'],
  sourceId: ID,
  points: number,
  date: ISODate,
  reason: string,
  demo?: boolean,
): PointEntry {
  return {
    id: uid('pt'),
    category: sourceType === 'task' ? 'productivity' : 'fitness',
    sourceType,
    sourceId,
    points,
    kind: 'award',
    date,
    reason,
    createdAt: now(),
    ...(demo ? { demo } : {}),
  }
}

function reversalEntry(ledger: PointEntry[], sourceType: PointEntry['sourceType'], sourceId: ID, reason: string): PointEntry | null {
  const net = netForSource(ledger, sourceType, sourceId)
  if (net <= 0) return null
  // Reverse in the month the points were earned, so past months stay truthful.
  const last = [...ledger].reverse().find((e) => e.sourceType === sourceType && e.sourceId === sourceId && e.points > 0)
  return {
    id: uid('pt'),
    category: sourceType === 'task' ? 'productivity' : 'fitness',
    sourceType,
    sourceId,
    points: -net,
    kind: 'reversal',
    date: last?.date ?? today(),
    reason,
    createdAt: now(),
  }
}

/* ------------------------------------------------------------------ */
/* Generators                                                          */
/* ------------------------------------------------------------------ */

function instanceFromSeries(series: TaskSeries, date: ISODate): Task {
  const t = now()
  return {
    ...structuredClone(series.template),
    subtasks: series.template.subtasks.map((s) => ({ ...s, id: uid('st'), done: false })),
    id: uid('t'),
    date,
    status: 'pending',
    seriesId: series.id,
    createdAt: t,
    updatedAt: t,
    ...(series.demo ? { demo: true } : {}),
  }
}

function workoutSeriesDates(s: WorkoutSeries, upTo: ISODate): ISODate[] {
  const out: ISODate[] = []
  let d = s.generatedUntil < s.startDate ? s.startDate : addDaysISO(s.generatedUntil, 1)
  const last = s.until && s.until < upTo ? s.until : upTo
  for (; d <= last; d = addDaysISO(d, 1)) if (s.weekdays.includes(weekday(d))) out.push(d)
  return out
}

export function sessionFromPlan(name: string, intensity: WorkoutSession['intensity'], plan: PlannedExercise[], date: ISODate): WorkoutSession {
  return {
    id: uid('ws'),
    name,
    intensity,
    date,
    startedAt: now(),
    status: 'active',
    exercises: plan.map(
      (p): SessionExercise => ({
        exerciseId: p.exerciseId,
        restSec: p.restSec,
        targetReps: p.reps,
        sets: Array.from({ length: Math.max(1, p.sets) }, () => ({
          reps: parseInt(p.reps, 10) || undefined,
          weight: p.weight,
          done: false,
        })),
      }),
    ),
  }
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export type TaskInput = Omit<Task, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'completedAt' | 'seriesId'> & {
  status?: Task['status']
}

export interface Actions {
  /** Replace all data (import, reset, initial load). */
  hydrate: (data: AppData) => void
  /** Extends recurring tasks/workouts and books due recurring transactions. Idempotent. */
  maintain: () => void

  // tasks
  addTask: (input: TaskInput, recurrence?: { freq: TaskRecurrenceFreq; until?: ISODate }) => Task
  updateTask: (id: ID, patch: Partial<TaskInput>, scope?: 'one' | 'future') => void
  completeTask: (id: ID) => number
  reopenTask: (id: ID) => number
  setTaskStatus: (id: ID, status: 'pending' | 'in_progress' | 'missed') => void
  deleteTask: (id: ID, scope?: 'one' | 'future') => void
  duplicateTask: (id: ID) => Task | null
  moveTask: (id: ID, date: ISODate) => void
  toggleSubtask: (taskId: ID, subId: ID) => void

  // fitness
  saveTemplate: (tpl: Omit<WorkoutTemplate, 'id' | 'createdAt'> & { id?: ID }) => WorkoutTemplate
  deleteTemplate: (id: ID) => void
  scheduleWorkout: (input: { templateId: ID; date: ISODate; time?: string; weekdays?: number[]; until?: ISODate }) => void
  updateScheduled: (id: ID, patch: Partial<Pick<ScheduledWorkout, 'date' | 'time' | 'templateId'>>) => void
  deleteScheduled: (id: ID, scope?: 'one' | 'future') => void
  skipScheduled: (id: ID) => void
  stopWorkoutSeries: (id: ID) => void
  startSession: (opts: { scheduledId?: ID; templateId?: ID; adhoc?: { name: string; intensity: WorkoutSession['intensity']; plan: PlannedExercise[] } }) => ID
  updateSession: (id: ID, fn: (s: WorkoutSession) => WorkoutSession) => void
  finishSession: (id: ID, extra?: { notes?: string; effort?: number; durationMin?: number }) => number
  cancelSession: (id: ID) => void
  quickCompleteScheduled: (id: ID) => number
  reopenScheduled: (id: ID) => number
  deleteSession: (id: ID) => number
  saveExercise: (ex: Omit<Exercise, 'id' | 'custom' | 'minutes'> & { id?: ID }) => void
  deleteExercise: (id: ID) => void

  // finance
  saveTransaction: (tx: Omit<Transaction, 'id' | 'createdAt' | 'source'> & { id?: ID; source?: Transaction['source'] }) => void
  deleteTransaction: (id: ID) => void
  importTransactions: (txs: Omit<Transaction, 'id' | 'createdAt'>[]) => number
  saveAccount: (a: Omit<Account, 'id'> & { id?: ID }) => void
  deleteAccount: (id: ID) => boolean
  saveCategory: (c: Omit<Category, 'id'> & { id?: ID }) => void
  deleteCategory: (id: ID) => void
  setBudget: (b: Partial<AppData['budget']>) => void
  saveRecurring: (r: Omit<RecurringRule, 'id' | 'generatedThrough'> & { id?: ID }) => void
  deleteRecurring: (id: ID, removeGenerated: boolean) => void
  setRecurringActive: (id: ID, active: boolean) => void
  saveGoal: (g: Omit<SavingsGoal, 'id' | 'createdAt' | 'contributions'> & { id?: ID }) => void
  deleteGoal: (id: ID) => void
  addContribution: (goalId: ID, amount: number, date: ISODate) => void
  deleteContribution: (goalId: ID, contributionId: ID) => void

  // gamification
  syncAchievements: () => string[]
  recalculatePoints: () => number

  // settings & data
  updateSettings: (patch: Partial<Settings>) => void
  clearDemo: () => void
}

export type Store = AppData & Actions

export const useStore = create<Store>()((set, get) => {
  /** Shallow-merge helper. */
  const put = (patch: Partial<AppData>) => set(patch)

  const award = (sourceType: PointEntry['sourceType'], sourceId: ID, points: number, date: ISODate, reason: string, demo?: boolean) => {
    const { ledger } = get()
    if (points <= 0 || !canAward(ledger, sourceType, sourceId)) return 0
    put({ ledger: [...ledger, awardEntry(sourceType, sourceId, points, date, reason, demo)] })
    return points
  }

  const reverse = (sourceType: PointEntry['sourceType'], sourceId: ID, reason: string) => {
    const { ledger } = get()
    const r = reversalEntry(ledger, sourceType, sourceId, reason)
    if (!r) return 0
    put({ ledger: [...ledger, r] })
    return r.points
  }

  const extendTaskSeries = (series: TaskSeries[], tasks: Task[]) => {
    const upTo = addDaysISO(today(), SERIES_HORIZON_DAYS)
    const existing = new Set(tasks.filter((t) => t.seriesId).map((t) => `${t.seriesId}|${t.date}`))
    const created: Task[] = []
    const next = series.map((s) => {
      const dates = pendingSeriesDates(s, upTo)
      if (!dates.length && s.generatedUntil >= upTo) return s
      for (const d of dates) if (!existing.has(`${s.id}|${d}`)) created.push(instanceFromSeries(s, d))
      return { ...s, generatedUntil: upTo }
    })
    return { series: next, created }
  }

  const extendWorkoutSeries = (series: WorkoutSeries[], scheduled: ScheduledWorkout[]) => {
    const upTo = addDaysISO(today(), 56)
    const existing = new Set(scheduled.filter((s) => s.seriesId).map((s) => `${s.seriesId}|${s.date}`))
    const created: ScheduledWorkout[] = []
    const next = series.map((s) => {
      for (const d of workoutSeriesDates(s, upTo))
        if (!existing.has(`${s.id}|${d}`))
          created.push({ id: uid('sw'), templateId: s.templateId, date: d, time: s.time, status: 'planned', seriesId: s.id, ...(s.demo ? { demo: true } : {}) })
      return s.generatedUntil >= upTo ? s : { ...s, generatedUntil: upTo }
    })
    return { series: next, created }
  }

  return {
    ...emptyData(),

    hydrate: (data) => set({ ...data }),

    maintain: () => {
      const s = get()
      const ts = extendTaskSeries(s.taskSeries, s.tasks)
      const ws = extendWorkoutSeries(s.workoutSeries, s.scheduled)
      const rec = generateRecurring(s.recurring, s.transactions, today(), (rule, date) => ({
        id: uid('tx'),
        type: rule.type,
        amount: rule.amount,
        date,
        categoryId: rule.categoryId,
        accountId: rule.accountId,
        description: rule.description,
        recurringId: rule.id,
        source: 'recurring',
        createdAt: now(),
        ...(rule.demo ? { demo: true } : {}),
      }))
      const changed =
        ts.created.length ||
        ws.created.length ||
        rec.created.length ||
        ts.series.some((x, i) => x !== s.taskSeries[i]) ||
        ws.series.some((x, i) => x !== s.workoutSeries[i]) ||
        rec.rules.some((x, i) => x !== s.recurring[i])
      if (!changed) return
      put({
        taskSeries: ts.series,
        tasks: [...s.tasks, ...ts.created],
        workoutSeries: ws.series,
        scheduled: [...s.scheduled, ...ws.created],
        recurring: rec.rules,
        transactions: [...s.transactions, ...rec.created],
      })
    },

    /* ---------------- tasks ---------------- */

    addTask: (input, recurrence) => {
      const t = now()
      const task: Task = { ...input, status: input.status ?? 'pending', id: uid('t'), createdAt: t, updatedAt: t }
      if (recurrence && input.date) {
        const { id: _id, date: _d, status: _s, createdAt: _c, updatedAt: _u, deadline: _dl, ...template } = task
        const series: TaskSeries = {
          id: uid('ts'),
          template,
          freq: recurrence.freq,
          startDate: input.date,
          until: recurrence.until,
          generatedUntil: addDaysISO(input.date, -1),
        }
        const { series: [extended], created } = extendTaskSeries([series], [])
        put({ taskSeries: [...get().taskSeries, extended], tasks: [...get().tasks, ...created] })
        return created[0] ?? task
      }
      put({ tasks: [...get().tasks, task] })
      return task
    },

    updateTask: (id, patch, scope = 'one') => {
      const { tasks, taskSeries } = get()
      const target = tasks.find((t) => t.id === id)
      if (!target) return
      const t = now()
      if (scope === 'future' && target.seriesId) {
        const { date: _d, deadline: _dl, status: _s, ...templatePatch } = patch
        put({
          taskSeries: taskSeries.map((s) => (s.id === target.seriesId ? { ...s, template: { ...s.template, ...templatePatch } } : s)),
          tasks: tasks.map((x) =>
            x.id === id
              ? { ...x, ...patch, updatedAt: t }
              : x.seriesId === target.seriesId && x.date && target.date && x.date > target.date && x.status !== 'completed'
                ? { ...x, ...templatePatch, updatedAt: t }
                : x,
          ),
        })
        return
      }
      // Editing never touches the ledger: points stay as awarded at completion time.
      put({ tasks: tasks.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: t } : x)) })
    },

    completeTask: (id) => {
      const task = get().tasks.find((t) => t.id === id)
      if (!task || task.status === 'completed') return 0
      const t = now()
      put({
        tasks: get().tasks.map((x) =>
          x.id === id ? { ...x, status: 'completed', completedAt: t, updatedAt: t, subtasks: x.subtasks.map((s) => ({ ...s, done: true })) } : x,
        ),
      })
      return award('task', id, taskPoints(task, get().settings.scoring), dateOf(t), `Tarea completada: ${task.title}`, task.demo)
    },

    reopenTask: (id) => {
      const task = get().tasks.find((t) => t.id === id)
      if (!task || task.status !== 'completed') return 0
      put({ tasks: get().tasks.map((x) => (x.id === id ? { ...x, status: 'pending', completedAt: undefined, updatedAt: now() } : x)) })
      return reverse('task', id, `Tarea reabierta: ${task.title}`)
    },

    setTaskStatus: (id, status) => {
      const task = get().tasks.find((t) => t.id === id)
      if (!task) return
      if (task.status === 'completed') reverse('task', id, `Tarea reabierta: ${task.title}`)
      put({ tasks: get().tasks.map((x) => (x.id === id ? { ...x, status, completedAt: undefined, updatedAt: now() } : x)) })
    },

    deleteTask: (id, scope = 'one') => {
      const { tasks, taskSeries } = get()
      const target = tasks.find((t) => t.id === id)
      if (!target) return
      const removed =
        scope === 'future' && target.seriesId
          ? tasks.filter((x) => x.seriesId === target.seriesId && (x.id === id || (x.date && target.date && x.date >= target.date)))
          : [target]
      for (const r of removed) if (r.status === 'completed') reverse('task', r.id, `Tarea eliminada: ${r.title}`)
      const ids = new Set(removed.map((r) => r.id))
      put({
        tasks: get().tasks.filter((x) => !ids.has(x.id)),
        taskSeries:
          scope === 'future' && target.seriesId && target.date
            ? taskSeries.map((s) => (s.id === target.seriesId ? { ...s, until: addDaysISO(target.date!, -1) } : s))
            : taskSeries,
      })
    },

    duplicateTask: (id) => {
      const src = get().tasks.find((t) => t.id === id)
      if (!src) return null
      const t = now()
      const copy: Task = {
        ...structuredClone(src),
        id: uid('t'),
        title: `${src.title} (copia)`,
        status: 'pending',
        completedAt: undefined,
        seriesId: undefined,
        subtasks: src.subtasks.map((s) => ({ ...s, id: uid('st'), done: false })),
        createdAt: t,
        updatedAt: t,
      }
      put({ tasks: [...get().tasks, copy] })
      return copy
    },

    moveTask: (id, date) => put({ tasks: get().tasks.map((x) => (x.id === id ? { ...x, date, updatedAt: now() } : x)) }),

    toggleSubtask: (taskId, subId) =>
      put({
        tasks: get().tasks.map((x) =>
          x.id === taskId ? { ...x, subtasks: x.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)), updatedAt: now() } : x,
        ),
      }),

    /* ---------------- fitness ---------------- */

    saveTemplate: (tpl) => {
      const existing = tpl.id ? get().templates.find((x) => x.id === tpl.id) : undefined
      const saved: WorkoutTemplate = existing ? { ...existing, ...tpl, id: existing.id } : { ...tpl, id: uid('wt'), createdAt: now() }
      put({ templates: existing ? get().templates.map((x) => (x.id === saved.id ? saved : x)) : [...get().templates, saved] })
      return saved
    },

    deleteTemplate: (id) => {
      const t = today()
      put({
        templates: get().templates.filter((x) => x.id !== id),
        // Future plans of this routine go away; history (completed sessions) stays.
        scheduled: get().scheduled.filter((s) => !(s.templateId === id && s.status === 'planned' && s.date >= t)),
        workoutSeries: get().workoutSeries.filter((s) => s.templateId !== id),
      })
    },

    scheduleWorkout: ({ templateId, date, time, weekdays, until }) => {
      if (weekdays && weekdays.length) {
        const series: WorkoutSeries = { id: uid('wsr'), templateId, weekdays, time, startDate: date, until, generatedUntil: addDaysISO(date, -1) }
        const { series: [ext], created } = extendWorkoutSeries([series], [])
        put({ workoutSeries: [...get().workoutSeries, ext], scheduled: [...get().scheduled, ...created] })
        return
      }
      put({ scheduled: [...get().scheduled, { id: uid('sw'), templateId, date, time, status: 'planned' }] })
    },

    updateScheduled: (id, patch) => put({ scheduled: get().scheduled.map((s) => (s.id === id ? { ...s, ...patch } : s)) }),

    deleteScheduled: (id, scope = 'one') => {
      const target = get().scheduled.find((s) => s.id === id)
      if (!target) return
      if (scope === 'future' && target.seriesId) {
        put({
          scheduled: get().scheduled.filter((s) => !(s.seriesId === target.seriesId && s.date >= target.date && s.status === 'planned')),
          workoutSeries: get().workoutSeries.map((s) => (s.id === target.seriesId ? { ...s, until: addDaysISO(target.date, -1) } : s)),
        })
        return
      }
      put({ scheduled: get().scheduled.filter((s) => s.id !== id) })
    },

    skipScheduled: (id) => put({ scheduled: get().scheduled.map((s) => (s.id === id ? { ...s, status: s.status === 'skipped' ? 'planned' : 'skipped' } : s)) }),

    stopWorkoutSeries: (id) => {
      const t = today()
      put({
        workoutSeries: get().workoutSeries.filter((s) => s.id !== id),
        // Future planned sessions of the plan disappear; past ones (done, skipped) stay as history.
        scheduled: get().scheduled.filter((s) => !(s.seriesId === id && s.status === 'planned' && s.date >= t)),
      })
    },

    startSession: ({ scheduledId, templateId, adhoc }) => {
      const { sessions, scheduled, templates } = get()
      // Resume instead of duplicating an active session.
      const active = sessions.find((s) => s.status === 'active' && (scheduledId ? s.scheduledId === scheduledId : !s.scheduledId))
      if (active && (scheduledId || !adhoc)) return active.id
      const sch = scheduledId ? scheduled.find((s) => s.id === scheduledId) : undefined
      const tpl = templates.find((t) => t.id === (sch?.templateId ?? templateId))
      const session = tpl
        ? sessionFromPlan(tpl.name, tpl.intensity, tpl.exercises, sch && sch.date <= today() ? sch.date : today())
        : sessionFromPlan(adhoc?.name ?? 'Entreno libre', adhoc?.intensity ?? 'standard', adhoc?.plan ?? [], today())
      session.templateId = tpl?.id
      session.scheduledId = sch?.id
      put({ sessions: [...get().sessions, session] })
      return session.id
    },

    updateSession: (id, fn) => put({ sessions: get().sessions.map((s) => (s.id === id && s.status === 'active' ? fn(s) : s)) }),

    finishSession: (id, extra = {}) => {
      const s = get().sessions.find((x) => x.id === id)
      if (!s || s.status !== 'active') return 0
      const endedAt = now()
      const durationMin = extra.durationMin ?? Math.max(1, minutesBetween(s.startedAt, endedAt))
      const done: WorkoutSession = { ...s, ...extra, endedAt, durationMin, status: 'completed' }
      put({
        sessions: get().sessions.map((x) => (x.id === id ? done : x)),
        scheduled: get().scheduled.map((x) => (x.id === s.scheduledId ? { ...x, status: 'completed', sessionId: id } : x)),
      })
      const { points } = workoutScore(done, get().settings.scoring)
      return award('workout', id, points, done.date, `Entreno completado: ${done.name}`, done.demo)
    },

    cancelSession: (id) => put({ sessions: get().sessions.map((s) => (s.id === id && s.status === 'active' ? { ...s, status: 'cancelled', endedAt: now() } : s)) }),

    quickCompleteScheduled: (id) => {
      const sch = get().scheduled.find((s) => s.id === id)
      if (!sch || sch.status === 'completed') return 0
      const tpl = get().templates.find((t) => t.id === sch.templateId)
      if (!tpl) return 0
      const existing = get().sessions.find((s) => s.status === 'active' && s.scheduledId === id)
      const session = existing ?? { ...sessionFromPlan(tpl.name, tpl.intensity, tpl.exercises, sch.date <= today() ? sch.date : today()), templateId: tpl.id, scheduledId: id }
      session.exercises = session.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, done: true })) }))
      if (!existing) put({ sessions: [...get().sessions, session] })
      else get().updateSession(existing.id, () => session)
      return get().finishSession(session.id, { durationMin: tpl.estimatedMin })
    },

    reopenScheduled: (id) => {
      const sch = get().scheduled.find((s) => s.id === id)
      if (!sch || sch.status !== 'completed') return 0
      const r = sch.sessionId ? reverse('workout', sch.sessionId, 'Entreno marcado como no hecho') : 0
      put({
        scheduled: get().scheduled.map((s) => (s.id === id ? { ...s, status: 'planned', sessionId: undefined } : s)),
        sessions: get().sessions.map((s) => (s.id === sch.sessionId ? { ...s, status: 'cancelled' } : s)),
      })
      return r
    },

    deleteSession: (id) => {
      const s = get().sessions.find((x) => x.id === id)
      if (!s) return 0
      const r = reverse('workout', id, `Entreno eliminado: ${s.name}`)
      put({
        sessions: get().sessions.filter((x) => x.id !== id),
        scheduled: get().scheduled.map((x) => (x.sessionId === id ? { ...x, status: 'planned', sessionId: undefined } : x)),
      })
      return r
    },

    saveExercise: (ex) => {
      const work = ex.kind === 'time' ? parseInt(ex.reps, 10) || 30 : 40
      const full: Exercise = { ...ex, id: ex.id ?? uid('ex'), custom: true, minutes: Math.max(2, Math.round((ex.sets * (work + ex.restSec)) / 60)) }
      const list = get().customExercises
      put({ customExercises: list.some((x) => x.id === full.id) ? list.map((x) => (x.id === full.id ? full : x)) : [...list, full] })
    },

    deleteExercise: (id) => put({ customExercises: get().customExercises.filter((x) => x.id !== id) }),

    /* ---------------- finance ---------------- */

    saveTransaction: (tx) => {
      const list = get().transactions
      if (tx.id && list.some((x) => x.id === tx.id)) {
        put({ transactions: list.map((x) => (x.id === tx.id ? { ...x, ...tx, id: x.id, source: x.source } : x)) })
        return
      }
      put({ transactions: [...list, { ...tx, id: uid('tx'), createdAt: now(), source: tx.source ?? 'manual' }] })
    },

    deleteTransaction: (id) => put({ transactions: get().transactions.filter((x) => x.id !== id) }),

    importTransactions: (txs) => {
      const created = txs.map((t) => ({ ...t, id: uid('tx'), createdAt: now() }))
      put({ transactions: [...get().transactions, ...created] })
      return created.length
    },

    saveAccount: (a) => {
      const list = get().accounts
      if (a.id && list.some((x) => x.id === a.id)) put({ accounts: list.map((x) => (x.id === a.id ? { ...x, ...a, id: x.id } : x)) })
      else put({ accounts: [...list, { ...a, id: uid('acc') }] })
    },

    deleteAccount: (id) => {
      const { accounts, transactions, recurring } = get()
      if (accounts.length <= 1 || transactions.some((t) => t.accountId === id) || recurring.some((r) => r.accountId === id)) return false
      put({ accounts: accounts.filter((a) => a.id !== id) })
      return true
    },

    saveCategory: (c) => {
      const list = get().categories
      if (c.id && list.some((x) => x.id === c.id)) put({ categories: list.map((x) => (x.id === c.id ? { ...x, ...c, id: x.id } : x)) })
      else put({ categories: [...list, { ...c, id: uid('cat'), custom: true }] })
    },

    deleteCategory: (id) => {
      const cat = get().categories.find((c) => c.id === id)
      if (!cat) return
      const fallback = cat.type === 'income' ? 'other_income' : 'other_expense'
      const { [id]: _removed, ...byCategory } = get().budget.byCategory
      put({
        categories: get().categories.filter((c) => c.id !== id),
        transactions: get().transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: fallback } : t)),
        recurring: get().recurring.map((r) => (r.categoryId === id ? { ...r, categoryId: fallback } : r)),
        budget: { ...get().budget, byCategory },
      })
    },

    setBudget: (b) => put({ budget: { ...get().budget, ...b, demo: false } }),

    saveRecurring: (r) => {
      const list = get().recurring
      const existing = r.id ? list.find((x) => x.id === r.id) : undefined
      if (existing) {
        // Changing the schedule restarts generation from today; past occurrences are left as they are.
        const scheduleChanged = existing.startDate !== r.startDate || existing.freq !== r.freq
        put({
          recurring: list.map((x) =>
            x.id === existing.id ? { ...x, ...r, id: x.id, generatedThrough: scheduleChanged ? addDaysISO(r.startDate > today() ? r.startDate : today(), -1) : x.generatedThrough } : x,
          ),
        })
      } else put({ recurring: [...list, { ...r, id: uid('rr') }] })
      get().maintain()
    },

    setRecurringActive: (id, active) => {
      put({
        recurring: get().recurring.map((r) => {
          if (r.id !== id) return r
          // Resuming never back-fills the paused period.
          const floor = addDaysISO(today(), -1)
          return { ...r, active, generatedThrough: active && (!r.generatedThrough || r.generatedThrough < floor) ? floor : r.generatedThrough }
        }),
      })
      get().maintain()
    },

    deleteRecurring: (id, removeGenerated) =>
      put({
        recurring: get().recurring.filter((r) => r.id !== id),
        transactions: removeGenerated
          ? get().transactions.filter((t) => t.recurringId !== id)
          : get().transactions.map((t) => (t.recurringId === id ? { ...t, recurringId: undefined } : t)),
      }),

    saveGoal: (g) => {
      const list = get().goals
      if (g.id && list.some((x) => x.id === g.id)) put({ goals: list.map((x) => (x.id === g.id ? { ...x, ...g, id: x.id } : x)) })
      else put({ goals: [...list, { ...g, id: uid('goal'), createdAt: now(), contributions: [] }] })
    },

    deleteGoal: (id) => put({ goals: get().goals.filter((g) => g.id !== id) }),

    addContribution: (goalId, amount, date) =>
      put({ goals: get().goals.map((g) => (g.id === goalId ? { ...g, contributions: [...g.contributions, { id: uid('gc'), amount, date }] } : g)) }),

    deleteContribution: (goalId, cid) =>
      put({ goals: get().goals.map((g) => (g.id === goalId ? { ...g, contributions: g.contributions.filter((c) => c.id !== cid) } : g)) }),

    /* ---------------- gamification ---------------- */

    syncAchievements: () => {
      const { tasks, sessions, ledger, achievements, settings } = get()
      const ids = newlyUnlocked({ tasks, sessions, ledger }, settings.goals, achievements)
      if (ids.length) put({ achievements: [...achievements, ...ids.map((id) => ({ id, unlockedAt: now() }))] })
      return ids
    },

    /** Explicit, user-triggered: re-scores every activity that holds points under the current rules. */
    recalculatePoints: () => {
      const { ledger, tasks, sessions, settings } = get()
      const additions: PointEntry[] = []
      const sources = new Map<string, PointEntry>()
      for (const e of ledger) sources.set(`${e.sourceType}|${e.sourceId}`, e)
      for (const [key, last] of sources) {
        const [type, id] = key.split('|') as [PointEntry['sourceType'], string]
        const net = netForSource(ledger, type, id)
        if (net <= 0) continue
        let target: number | null = null
        if (type === 'task') {
          const t = tasks.find((x) => x.id === id)
          if (t?.status === 'completed') target = taskPoints(t, settings.scoring)
        } else {
          const s = sessions.find((x) => x.id === id)
          if (s?.status === 'completed') target = workoutScore(s, settings.scoring).points
        }
        if (target === null || target === net) continue
        additions.push({ ...last, id: uid('pt'), points: target - net, kind: 'recalculation', reason: 'Recalculado con las reglas actuales', createdAt: now() })
      }
      if (additions.length) put({ ledger: [...ledger, ...additions] })
      return additions.length
    },

    /* ---------------- settings & data ---------------- */

    updateSettings: (patch) => put({ settings: { ...get().settings, ...patch } }),

    clearDemo: () => {
      const s = get()
      const keep = <T extends { demo?: boolean }>(xs: T[]) => xs.filter((x) => !x.demo)
      const demoTx = new Set(s.transactions.filter((t) => t.demo).map((t) => t.id))
      put({
        tasks: keep(s.tasks),
        taskSeries: keep(s.taskSeries),
        templates: keep(s.templates),
        scheduled: keep(s.scheduled),
        workoutSeries: keep(s.workoutSeries),
        sessions: keep(s.sessions),
        accounts: s.accounts.filter((a) => !a.demo),
        transactions: s.transactions.filter((t) => !demoTx.has(t.id)),
        recurring: keep(s.recurring),
        goals: keep(s.goals),
        ledger: keep(s.ledger),
        // Achievements earned purely from demo activity are re-evaluated below.
        achievements: [],
        budget: s.budget.demo ? { monthlyTotal: null, byCategory: {} } : s.budget,
      })
      get().syncAchievements()
    },
  }
})

/** Snapshot of persisted data (no functions). */
export function selectData(s: Store): AppData {
  return {
    version: s.version,
    tasks: s.tasks,
    taskSeries: s.taskSeries,
    templates: s.templates,
    scheduled: s.scheduled,
    workoutSeries: s.workoutSeries,
    sessions: s.sessions,
    customExercises: s.customExercises,
    accounts: s.accounts,
    transactions: s.transactions,
    categories: s.categories,
    recurring: s.recurring,
    budget: s.budget,
    goals: s.goals,
    ledger: s.ledger,
    achievements: s.achievements,
    settings: s.settings,
  }
}

export function exerciseLookup(custom: Exercise[]): Map<string, Exercise> {
  if (!custom.length) return EXERCISE_BY_ID
  const m = new Map(EXERCISE_BY_ID)
  for (const e of custom) m.set(e.id, e)
  return m
}
