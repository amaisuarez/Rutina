import { Suspense, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, CalendarPlus, Check, CircleAlert, Dumbbell, ListPlus, Menu as MenuIcon, Plus, X } from 'lucide-react'
import { NAV } from './nav'
import { cx } from '../ui/cx'
import { PageSkeleton } from '../ui/Misc'
import { useSaveStatus } from '../../services/persistence'
import { openComposer } from '../../store/ui'
import { useStore } from '../../store'
import { totalPoints } from '../../features/gamification/stats'
import { levelFor } from '../../features/gamification/scoring'
import { today } from '../../utils/dates'

function Wordmark() {
  return (
    <NavLink to="/" className="flex items-center gap-2.5 rounded-lg" aria-label="Rutina, ir a Hoy">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8 rounded-[9px]" />
      <span className="font-display text-[22px] font-bold tracking-[-0.03em]" style={{ fontVariationSettings: '"wdth" 85' }}>
        Rutina
      </span>
    </NavLink>
  )
}

const QUICK = [
  { label: 'Nueva tarea', icon: ListPlus, run: () => openComposer({ kind: 'task', date: today() }) },
  { label: 'Programar entreno', icon: Dumbbell, run: () => openComposer({ kind: 'workout', date: today() }) },
  { label: 'Registrar gasto', icon: ArrowUpRight, run: () => openComposer({ kind: 'transaction', type: 'expense' }) },
  { label: 'Registrar ingreso', icon: ArrowDownLeft, run: () => openComposer({ kind: 'transaction', type: 'income' }) },
]

function QuickAdd({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'flex items-center justify-center gap-2 bg-ink font-medium text-paper transition-transform active:scale-95',
          compact ? 'size-10 rounded-full' : 'h-11 w-full rounded-ctl',
        )}
        aria-label="Crear"
      >
        <Plus size={compact ? 20 : 18} className={cx('transition-transform', open && 'rotate-45')} />
        {!compact && 'Crear'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            className={cx(
              'absolute z-40 mt-2 w-56 animate-rise rounded-[16px] border border-line bg-card p-1.5 shadow-pop',
              compact ? 'right-0 top-full' : 'left-0 top-full',
            )}
          >
            {QUICK.map((q) => (
              <button
                key={q.label}
                role="menuitem"
                type="button"
                autoFocus={q === QUICK[0]}
                onClick={() => {
                  setOpen(false)
                  q.run()
                }}
                className="flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left text-sm hover:bg-sunken focus:bg-sunken focus:outline-none"
              >
                <q.icon size={17} className="text-mute" />
                {q.label}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <NavLink
              to="/agenda"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-sm hover:bg-sunken"
            >
              <CalendarPlus size={17} className="text-mute" />
              Ver la agenda
            </NavLink>
          </div>
        </>
      )}
    </div>
  )
}

function SaveIndicator() {
  const { state, error } = useSaveStatus()
  if (state === 'error')
    return (
      <p className="flex items-start gap-1.5 text-[12.5px] text-danger" role="alert">
        <CircleAlert size={14} className="mt-0.5 shrink-0" />
        {error}
      </p>
    )
  return (
    <p className="flex items-center gap-1.5 text-[12.5px] text-mute" title="Los datos se guardan en este navegador, en este dispositivo.">
      <Check size={13} className={cx(state === 'saving' && 'opacity-30')} />
      {state === 'saving' ? 'Guardando…' : 'Guardado en este dispositivo'}
    </p>
  )
}

function LevelChip() {
  const ledger = useStore((s) => s.ledger)
  const total = totalPoints(ledger)
  const { level, progress } = levelFor(total)
  return (
    <NavLink to="/logros" className="block rounded-[14px] bg-lilac px-3.5 py-3 transition-colors hover:bg-lilac/70">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[15px] font-semibold text-lilac-ink">Nivel {level}</span>
        <span className="num text-[12.5px] text-lilac-ink/80">{total.toLocaleString('es-ES')} pts</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60">
        <div className="bar-progress h-full rounded-full bg-lilac-ink" style={{ width: `${progress * 100}%` }} />
      </div>
    </NavLink>
  )
}

function SideNav() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-6 border-r border-line px-4 py-6 lg:flex">
      <div className="px-2">
        <Wordmark />
      </div>
      <QuickAdd />
      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              cx(
                'group flex h-10 items-center gap-3 rounded-ctl px-3 text-[14.5px] font-medium transition-colors',
                isActive ? 'text-ink' : 'text-mute hover:bg-sunken hover:text-ink',
              )
            }
            style={({ isActive }) => (isActive ? { background: n.tint } : undefined)}
          >
            {({ isActive }) => (
              <>
                <n.icon size={18} style={isActive ? { color: n.ink } : undefined} />
                {n.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-4">
        <LevelChip />
        <div className="px-1">
          <SaveIndicator />
        </div>
      </div>
    </aside>
  )
}

const MOBILE_MAIN = NAV.filter((n) => ['/', '/tareas', '/agenda', '/entreno'].includes(n.to))
const MOBILE_MORE = NAV.filter((n) => !MOBILE_MAIN.includes(n))

function BottomNav() {
  const [more, setMore] = useState(false)
  const loc = useLocation()
  const moreActive = MOBILE_MORE.some((n) => loc.pathname.startsWith(n.to))
  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {MOBILE_MAIN.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => cx('flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-ink' : 'text-mute')}
            >
              {({ isActive }) => (
                <>
                  <span className="grid h-7 w-12 place-items-center rounded-full transition-colors" style={isActive ? { background: n.tint, color: n.ink } : undefined}>
                    <n.icon size={19} />
                  </span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMore(true)}
            aria-expanded={more}
            className={cx('flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium', moreActive ? 'text-ink' : 'text-mute')}
          >
            <span className={cx('grid h-7 w-12 place-items-center rounded-full', moreActive && 'bg-sunken')}>
              <MenuIcon size={19} />
            </span>
            Más
          </button>
        </div>
      </nav>
      {more && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Más secciones">
          <div className="absolute inset-0 animate-fade bg-ink/30" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 animate-sheet rounded-t-[26px] bg-card px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="font-display text-lg font-semibold">Más</span>
              <button type="button" onClick={() => setMore(false)} aria-label="Cerrar" className="grid size-10 place-items-center rounded-full hover:bg-sunken">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-1.5">
              {MOBILE_MORE.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setMore(false)}
                  className="flex h-14 items-center gap-3 rounded-[14px] px-4 text-[15px] font-medium"
                  style={{ background: n.tint }}
                >
                  <n.icon size={20} style={{ color: n.ink }} />
                  {n.label}
                </NavLink>
              ))}
            </div>
            <div className="mt-4 px-2">
              <SaveIndicator />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation()
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-lg bg-ink px-3 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Saltar al contenido
      </a>
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/92 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
          <Wordmark />
          <QuickAdd compact />
        </header>
        <main id="main" className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-6 pb-[calc(96px+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
          <Suspense fallback={<PageSkeleton />}>
            <div key={loc.pathname} className="animate-fade">
              {children}
            </div>
          </Suspense>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
