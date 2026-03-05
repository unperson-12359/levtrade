import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useStore } from './store'

declare global {
  interface Window {
    __levtradeRuntimeHooksInstalled?: boolean
  }
}

if (typeof window !== 'undefined' && !window.__levtradeRuntimeHooksInstalled) {
  const pushRuntimeDiagnostic = useStore.getState().pushRuntimeDiagnostic

  window.addEventListener('error', (event) => {
    const message = event.error instanceof Error
      ? event.error.message
      : (event.message || 'Window error')
    const stack = event.error instanceof Error ? event.error.stack ?? null : null

    pushRuntimeDiagnostic({
      source: 'window.error',
      message,
      stack,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'Unhandled promise rejection'
    const stack = reason instanceof Error ? reason.stack ?? null : null

    pushRuntimeDiagnostic({
      source: 'window.unhandledrejection',
      message,
      stack,
    })
  })

  window.__levtradeRuntimeHooksInstalled = true
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
