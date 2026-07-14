import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppRouter } from '@/app/AppRouter'
import { registerMediaCacheWorker } from '@/lib/media-cache'

import './index.css'

const MEDIA_CACHE_WORKER_REGISTRATION_DELAY_MS = 12_000

document.documentElement.classList.add('antialiased', 'dark')
window.setTimeout(registerMediaCacheWorker, MEDIA_CACHE_WORKER_REGISTRATION_DELAY_MS)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
)
