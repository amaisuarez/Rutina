import { CalendarDays, Dumbbell, ListChecks, Settings, Sun, Trophy, Wallet, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** CSS colour of the module tint, used for the active marker. */
  tint: string
  ink: string
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Hoy', icon: Sun, tint: 'var(--color-sunken)', ink: 'var(--color-ink)' },
  { to: '/tareas', label: 'Tareas', icon: ListChecks, tint: 'var(--color-sky)', ink: 'var(--color-sky-ink)' },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, tint: 'var(--color-sunken)', ink: 'var(--color-ink)' },
  { to: '/entreno', label: 'Entreno', icon: Dumbbell, tint: 'var(--color-sage)', ink: 'var(--color-sage-ink)' },
  { to: '/finanzas', label: 'Finanzas', icon: Wallet, tint: 'var(--color-peach)', ink: 'var(--color-peach-ink)' },
  { to: '/logros', label: 'Logros', icon: Trophy, tint: 'var(--color-lilac)', ink: 'var(--color-lilac-ink)' },
  { to: '/ajustes', label: 'Ajustes', icon: Settings, tint: 'var(--color-sunken)', ink: 'var(--color-ink)' },
]
