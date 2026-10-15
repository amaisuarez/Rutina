import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { useStore, selectData } from '../store'
import { emptyData } from '../store/defaults'
import { memoryAdapter, normalize, makeBackup, BackupError } from '../services/storage'
import { startPersistence, restoreBackup } from '../services/persistence'
import { today } from '../utils/dates'

describe('persistence', () => {
  it('saves changes and restores them on reload', async () => {
    const adapter = memoryAdapter()
    useStore.getState().hydrate(emptyData())
    startPersistence(adapter)
    useStore.getState().addTask({ title: 'Persistir', date: today(), priority: 'low', difficulty: 'easy', category: 'Otros', subtasks: [] })
    await new Promise((r) => setTimeout(r, 300))
    expect((adapter.value as { tasks: unknown[] }).tasks.length).toBe(1)

    useStore.getState().hydrate(emptyData())
    startPersistence(adapter)
    expect(useStore.getState().tasks[0].title).toBe('Persistir')
  })

  it('round-trips a JSON backup', () => {
    useStore.getState().hydrate(emptyData())
    useStore.getState().saveTransaction({ type: 'expense', amount: 999, date: today(), categoryId: 'food', accountId: 'main', description: 'Pan' })
    const json = makeBackup(selectData(useStore.getState()))
    useStore.getState().hydrate(emptyData())
    restoreBackup(json)
    expect(useStore.getState().transactions[0].amount).toBe(999)
  })

  it('rejects files that are not Rutina backups', () => {
    expect(() => restoreBackup('nope')).toThrow(BackupError)
    expect(() => normalize({ foo: 1 })).toThrow(BackupError)
    expect(() => normalize({ tasks: 'x' })).toThrow(BackupError)
    expect(normalize({ tasks: [{ id: 'a' }, { nope: 1 }] }).tasks.length).toBe(1)
  })
})

describe('financial privacy', () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f)
      return statSync(p).isDirectory() ? files(p) : [p]
    })
  }
  it('gamification code never imports or reads finance data', () => {
    const dir = join(__dirname, '..', 'features', 'gamification')
    for (const f of files(dir)) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/from ['"][^'"]*finance/)
      expect(src, f).not.toMatch(/\b(transactions|accounts|budget|savings|money\()\b/)
    }
  })
})
