import { create } from 'zustand'
import type { ISODate, Task, Transaction, TxType } from '../types'
import { uid } from '../utils/id'

export interface Toast {
  id: string
  message: string
  tone?: 'default' | 'points' | 'error'
  action?: { label: string; run: () => void }
}

export interface ConfirmRequest {
  title: string
  body?: string
  confirmLabel: string
  tone?: 'danger' | 'default'
  /** Optional second action (e.g. "Solo esta"). */
  altLabel?: string
  resolve: (result: boolean | 'alt') => void
}

export type Composer =
  | { kind: 'task'; task?: Task; date?: ISODate }
  | { kind: 'transaction'; tx?: Transaction; type?: TxType }
  | { kind: 'workout'; date?: ISODate; templateId?: string }
  | { kind: 'event'; date: ISODate; time?: string }

interface UIState {
  toasts: Toast[]
  confirm: ConfirmRequest | null
  composer: Composer | null
  celebration: { id: string; title: string; description: string } | null
}

export const useUI = create<UIState>(() => ({ toasts: [], confirm: null, composer: null, celebration: null }))

export function toast(message: string, opts: Omit<Toast, 'id' | 'message'> = {}) {
  const id = uid()
  useUI.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, ...opts }] }))
  setTimeout(() => dismissToast(id), opts.action ? 6000 : 3200)
}

export function dismissToast(id: string) {
  useUI.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}

/** Toast for point changes; silent when nothing changed. */
export function pointsToast(points: number, what: string) {
  if (points > 0) toast(`${what}: +${points} puntos`, { tone: 'points' })
  else if (points < 0) toast(`${what}. Se retiran ${-points} puntos`)
  else toast(what)
}

export function confirm(req: Omit<ConfirmRequest, 'resolve' | 'altLabel'>): Promise<boolean> {
  return new Promise((resolve) => useUI.setState({ confirm: { ...req, resolve: (r) => resolve(r === true) } }))
}

/** Three-way confirm: resolves 'main', 'alt' or null (cancelled). */
export function choose(req: Omit<ConfirmRequest, 'resolve'> & { altLabel: string }): Promise<'main' | 'alt' | null> {
  return new Promise((resolve) => useUI.setState({ confirm: { ...req, resolve: (r) => resolve(r === true ? 'main' : r === 'alt' ? 'alt' : null) } }))
}

export function openComposer(c: Composer) {
  useUI.setState({ composer: c })
}

export function closeComposer() {
  useUI.setState({ composer: null })
}

export function celebrate(c: { id: string; title: string; description: string }) {
  useUI.setState({ celebration: c })
}
