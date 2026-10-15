import type { Difficulty, ISODate, Priority, Task, TaskRecurrenceFreq, TaskSeries, TaskStatus } from '../../types'
import { addDaysISO, addMonthsISO, fromISO, today, weekday } from '../../utils/dates'
import { getDaysInMonth } from 'date-fns'

export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' }
export const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  completed: 'Completada',
  missed: 'No realizada',
}
export const FREQ_LABEL: Record<TaskRecurrenceFreq, string> = {
  daily: 'Cada día',
  weekdays: 'De lunes a viernes',
  weekly: 'Cada semana',
  monthly: 'Cada mes',
}
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'very_hard']
export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']
export const DEFAULT_TASK_CATEGORIES = ['Trabajo', 'Estudios', 'Personal', 'Hogar', 'Salud', 'Recados', 'Otros']

/** How far ahead recurring task instances are materialised. */
export const SERIES_HORIZON_DAYS = 60

export function isOpen(t: Task): boolean {
  return t.status === 'pending' || t.status === 'in_progress'
}

/** Overdue = still open and its scheduled date or deadline is in the past. Never auto-completed or auto-missed. */
export function isOverdue(t: Task, ref: ISODate = today()): boolean {
  if (!isOpen(t)) return false
  return (!!t.date && t.date < ref) || (!!t.deadline && t.deadline < ref)
}

export function sortTasks(a: Task, b: Task): number {
  const doneA = a.status === 'completed' || a.status === 'missed' ? 1 : 0
  const doneB = b.status === 'completed' || b.status === 'missed' ? 1 : 0
  if (doneA !== doneB) return doneA - doneB
  if ((a.startTime ?? '') !== (b.startTime ?? '')) {
    if (!a.startTime) return 1
    if (!b.startTime) return -1
    return a.startTime.localeCompare(b.startTime)
  }
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt.localeCompare(b.createdAt)
}

export function seriesMatches(freq: TaskRecurrenceFreq, start: ISODate, d: ISODate): boolean {
  switch (freq) {
    case 'daily':
      return true
    case 'weekdays':
      return weekday(d) <= 5
    case 'weekly':
      return weekday(d) === weekday(start)
    case 'monthly': {
      const target = fromISO(start).getDate()
      const day = fromISO(d)
      return day.getDate() === Math.min(target, getDaysInMonth(day))
    }
  }
}

/** Dates in (series.generatedUntil, upTo] that need an instance. */
export function pendingSeriesDates(series: Pick<TaskSeries, 'freq' | 'startDate' | 'until' | 'generatedUntil'>, upTo: ISODate): ISODate[] {
  const out: ISODate[] = []
  let d = series.generatedUntil < series.startDate ? series.startDate : addDaysISO(series.generatedUntil, 1)
  const last = series.until && series.until < upTo ? series.until : upTo
  if (series.freq === 'monthly') {
    // jump month by month for efficiency
    while (d <= last) {
      if (seriesMatches('monthly', series.startDate, d)) {
        out.push(d)
        d = addMonthsISO(d.slice(0, 8) + '01', 1)
      } else d = addDaysISO(d, 1)
    }
    return out
  }
  for (; d <= last; d = addDaysISO(d, 1)) if (seriesMatches(series.freq, series.startDate, d)) out.push(d)
  return out
}

/** Today's productivity score 0–100: completed share of today's tasks, weighted by difficulty. */
export function productivityScore(tasks: Task[], weights: Record<Difficulty, number>): number {
  let total = 0
  let done = 0
  for (const t of tasks) {
    if (t.status === 'missed') continue
    const w = weights[t.difficulty] || 1
    total += w
    if (t.status === 'completed') done += w
  }
  return total === 0 ? 0 : Math.round((done / total) * 100)
}
