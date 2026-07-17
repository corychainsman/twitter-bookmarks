import { useEffect, useState } from "react"

import { ambientAutoplayAllowed } from "./autoplay-policy"

interface NetworkInformationLike extends EventTarget {
  saveData?: boolean
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformationLike
}

function readPreferences() {
  if (typeof window === "undefined") {
    return { reducedMotion: false, saveData: false }
  }

  return {
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: Boolean((navigator as NavigatorWithConnection).connection?.saveData),
  }
}

export function useAutoplayPreferences() {
  const [preferences, setPreferences] = useState(readPreferences)

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const connection = (navigator as NavigatorWithConnection).connection
    const update = () => setPreferences(readPreferences())

    motionQuery.addEventListener("change", update)
    connection?.addEventListener("change", update)

    return () => {
      motionQuery.removeEventListener("change", update)
      connection?.removeEventListener("change", update)
    }
  }, [])

  return {
    ...preferences,
    ambientAllowed: ambientAutoplayAllowed(preferences),
  }
}
