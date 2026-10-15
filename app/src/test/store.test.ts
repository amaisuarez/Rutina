import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../store'
import { emptyData } from '../store/defaults'
import { totalPoints, sumPoints } from '../features/gamification/stats'
import { netForSource } from '../features/gamification/scoring'
import { today, addDaysISO, monthStart, monthEnd } from '../utils/dates'

const base = { priority: 'medium' as const, difficulty: 'medium' as const, category: 'Trabajo', subtasks: [] }

beforeEach(() => useStore.getState().hydrate(emptyData()))

describe('task points ledger', () => {
  it('awards once no matter how many times complete is clicked', () => {
    const t = useStore.getState().addTask({ ...base, title: 'A', date: today() })
    const s = useStore.getState()
    expect(s.completeTask(t.id)).toBe(10)
    expect(s.completeTask(t.id)).toBe(0)
    expect(s.completeTask(t.id)).toBe(0)
    expect(totalPoints(useStore.getState().ledger)).toBe(10)
  })

  it('editing a completed task does not change points', () => {
    const t = useStore.getState().addTask({ ...base, title: 'A', date: today() })
    useStore.getState().completeTask(t.id)
    useStore.getState().updateTask(t.id, { difficulty: 'very_hard', title: 'B' })
    expect(totalPoints(useStore.getState().ledger)).toBe(10)
  })

  it('reopen reverses; completing again awards once; net never exceeds one award', () => {
    const t = useStore.getState().addTask({ ...base, title: 'A', date: today() })
    const s = useStore.getState()
    s.completeTask(t.id)
    expect(s.reopenTask(t.id)).toBe(-10)
    expect(totalPoints(useStore.getState().ledger)).toBe(0)
    s.completeTask(t.id)
    s.reopenTask(t.id)
    s.completeTask(t.id)
    s.completeTask(t.id)
    expect(netForSource(useStore.getState().ledger, 'task', t.id)).toBe(10)
    // full audit trail is kept
    expect(useStore.getState().ledger.length).toBe(5)
  })

  it('keeps historical points when rules change, until recalculation is requested', () => {
    const t = useStore.getState().addTask({ ...base, title: 'A', date: today() })
    useStore.getState().completeTask(t.id)
    const st = useStore.getState().settings
    useStore.getState().updateSettings({ scoring: { ...st.scoring, task: { ...st.scoring.task, medium: 25 } } })
    expect(totalPoints(useStore.getState().ledger)).toBe(10)
    expect(useStore.getState().recalculatePoints()).toBe(1)
    expect(totalPoints(useStore.getState().ledger)).toBe(25)
    expect(useStore.getState().recalculatePoints()).toBe(0)
  })

  it('attributes points to the completion month', () => {
    const t = useStore.getState().addTask({ ...base, title: 'A', date: addDaysISO(today(), -40) })
    useStore.getState().completeTask(t.id)
    expect(sumPoints(useStore.getState().ledger, monthStart(today()), monthEnd(today()), 'productivity')).toBe(10)
  })
})

describe('recurring tasks', () => {
  it('generates instances once and does not resurrect deleted ones', () => {
    const s = useStore.getState()
    s.addTask({ ...base, title: 'Diario', date: today() }, { freq: 'daily', until: addDaysISO(today(), 4) })
    expect(useStore.getState().tasks.length).toBe(5)
    const first = useStore.getState().tasks[0]
    useStore.getState().deleteTask(first.id)
    useStore.getState().maintain()
    useStore.getState().maintain()
    expect(useStore.getState().tasks.length).toBe(4)
  })
})

describe('workouts', () => {
  it('awards a session once, and only when completed', () => {
    const s = useStore.getState()
    const tpl = s.saveTemplate({ name: 'Pierna', focus: ['legs'], objective: 'strength', intensity: 'challenging', estimatedMin: 40, exercises: [{ exerciseId: 'squat', sets: 2, reps: '8', restSec: 60 }] })
    s.scheduleWorkout({ templateId: tpl.id, date: today() })
    const sch = useStore.getState().scheduled[0]
    const id = useStore.getState().startSession({ scheduledId: sch.id })
    // Starting again resumes the same session
    expect(useStore.getState().startSession({ scheduledId: sch.id })).toBe(id)
    expect(totalPoints(useStore.getState().ledger, 'fitness')).toBe(0)
    useStore.getState().updateSession(id, (x) => ({ ...x, exercises: x.exercises.map((e) => ({ ...e, sets: e.sets.map((z) => ({ ...z, done: true })) })) }))
    expect(useStore.getState().finishSession(id, { durationMin: 40 })).toBe(30)
    expect(useStore.getState().finishSession(id)).toBe(0)
    expect(useStore.getState().quickCompleteScheduled(sch.id)).toBe(0)
    expect(useStore.getState().scheduled[0].status).toBe('completed')
    expect(totalPoints(useStore.getState().ledger, 'fitness')).toBe(30)
  })

  it('planned workouts give no points; quick-complete gives them once', () => {
    const s = useStore.getState()
    const tpl = s.saveTemplate({ name: 'Movilidad', focus: ['mobility'], objective: 'recovery', intensity: 'light', estimatedMin: 20, exercises: [{ exerciseId: 'cat_cow', sets: 2, reps: '10', restSec: 15 }] })
    s.scheduleWorkout({ templateId: tpl.id, date: today(), weekdays: [1, 2, 3, 4, 5, 6, 7] })
    expect(totalPoints(useStore.getState().ledger)).toBe(0)
    const sch = useStore.getState().scheduled.find((x) => x.date === today())!
    expect(useStore.getState().quickCompleteScheduled(sch.id)).toBe(10)
    expect(useStore.getState().quickCompleteScheduled(sch.id)).toBe(0)
    expect(useStore.getState().reopenScheduled(sch.id)).toBe(-10)
    expect(totalPoints(useStore.getState().ledger)).toBe(0)
  })
})
