export interface MotionAndDataPreferences {
  reducedMotion: boolean
  saveData: boolean
}

export function ambientAutoplayAllowed({
  reducedMotion,
  saveData,
}: MotionAndDataPreferences) {
  return !reducedMotion && !saveData
}

export function shouldPlayForVisibility(
  visibleRatio: number,
  wasPlaying: boolean,
) {
  if (wasPlaying) return visibleRatio >= 0.05
  return visibleRatio >= 0.1
}
