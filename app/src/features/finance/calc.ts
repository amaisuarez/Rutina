import type {
  Account,
  Budget,
  Category,
  ID,
  ISODate,
  RecurringRule,
  SavingsGoal,
  Transaction,
  TxRecurrenceFreq,
} from '../../types'
import { addDaysISO, addMonthsISO, diffDays, fromISO, inRange, monthEnd, monthStart, today, toISO } from '../../utils/dates'
import { addYears, getDaysInMonth } from 'date-fns'

/* ------------------------------------------------------------------ */
/* Periods                                                             */
/* ------------------------------------------------------------------ */

export type PeriodKind = 'month' | 'quarter' | 'year'

export interface Period {
  kind: PeriodKind
  start: ISODate
  end: ISODate
}

export function periodFor(kind: PeriodKind, anchor: ISODate): Period {
  const d = fromISO(anchor)
  if (kind === 'month') return { kind, start: monthStart(anchor), end: monthEnd(anchor) }
  if (kind === 'quarter') {
    const q = Math.floor(d.getMonth() / 3)
    const start = toISO(new Date(d.getFullYear(), q * 3, 1))
    return { kind, start, end: monthEnd(addMonthsISO(start, 2)) }
  }
  return { kind, start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31` }
}

export function shiftPeriod(p: Period, dir: -1 | 1): Period {
  const months = p.kind === 'month' ? 1 : p.kind === 'quarter' ? 3 : 12
  return periodFor(p.kind, addMonthsISO(p.start, dir * months))
}

/* ------------------------------------------------------------------ */
/* Totals                                                              */
/* ------------------------------------------------------------------ */

export interface Totals {
  income: number
  expense: number
  net: number
  /** net / income, or 0 when there is no income. */
  savingsRate: number
}

export function totals(txs: Transaction[], start: ISODate, end: ISODate): Totals {
  let income = 0
  let expense = 0
  for (const t of txs) {
    if (!inRange(t.date, start, end)) continue
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  const net = income - expense
  return { income, expense, net, savingsRate: income > 0 ? net / income : 0 }
}

export function byCategory(txs: Transaction[], type: Transaction['type'], start: ISODate, end: ISODate): Map<ID, number> {
  const map = new Map<ID, number>()
  for (const t of txs) {
    if (t.type !== type || !inRange(t.date, start, end)) continue
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
  }
  return map
}

/** Balance of one account (or all, if accountId omitted) at the end of `upTo`. */
export function balance(accounts: Account[], txs: Transaction[], upTo: ISODate = today(), accountId?: ID): number {
  let b = 0
  for (const a of accounts) if (!accountId || a.id === accountId) b += a.initialBalance
  for (const t of txs) {
    if (t.date > upTo) continue
    if (accountId && t.accountId !== accountId) continue
    b += t.type === 'income' ? t.amount : -t.amount
  }
  return b
}

export interface MonthPoint {
  month: string // YYYY-MM
  start: ISODate
  income: number
  expense: number
  net: number
  balance: number
}

/** One point per month from `start` to `end` (inclusive months), with running end-of-month balance. */
export function monthlySeries(accounts: Account[], txs: Transaction[], start: ISODate, end: ISODate): MonthPoint[] {
  const out: MonthPoint[] = []
  for (let m = monthStart(start); m <= end; m = addMonthsISO(m, 1)) {
    const me = monthEnd(m)
    const t = totals(txs, m, me)
    out.push({ month: m.slice(0, 7), start: m, income: t.income, expense: t.expense, net: t.net, balance: balance(accounts, txs, me) })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Budgets                                                             */
/* ------------------------------------------------------------------ */

export type BudgetState = 'ok' | 'near' | 'over'

export function budgetState(spent: number, limit: number): BudgetState {
  if (limit <= 0) return 'ok'
  const r = spent / limit
  return r > 1 ? 'over' : r >= 0.85 ? 'near' : 'ok'
}

export interface BudgetLine {
  categoryId: ID
  limit: number
  spent: number
  remaining: number
  ratio: number
  state: BudgetState
}

export function budgetLines(budget: Budget, txs: Transaction[], monthAnchor: ISODate): BudgetLine[] {
  const spentBy = byCategory(txs, 'expense', monthStart(monthAnchor), monthEnd(monthAnchor))
  return Object.entries(budget.byCategory)
    .filter(([, limit]) => limit > 0)
    .map(([categoryId, limit]) => {
      const spent = spentBy.get(categoryId) ?? 0
      return { categoryId, limit, spent, remaining: limit - spent, ratio: spent / limit, state: budgetState(spent, limit) }
    })
    .sort((a, b) => b.ratio - a.ratio)
}

/** Expected share of the month elapsed — used to say "on pace" rather than just "x% spent". */
export function monthElapsed(anchor: ISODate, ref: ISODate = today()): number {
  const ms = monthStart(anchor)
  const me = monthEnd(anchor)
  if (ref < ms) return 0
  if (ref > me) return 1
  return (diffDays(ref, ms) + 1) / getDaysInMonth(fromISO(anchor))
}

/* ------------------------------------------------------------------ */
/* Recurring                                                           */
/* ------------------------------------------------------------------ */

export function nextOccurrence(freq: TxRecurrenceFreq, from: ISODate, start: ISODate): ISODate {
  if (freq === 'weekly') return addDaysISO(from, 7)
  if (freq === 'monthly') {
    // Keep the original day-of-month, clamped for short months (31 → 30/28).
    const target = fromISO(start).getDate()
    const next = fromISO(addMonthsISO(monthStart(from), 1))
    next.setDate(Math.min(target, getDaysInMonth(next)))
    return toISO(next)
  }
  const s = fromISO(start)
  const n = addYears(fromISO(from), 1)
  n.setMonth(s.getMonth(), Math.min(s.getDate(), getDaysInMonth(new Date(n.getFullYear(), s.getMonth(), 1))))
  return toISO(n)
}

/** All occurrence dates of a rule within [from, to]. */
export function occurrences(rule: Pick<RecurringRule, 'freq' | 'startDate' | 'endDate'>, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  const last = rule.endDate && rule.endDate < to ? rule.endDate : to
  let d = rule.startDate
  let guard = 0
  while (d <= last && guard++ < 5000) {
    if (d >= from) out.push(d)
    d = nextOccurrence(rule.freq, d, rule.startDate)
  }
  return out
}

/**
 * Generates transactions for every occurrence after `generatedThrough` up to `upTo`.
 * Idempotent: an occurrence that already exists (same rule + date) is never created again,
 * and `generatedThrough` makes sure deleted occurrences are not resurrected.
 */
export function generateRecurring(
  rules: RecurringRule[],
  txs: Transaction[],
  upTo: ISODate,
  make: (rule: RecurringRule, date: ISODate) => Transaction,
): { created: Transaction[]; rules: RecurringRule[] } {
  const existing = new Set(txs.filter((t) => t.recurringId).map((t) => `${t.recurringId}|${t.date}`))
  const created: Transaction[] = []
  const nextRules = rules.map((r) => {
    if (!r.active) return r
    const from = r.generatedThrough ? addDaysISO(r.generatedThrough, 1) : r.startDate
    if (from > upTo) return r
    for (const d of occurrences(r, from, upTo)) {
      const key = `${r.id}|${d}`
      if (existing.has(key)) continue
      existing.add(key)
      created.push(make(r, d))
    }
    return { ...r, generatedThrough: upTo }
  })
  return { created, rules: nextRules }
}

export function upcomingRecurring(rules: RecurringRule[], from: ISODate, days: number) {
  const to = addDaysISO(from, days)
  return rules
    .filter((r) => r.active)
    .flatMap((r) => occurrences(r, from, to).map((date) => ({ rule: r, date })))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/* ------------------------------------------------------------------ */
/* Savings goals                                                       */
/* ------------------------------------------------------------------ */

export function goalSaved(goal: SavingsGoal): number {
  return goal.contributions.reduce((s, c) => s + c.amount, 0)
}

/**
 * Estimates the completion date from the average monthly contribution rate.
 * Returns null when there is not enough history (fewer than 2 contributions or < 14 days).
 */
export function goalEstimate(goal: SavingsGoal, ref: ISODate = today()): ISODate | null {
  const saved = goalSaved(goal)
  if (saved >= goal.target) return null
  if (goal.contributions.length < 2) return null
  const first = goal.contributions.map((c) => c.date).sort()[0]
  const span = diffDays(ref, first)
  if (span < 14 || saved <= 0) return null
  const perDay = saved / span
  return addDaysISO(ref, Math.ceil((goal.target - saved) / perDay))
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

export const CSV_HEADER = ['fecha', 'tipo', 'descripcion', 'importe', 'categoria', 'cuenta', 'notas', 'origen']

export function transactionsToRows(txs: Transaction[], categories: Category[], accounts: Account[]): (string | number)[][] {
  const cat = new Map(categories.map((c) => [c.id, c.name]))
  const acc = new Map(accounts.map((a) => [a.id, a.name]))
  return [
    CSV_HEADER,
    ...[...txs]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => [
        t.date,
        t.type === 'income' ? 'ingreso' : 'gasto',
        t.description,
        (t.amount / 100).toFixed(2).replace('.', ','),
        cat.get(t.categoryId) ?? '',
        acc.get(t.accountId) ?? '',
        t.notes ?? '',
        t.source === 'imported' ? 'importado' : t.source === 'recurring' ? 'recurrente' : 'manual',
      ]),
  ]
}
