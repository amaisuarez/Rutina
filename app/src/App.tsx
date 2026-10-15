import { lazy, useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { ListChecks, Sparkles } from 'lucide-react'
import { AppShell } from './components/layout/AppShell'
import { Toaster, ConfirmHost, Celebration } from './components/ui/Feedback'
import { Modal } from './components/ui/Modal'
import { Button } from './components/ui/Button'
import { Field, Input } from './components/ui/Form'
import { EmptyState } from './components/ui/Misc'
import { useStore } from './store'
import { celebrate, closeComposer, useUI } from './store/ui'
import { TaskForm } from './features/tasks/TaskForm'
import { TransactionForm } from './features/finance/TransactionForm'
import { ScheduleWorkoutForm } from './features/fitness/forms'
import { EventChooser } from './features/calendar/EventChooser'
import { ACHIEVEMENTS } from './features/gamification/stats'
import { loadDemo } from './services/demo'

// Route-level code splitting keeps the first load small; charts load with the pages that need them.
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'))
const TasksPage = lazy(() => import('./features/tasks/TasksPage'))
const AgendaPage = lazy(() => import('./features/calendar/AgendaPage'))
const FitnessPage = lazy(() => import('./features/fitness/FitnessPage'))
const SessionPage = lazy(() => import('./features/fitness/SessionPage'))
const FinancePage = lazy(() => import('./features/finance/FinancePage'))
const RankingPage = lazy(() => import('./features/gamification/RankingPage'))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'))

function ComposerHost() {
  const c = useUI((s) => s.composer)
  if (!c) return null
  // `key` resets form state when a different item is opened.
  switch (c.kind) {
    case 'task':
      return <TaskForm key={c.task?.id ?? `new-${c.date}`} task={c.task} date={c.date} />
    case 'transaction':
      return <TransactionForm key={c.tx?.id ?? `new-${c.type}`} tx={c.tx} type={c.type} />
    case 'workout':
      return <ScheduleWorkoutForm date={c.date} templateId={c.templateId} />
    case 'event':
      return <EventChooser date={c.date} onClose={closeComposer} />
  }
}

/** Unlocks achievements whenever activity changes and celebrates new ones. */
function AchievementWatcher() {
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.tasks === prev.tasks && s.sessions === prev.sessions && s.ledger === prev.ledger) return
        // Defer so the triggering update (and its toast) lands first.
        queueMicrotask(() => {
          const ids = useStore.getState().syncAchievements()
          const def = ACHIEVEMENTS.find((a) => a.id === ids[0])
          if (def && !s.ledger.every((e) => e.demo)) celebrate({ id: def.id, title: def.title, description: def.description })
        })
      }),
    [],
  )
  return null
}

function Welcome() {
  const onboarded = useStore((s) => s.settings.onboarded)
  const [name, setName] = useState('')
  if (onboarded) return null
  const finish = (demo: boolean) => {
    useStore.getState().updateSettings({ onboarded: true, name: name.trim() })
    if (demo) loadDemo()
  }
  return (
    <Modal open onClose={() => finish(false)} title="Te damos la bienvenida a Rutina" description="Tareas, entrenos, finanzas y logros en un solo sitio." tone="lilac" size="sm">
      <div className="space-y-5">
        <Field label="¿Cómo te llamas? (opcional)" htmlFor="w-name">
          <Input id="w-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Tu nombre" />
        </Field>
        <p className="text-sm text-ink-2">Todo se guarda solo en este navegador. No hace falta cuenta.</p>
        <div className="grid gap-2">
          <Button variant="primary" size="lg" icon={<ListChecks size={18} />} onClick={() => finish(false)}>
            Empezar con la app vacía
          </Button>
          <Button size="lg" icon={<Sparkles size={18} />} onClick={() => finish(true)}>
            Explorar con datos de ejemplo
          </Button>
          <p className="text-center text-[12.5px] text-mute">Los datos de ejemplo se pueden borrar después desde Ajustes.</p>
        </div>
      </div>
    </Modal>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tareas" element={<TasksPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/entreno" element={<FitnessPage />} />
          <Route path="/entreno/sesion/:id" element={<SessionPage />} />
          <Route path="/finanzas" element={<FinancePage />} />
          <Route path="/logros" element={<RankingPage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
          <Route path="*" element={<EmptyState title="Esta página no existe" body="Vuelve al inicio desde el menú." className="mt-10" />} />
        </Routes>
      </AppShell>
      <ComposerHost />
      <ConfirmHost />
      <Toaster />
      <Celebration />
      <AchievementWatcher />
      <Welcome />
    </HashRouter>
  )
}
