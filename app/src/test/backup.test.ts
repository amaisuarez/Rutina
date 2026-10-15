import { describe, expect, it } from 'vitest'
import { emptyData } from '../store/defaults'
import { backupStatus } from '../services/backup'

const DAY = 86_400_000
const now = new Date('2026-10-20T12:00:00Z').getTime()
const task = (createdAt: string, demo?: boolean) => ({ id: createdAt, title: 'x', priority: 'low' as const, difficulty: 'easy' as const, category: 'x', status: 'pending' as const, subtasks: [], createdAt, updatedAt: createdAt, demo })

describe('backup reminder', () => {
  it('is silent without user data, or with only demo data', () => {
    expect(backupStatus(emptyData(), now).due).toBe(false)
    const d = emptyData()
    d.tasks = [task(new Date(now - 30 * DAY).toISOString(), true)]
    expect(backupStatus(d, now).due).toBe(false)
  })
  it('is due 7 days after first use when no backup exists', () => {
    const d = emptyData()
    d.tasks = [task(new Date(now - 6 * DAY).toISOString())]
    expect(backupStatus(d, now).due).toBe(false)
    d.tasks = [task(new Date(now - 7 * DAY).toISOString())]
    expect(backupStatus(d, now)).toEqual({ due: true, daysSince: 7, never: true })
  })
  it('counts from the last backup and respects snooze', () => {
    const d = emptyData()
    d.tasks = [task(new Date(now - 60 * DAY).toISOString())]
    d.settings.lastBackupAt = new Date(now - 2 * DAY).toISOString()
    expect(backupStatus(d, now).due).toBe(false)
    d.settings.lastBackupAt = new Date(now - 9 * DAY).toISOString()
    expect(backupStatus(d, now).due).toBe(true)
    d.settings.backupSnoozedUntil = new Date(now + DAY).toISOString()
    expect(backupStatus(d, now).due).toBe(false)
  })
})
