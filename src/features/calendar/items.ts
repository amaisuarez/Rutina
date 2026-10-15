import { useMemo } from 'react'
import type { ISODate, Priority, ScheduledWorkout, Task, WorkoutTemplate } from '../../types'
import { useStore } from '../../store'
import { inRange } from '../../utils/dates'
import { isOverdue } from '../tasks/logic'

/**
 * Calendar items are *views* over tasks and scheduled workouts — never copies.
 * Editing or completing an item edits the underlying record.
 */
export type CalItem =
  | { key: string; kind: 'task'; date: ISODate; time?: string; endTime?: string; title: string; done: boolean; recurring: boolean; priority: Priority; overdue: boolean; task: Task }
  | { key: string; kind: 'deadline'; date: ISODate; title: string; done: boolean; recurring: false; task: Task }
  | {
      key: string
      kind: 'workout'
      date: ISODate
      time?: string
      title: string
      done: boolean
      skipped: boolean
      recurring: boolean
      minutes: number
      workout: ScheduledWorkout
      template?: WorkoutTemplate
    }

export function buildItems(tasks: Task[], scheduled: ScheduledWorkout[], templates: WorkoutTemplate[], start: ISODate, end: ISODate): CalItem[] {
  const tpl = new Map(templates.map((t) => [t.id, t]))
  const out: CalItem[] = []
  for (const t of tasks) {
    if (t.date && inRange(t.date, start, end))
      out.push({
        key: `t-${t.id}`,
        kind: 'task',
        date: t.date,
        time: t.startTime,
        endTime: t.endTime,
        title: t.title,
        done: t.status === 'completed',
        recurring: !!t.seriesId,
        priority: t.priority,
        overdue: isOverdue(t),
        task: t,
      })
    if (t.deadline && t.deadline !== t.date && inRange(t.deadline, start, end))
      out.push({ key: `d-${t.id}`, kind: 'deadline', date: t.deadline, title: t.title, done: t.status === 'completed', recurring: false, task: t })
  }
  for (const w of scheduled) {
    if (!inRange(w.date, start, end)) continue
    const template = tpl.get(w.templateId)
    out.push({
      key: `w-${w.id}`,
      kind: 'workout',
      date: w.date,
      time: w.time,
      title: template?.name ?? 'Entreno',
      done: w.status === 'completed',
      skipped: w.status === 'skipped',
      recurring: !!w.seriesId,
      minutes: template?.estimatedMin ?? 45,
      workout: w,
      template,
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || ('time' in a && a.time ? a.time : '99').localeCompare('time' in b && b.time ? b.time : '99'))
}

export function useCalendarItems(start: ISODate, end: ISODate) {
  const tasks = useStore((s) => s.tasks)
  const scheduled = useStore((s) => s.scheduled)
  const templates = useStore((s) => s.templates)
  return useMemo(() => buildItems(tasks, scheduled, templates, start, end), [tasks, scheduled, templates, start, end])
}

export function groupByDate<T extends { date: ISODate }>(items: T[]): Map<ISODate, T[]> {
  const m = new Map<ISODate, T[]>()
  for (const i of items) {
    const arr = m.get(i.date)
    if (arr) arr.push(i)
    else m.set(i.date, [i])
  }
  return m
}
