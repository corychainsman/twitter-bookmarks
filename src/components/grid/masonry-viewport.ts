export function resolveMasonryViewportTopInset(input: {
  containerTop: number
  toolbarBottom: number
}): number {
  return Math.max(0, input.toolbarBottom - Math.max(input.containerTop, 0))
}

