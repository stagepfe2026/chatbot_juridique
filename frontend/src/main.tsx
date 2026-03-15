import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SnackbarProvider } from './components/SnackbarProvider.tsx'

// Point d'entree React de l'application.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SnackbarProvider>
      <App />
    </SnackbarProvider>
  </StrictMode>,
)

