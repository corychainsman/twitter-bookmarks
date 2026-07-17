import { Workbox } from "workbox-window"

export const SERVICE_WORKER_UPDATE_EVENT = "elsewhere:service-worker-update"

export interface ServiceWorkerUpdateDetail {
  applyUpdate: () => void
  wasWaitingBeforeRegister: boolean
}

declare global {
  interface WindowEventMap {
    [SERVICE_WORKER_UPDATE_EVENT]: CustomEvent<ServiceWorkerUpdateDetail>
  }
}

let registrationStarted = false

const STARTUP_UPDATE_WINDOW_MS = 15_000

interface WaitingUpdateContext {
  elapsedSinceRegistrationMs: number
  wasWaitingBeforeRegister: boolean
}

export function shouldActivateWaitingUpdateOnStartup({
  elapsedSinceRegistrationMs,
  wasWaitingBeforeRegister,
}: WaitingUpdateContext) {
  return wasWaitingBeforeRegister || elapsedSinceRegistrationMs <= STARTUP_UPDATE_WINDOW_MS
}

function dismissPrompt(prompt: HTMLElement) {
  prompt.remove()
}

function showDefaultUpdatePrompt(detail: ServiceWorkerUpdateDetail) {
  if (document.querySelector('[data-service-worker-update="true"]')) return

  const prompt = document.createElement("aside")
  prompt.dataset.serviceWorkerUpdate = "true"
  prompt.setAttribute("role", "status")
  prompt.setAttribute("aria-label", "Application update available")
  Object.assign(prompt.style, {
    alignItems: "center",
    background: "hsl(228 12% 10%)",
    border: "1px solid hsl(228 8% 24%)",
    borderRadius: "0.75rem",
    bottom: "max(1rem, env(safe-area-inset-bottom))",
    color: "hsl(210 20% 96%)",
    display: "flex",
    font: "500 0.875rem/1.25rem Geist, ui-sans-serif, system-ui, sans-serif",
    gap: "0.75rem",
    flexWrap: "wrap",
    insetInline: "max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right))",
    justifyContent: "space-between",
    marginInline: "auto",
    maxWidth: "30rem",
    padding: "0.75rem",
    position: "fixed",
    zIndex: "2147483647",
  })

  const message = document.createElement("span")
  message.textContent = "A new version is ready."

  const actions = document.createElement("span")
  Object.assign(actions.style, { display: "flex", flexShrink: "0", gap: "0.5rem" })

  const laterButton = document.createElement("button")
  laterButton.type = "button"
  laterButton.textContent = "Later"
  laterButton.setAttribute("aria-label", "Use the current version until next visit")

  const refreshButton = document.createElement("button")
  refreshButton.type = "button"
  refreshButton.textContent = "Refresh"
  refreshButton.setAttribute("aria-label", "Refresh to use the new version")

  for (const button of [laterButton, refreshButton]) {
    Object.assign(button.style, {
      background: "transparent",
      border: "1px solid hsl(228 8% 28%)",
      borderRadius: "0.5rem",
      color: "inherit",
      cursor: "pointer",
      minHeight: "2.75rem",
      padding: "0.5rem 0.75rem",
    })
  }
  Object.assign(refreshButton.style, {
    background: "hsl(157 62% 54%)",
    borderColor: "hsl(157 62% 54%)",
    color: "hsl(160 40% 8%)",
  })

  laterButton.addEventListener("click", () => dismissPrompt(prompt), { once: true })
  refreshButton.addEventListener(
    "click",
    () => {
      refreshButton.disabled = true
      refreshButton.textContent = "Refreshing…"
      detail.applyUpdate()
    },
    { once: true },
  )

  actions.append(laterButton, refreshButton)
  prompt.append(message, actions)
  document.body.append(prompt)
}

function announceUpdate(detail: ServiceWorkerUpdateDetail) {
  const event = new CustomEvent<ServiceWorkerUpdateDetail>(SERVICE_WORKER_UPDATE_EVENT, {
    cancelable: true,
    detail,
  })

  const shouldShowDefaultPrompt = window.dispatchEvent(event)
  if (shouldShowDefaultPrompt) showDefaultUpdatePrompt(detail)
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || registrationStarted) return
  registrationStarted = true

  const workbox = new Workbox("/sw.js", { scope: "/" })
  const registrationStartedAt = performance.now()
  let reloadWhenControlling = false
  let reloadStarted = false
  let updateRequested = false
  let waitingWorkerAnnounced = false

  const applyUpdate = () => {
    if (updateRequested) return
    updateRequested = true
    reloadWhenControlling = true
    workbox.messageSkipWaiting()
  }

  workbox.addEventListener("waiting", (event) => {
    const wasWaitingBeforeRegister = event.wasWaitingBeforeRegister ?? false

    if (
      shouldActivateWaitingUpdateOnStartup({
        elapsedSinceRegistrationMs: performance.now() - registrationStartedAt,
        wasWaitingBeforeRegister,
      })
    ) {
      applyUpdate()
      return
    }

    if (waitingWorkerAnnounced) return
    waitingWorkerAnnounced = true
    announceUpdate({
      applyUpdate,
      wasWaitingBeforeRegister,
    })
  })

  workbox.addEventListener("controlling", () => {
    if (!reloadWhenControlling || reloadStarted) return
    reloadStarted = true
    window.location.reload()
  })

  void workbox.register().catch(() => {
    registrationStarted = false
  })
}
