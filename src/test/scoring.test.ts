import { describe, expect, it } from 'vitest'
import { DEFAULT_SCORING, levelFor, taskPoints, workoutScore } from '../features/gamification/scoring'
import type { WorkoutSession } from '../types'

const session = (done: boolean[], durationMin: number, intensity: WorkoutSession['intensity'] = 'standard') => ({
  intensity,
  durationMin,
  exercises: [{ exerciseId: 'x', restSec: 60, targetReps: '10', sets: done.map((d) => ({ done: d })) }],
})

describe('task points', () => {
  it('uses difficulty defaults', () => {
    expect(taskPoints({ difficulty: 'easy' }, DEFAULT_SCORING)).toBe(5)
    expect(taskPoints({ difficulty: 'medium' }, DEFAULT_SCORING)).toBe(10)
    expect(taskPoints({ difficulty: 'hard' }, DEFAULT_SCORING)).toBe(20)
    expect(taskPoints({ difficulty: 'very_hard' }, DEFAULT_SCORING)).toBe(30)
  })
  it('adds a bounded duration bonus', () => {
    expect(taskPoints({ difficulty: 'easy', estimatedMin: 60 }, DEFAULT_SCORING)).toBe(5)
    expect(taskPoints({ difficulty: 'easy', estimatedMin: 125 }, DEFAULT_SCORING)).toBe(10)
    expect(taskPoints({ difficulty: 'easy', estimatedMin: 10_000 }, DEFAULT_SCORING)).toBe(15)
  })
})

describe('workout points', () => {
  it('scores by intensity', () => {
    expect(workoutScore(session([true, true], 40, 'light'), DEFAULT_SCORING).points).toBe(10)
    expect(workoutScore(session([true, true], 40, 'advanced'), DEFAULT_SCORING).points).toBe(40)
  })
  it('caps duration bonus and total', () => {
    expect(workoutScore(session([true], 75), DEFAULT_SCORING).points).toBe(24)
    expect(workoutScore(session([true], 600), DEFAULT_SCORING).points).toBe(30)
    expect(workoutScore(session([true], 600, 'advanced'), DEFAULT_SCORING).points).toBe(50)
  })
  it('scales down partial sessions and gives nothing for empty ones', () => {
    expect(workoutScore(session([true, false, false, false], 90), DEFAULT_SCORING).points).toBe(5)
    expect(workoutScore(session([false, false], 90), DEFAULT_SCORING).points).toBe(0)
  })
})

describe('levels', () => {
  it('maps cumulative points to levels', () => {
    expect(levelFor(0).level).toBe(1)
    expect(levelFor(99).level).toBe(1)
    expect(levelFor(100).level).toBe(2)
    expect(levelFor(300).level).toBe(3)
    expect(levelFor(450).progress).toBeCloseTo(0.5)
  })
})
