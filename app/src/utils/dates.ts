import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  getISODay,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { ISODate } from '../types'

/** All week maths in the app is Monday-first (Spanish convention). */
export const WEEK = { weekStartsOn: 1 as const, locale: es }

export function toISO(d: Date): ISODate {
  return format(d, 'yyyy-MM-dd')
}

export function fromISO(s: ISODate): Date {
  return parse(s, 'yyyy-MM-dd', new Date())
}

export function isISODate(s: unknown): s is ISODate {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(fromISO(s))
}

export function today(): ISODate {
  return toISO(new Date())
}

export function addDaysISO(s: ISODate, n: number): ISODate {
  return toISO(addDays(fromISO(s), n))
}

export function addMonthsISO(s: ISODate, n: number): ISODate {
  return toISO(addMonths(fromISO(s), n))
}

export function diffDays(a: ISODate, b: ISODate): number {
  return differenceInCalendarDays(fromISO(a), fromISO(b))
}

/** ISO weekday: 1 = lunes … 7 = domingo. */
export function weekday(s: ISODate): number {
  return getISODay(fromISO(s))
}

export function weekStart(s: ISODate): ISODate {
  return toISO(startOfWeek(fromISO(s), WEEK))
}

export function weekEnd(s: ISODate): ISODate {
  return toISO(endOfWeek(fromISO(s), WEEK))
}

export function monthStart(s: ISODate): ISODate {
  return toISO(startOfMonth(fromISO(s)))
}

export function monthEnd(s: ISODate): ISODate {
  return toISO(endOfMonth(fromISO(s)))
}

/** `YYYY-MM` key for a date. */
export function monthKey(s: ISODate): string {
  return s.slice(0, 7)
}

export function daysBetween(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = start; d <= end; d = addDaysISO(d, 1)) out.push(d)
  return out
}

export function weekDays(anchor: ISODate): ISODate[] {
  return daysBetween(weekStart(anchor), weekEnd(anchor))
}

/** 6×7 grid of dates covering the month of `anchor`, Monday-first. */
export function monthGrid(anchor: ISODate): ISODate[] {
  const start = weekStart(monthStart(anchor))
  return Array.from({ length: 42 }, (_, i) => addDaysISO(start, i))
}

export function inRange(d: ISODate, start: ISODate, end: ISODate): boolean {
  return d >= start && d <= end
}

/** Local date of an ISO timestamp. */
export function dateOf(timestamp: string): ISODate {
  return toISO(new Date(timestamp))
}

export function fmt(s: ISODate, pattern: string): string {
  return format(fromISO(s), pattern, { locale: es })
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "hoy", "mañana", "ayer" or "lun 14 oct". */
export function relativeDay(s: ISODate, ref: ISODate = today()): string {
  const d = diffDays(s, ref)
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  if (d === -1) return 'Ayer'
  return capitalize(fmt(s, d > -7 && d < 7 ? 'EEEE d' : 'EEE d MMM'))
}

export const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
export const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function greeting(d = new Date()): string {
  const h = d.getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 13) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

export function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}
