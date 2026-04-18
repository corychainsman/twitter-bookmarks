export const sessionStorageStore = {
  get(key: string): string | null {
    if (typeof window === 'undefined') {
      return null
    }

    try {
      return window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.sessionStorage.setItem(key, value)
    } catch {
      // Ignore storage failures so the app still works without session storage.
    }
  },
  delete(key: string): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.sessionStorage.removeItem(key)
    } catch {
      // Ignore storage failures so the app still works without session storage.
    }
  },
}

export const localStorageStore = {
  get(key: string): string | null {
    if (typeof window === 'undefined') {
      return null
    }

    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(key, value)
    } catch {
      // Ignore storage failures so the app still works without local storage.
    }
  },
  delete(key: string): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.removeItem(key)
    } catch {
      // Ignore storage failures so the app still works without local storage.
    }
  },
}
