import { describe, expect, it } from 'vitest'
import { balance, budgetLines, generateRecurring, goalEstimate, occurrences, periodFor, totals, transactionsToRows } from '../features/finance/calc'
import { parseMoney, money } from '../utils/format'
import { parseCSV, toCSV } from '../utils/csv'
import type { RecurringRule, Transaction } from '../types'

const tx = (type: Transaction['type'], amount: number, date: string, categoryId = 'food'): Transaction => ({
  id: Math.random().toString(36), type, amount, date, categoryId, accountId: 'main', description: 'x', source: 'manual', createdAt: '',
})

describe('totals', () => {
  const txs = [tx('income', 200000, '2026-03-01'), tx('expense', 50000, '2026-03-15'), tx('expense', 1050, '2026-03-31'), tx('expense', 9999, '2026-04-01')]
  it('respects period boundaries', () => {
    const p = periodFor('month', '2026-03-10')
    expect(p).toEqual({ kind: 'month', start: '2026-03-01', end: '2026-03-31' })
    const t = totals(txs, p.start, p.end)
    expect(t.income).toBe(200000)
    expect(t.expense).toBe(51050)
    expect(t.net).toBe(148950)
    expect(t.savingsRate).toBeCloseTo(0.74475)
  })
  it('computes quarter and year periods', () => {
    expect(periodFor('quarter', '2026-05-20')).toEqual({ kind: 'quarter', start: '2026-04-01', end: '2026-06-30' })
    expect(periodFor('year', '2026-05-20')).toEqual({ kind: 'year', start: '2026-01-01', end: '2026-12-31' })
  })
  it('computes balance with initial balances and cut-off date', () => {
    const accounts = [{ id: 'main', name: 'A', kind: 'bank' as const, initialBalance: 10000 }]
    expect(balance(accounts, txs, '2026-03-31')).toBe(10000 + 148950)
    expect(balance(accounts, txs, '2026-04-30')).toBe(10000 + 148950 - 9999)
  })
  it('budget lines flag near and over', () => {
    const lines = budgetLines({ monthlyTotal: null, byCategory: { food: 52000, transport: 1000 } }, [...txs, tx('expense', 2000, '2026-03-02', 'transport')], '2026-03-05')
    expect(lines.find((l) => l.categoryId === 'food')!.state).toBe('near')
    expect(lines.find((l) => l.categoryId === 'transport')!.state).toBe('over')
  })
})

describe('recurring', () => {
  const rule: RecurringRule = { id: 'r1', type: 'expense', amount: 1000, categoryId: 'housing', accountId: 'main', description: 'Alquiler', freq: 'monthly', startDate: '2026-01-31', active: true }
  it('clamps month-end dates', () => {
    expect(occurrences(rule, '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })
  it('is idempotent and does not resurrect deleted occurrences', () => {
    const make = (r: RecurringRule, date: string) => ({ ...tx('expense', r.amount, date), recurringId: r.id })
    const first = generateRecurring([rule], [], '2026-03-31', make)
    expect(first.created.length).toBe(3)
    const again = generateRecurring(first.rules, first.created, '2026-03-31', make)
    expect(again.created.length).toBe(0)
    // user deleted February — still not regenerated
    const kept = first.created.filter((t) => t.date !== '2026-02-28')
    expect(generateRecurring(first.rules, kept, '2026-04-30', make).created.map((t) => t.date)).toEqual(['2026-04-30'])
  })
  it('weekly and yearly', () => {
    expect(occurrences({ ...rule, freq: 'weekly', startDate: '2026-03-02' }, '2026-03-01', '2026-03-20')).toEqual(['2026-03-02', '2026-03-09', '2026-03-16'])
    expect(occurrences({ ...rule, freq: 'yearly', startDate: '2024-02-29' }, '2024-01-01', '2026-12-31')).toEqual(['2024-02-29', '2025-02-28', '2026-02-28'])
  })
})

describe('money & csv', () => {
  it('parses Spanish and plain amounts into cents', () => {
    expect(parseMoney('12,50')).toBe(1250)
    expect(parseMoney('1.234,56')).toBe(123456)
    expect(parseMoney('1.234')).toBe(123400)
    expect(parseMoney('1234.5')).toBe(123450)
    expect(parseMoney('0')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
  })
  it('formats euros with Spanish conventions', () => {
    expect(money(123456).replace(/\s/g, ' ')).toBe('1234,56 €'.replace(/\s/g, ' ').replace('1234', '1234'))
    expect(money(12345678).replace(/ /g, ' ')).toBe('123.456,78 €')
  })
  it('round-trips CSV with quoting', () => {
    const rows = transactionsToRows([{ ...tx('expense', 1050, '2026-03-01'), description: 'Café; "bueno"' }], [{ id: 'food', name: 'Comida', type: 'expense', color: '' }], [{ id: 'main', name: 'Banco', kind: 'bank', initialBalance: 0 }])
    const parsed = parseCSV(toCSV(rows))
    expect(parsed[1][2]).toBe('Café; "bueno"')
    expect(parsed[1][3]).toBe('10,50')
  })
  it('estimates goal completion only with enough history', () => {
    const g = { id: 'g', name: 'x', target: 10000, createdAt: '', contributions: [{ id: 'a', date: '2026-01-01', amount: 1000 }] }
    expect(goalEstimate(g, '2026-02-01')).toBeNull()
    g.contributions.push({ id: 'b', date: '2026-01-15', amount: 1000 })
    expect(goalEstimate(g, '2026-01-31')).not.toBeNull()
  })
})
