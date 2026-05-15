import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'

import { router } from '@/app/router'
import { registerMediaCacheWorker } from '@/lib/media-cache'

import './index.css'
import 'yet-another-react-lightbox/styles.css'

document.documentElement.classList.add('antialiased', 'dark')
registerMediaCacheWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
