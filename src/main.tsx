import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppRouter } from '@/app/AppRouter'
import { registerMediaCacheWorker } from '@/lib/media-cache'

import './index.css'

document.documentElement.classList.add('antialiased', 'dark')

async function renderApp() {
  // Remove the retired Cache API media layer before any grid requests. The CDN
  // already serves immutable assets, and Safari could retain broken variants in
  // the old cache indefinitely.
  await registerMediaCacheWorker()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppRouter />
    </StrictMode>,
  )
}

void renderApp()
