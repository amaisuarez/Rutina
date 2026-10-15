import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { startPersistence } from './services/persistence'
import { toast } from './store/ui'
import { checkPersistence } from './services/backup'
import { useStore } from './store'

const { recovered } = startPersistence()
if (recovered) toast('Los datos guardados estaban dañados y no se pudieron cargar. Se ha empezado con la app vacía.', { tone: 'error' })

// Ask the browser not to evict our data. Only requested once the user has started
// using the app; before that we just read the current state.
void checkPersistence(useStore.getState().settings.onboarded)
useStore.subscribe((s, prev) => {
  if (s.settings.onboarded && !prev.settings.onboarded) void checkPersistence(true)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
