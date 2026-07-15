import { useSyncExternalStore } from 'react'

const subscribers = new Set<() => void>()
let listening = false

function getPageVisible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

function notifySubscribers() {
  for (const subscriber of subscribers) subscriber()
}

function startListening() {
  if (listening || typeof document === 'undefined' || typeof window === 'undefined') return
  listening = true
  document.addEventListener('visibilitychange', notifySubscribers)
  window.addEventListener('pageshow', notifySubscribers)
}

function stopListening() {
  if (!listening || subscribers.size > 0) return
  listening = false
  document.removeEventListener('visibilitychange', notifySubscribers)
  window.removeEventListener('pageshow', notifySubscribers)
}

function subscribe(subscriber: () => void) {
  subscribers.add(subscriber)
  startListening()
  return () => {
    subscribers.delete(subscriber)
    stopListening()
  }
}

export function usePageVisible() {
  return useSyncExternalStore(subscribe, getPageVisible, () => true)
}
