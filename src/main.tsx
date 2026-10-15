import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { startPersistence } from './services/persistence'
import { toast } from './store/ui'

const { recovered } = startPersistence()
if (recovered) toast('Los datos guardados estaban dañados y no se pudieron cargar. Se ha empezado con la app vacía.', { tone: 'error' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
