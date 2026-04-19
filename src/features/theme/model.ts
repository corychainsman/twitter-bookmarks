export const THEME_SCHEMA_VERSION = 1 as const
const LEGACY_DEFAULT_THEME_GEOMETRY = {
  tileRadius: 22,
  gridGapX: 16,
  gridGapY: 16,
} as const

export type ThemeHyperparameters = {
  density: number
  softness: number
  atmosphere: number
  typeScale: number
}

export type ThemeSemanticTokens = {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  border: string
  input: string
  ring: string
}

export type ThemeCanvasTokens = {
  top: string
  mid: string
  bottom: string
  glowA: string
  glowB: string
}

export type ThemeSurfaceTokens = {
  toolbar: string
  toolbarBorder: string
  control: string
  controlBorder: string
  panel: string
  panelBorder: string
  tile: string
  tileBorder: string
  tileHoverBorder: string
  mediaBadge: string
  mediaBadgeBorder: string
  lightbox: string
  lightboxBorder: string
}

export type ThemeEffects = {
  glowAOpacity: number
  glowBOpacity: number
  tileShadowColor: string
  tileShadowOpacity: number
  mediaScrimColor: string
  mediaScrimOpacity: number
  tileHoverOutlineColor: string
  tileHoverOutlineWidth: number
  tileHoverOutlineGap: number
  toolbarHoverOutlineWidth: number
  toolbarHoverOutlineGap: number
}

export type ThemeGeometry = {
  radius: number
  controlRadius: number
  panelRadius: number
  tileRadius: number
  gridGapX: number
  gridGapY: number
  shellPaddingX: number
  toolbarPaddingY: number
  toolbarBlur: number
}

export type ThemeTypography = {
  sans: string
  heading: string
  tileBodySize: number
  tileMetaSize: number
  lightboxBodySize: number
}

export type ThemeDocument = {
  version: typeof THEME_SCHEMA_VERSION
  id: string
  name: string
  updatedAt: string
  hyper: ThemeHyperparameters
  semantic: ThemeSemanticTokens
  canvas: ThemeCanvasTokens
  surfaces: ThemeSurfaceTokens
  effects: ThemeEffects
  geometry: ThemeGeometry
  typography: ThemeTypography
}

export type ThemeSnapshot = {
  activeTheme: ThemeDocument
  savedThemes: ThemeDocument[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function createThemeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `theme-${Date.now().toString(36)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function withDefaultText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function withDefaultNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function cloneTheme(theme: ThemeDocument): ThemeDocument {
  return {
    ...theme,
    hyper: { ...theme.hyper },
    semantic: { ...theme.semantic },
    canvas: { ...theme.canvas },
    surfaces: { ...theme.surfaces },
    effects: { ...theme.effects },
    geometry: { ...theme.geometry },
    typography: { ...theme.typography },
  }
}

export const DEFAULT_THEME: ThemeDocument = {
  version: THEME_SCHEMA_VERSION,
  id: 'default-theme',
  name: 'Midnight Contact Sheet',
  updatedAt: '2026-04-17T00:00:00.000Z',
  hyper: {
    density: 0,
    softness: 1,
    atmosphere: 1,
    typeScale: 1,
  },
  semantic: {
    background: 'rgb(11 13 18)',
    foreground: 'rgb(244 244 245)',
    card: 'rgb(17 19 25 / 0.92)',
    cardForeground: 'rgb(244 244 245)',
    popover: 'rgb(17 19 25 / 0.96)',
    popoverForeground: 'rgb(244 244 245)',
    primary: 'rgb(255 255 255)',
    primaryForeground: 'rgb(10 11 16)',
    secondary: 'rgb(255 255 255 / 0.08)',
    secondaryForeground: 'rgb(244 244 245)',
    muted: 'rgb(255 255 255 / 0.06)',
    mutedForeground: 'rgb(161 161 170)',
    accent: 'rgb(255 255 255 / 0.1)',
    accentForeground: 'rgb(244 244 245)',
    destructive: 'rgb(248 113 113)',
    border: 'rgb(255 255 255 / 0.1)',
    input: 'rgb(255 255 255 / 0.12)',
    ring: 'rgb(143 153 166 / 0.9)',
  },
  canvas: {
    top: 'rgb(8 9 13)',
    mid: 'rgb(11 13 18)',
    bottom: 'rgb(9 11 15)',
    glowA: 'rgb(112 138 255)',
    glowB: 'rgb(124 58 237)',
  },
  surfaces: {
    toolbar: 'rgb(9 11 16 / 0.86)',
    toolbarBorder: 'rgb(255 255 255 / 0.08)',
    control: 'rgb(255 255 255 / 0.035)',
    controlBorder: 'rgb(255 255 255 / 0.1)',
    panel: 'rgb(17 19 25 / 0.96)',
    panelBorder: 'rgb(255 255 255 / 0.1)',
    tile: 'rgb(255 255 255 / 0.03)',
    tileBorder: 'rgb(255 255 255 / 0.08)',
    tileHoverBorder: 'rgb(255 255 255 / 0.12)',
    mediaBadge: 'rgb(0 0 0 / 0.55)',
    mediaBadgeBorder: 'rgb(255 255 255 / 0.1)',
    lightbox: 'rgb(2 6 23 / 0.88)',
    lightboxBorder: 'rgb(255 255 255 / 0.2)',
  },
  effects: {
    glowAOpacity: 0.12,
    glowBOpacity: 0.08,
    tileShadowColor: 'rgb(255 255 255)',
    tileShadowOpacity: 0.02,
    mediaScrimColor: 'rgb(0 0 0)',
    mediaScrimOpacity: 0.85,
    tileHoverOutlineColor: 'rgb(255 255 255)',
    tileHoverOutlineWidth: 2,
    tileHoverOutlineGap: 2,
    toolbarHoverOutlineWidth: 2,
    toolbarHoverOutlineGap: 2,
  },
  geometry: {
    radius: 10,
    controlRadius: 999,
    panelRadius: 24,
    tileRadius: 2,
    gridGapX: 4,
    gridGapY: 4,
    shellPaddingX: 12,
    toolbarPaddingY: 12,
    toolbarBlur: 24,
  },
  typography: {
    sans: '"Geist Variable", "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif',
    heading: '"Geist Variable", "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif',
    tileBodySize: 13,
    tileMetaSize: 10,
    lightboxBodySize: 15,
  },
}

function migrateDefaultThemeGeometry(theme: ThemeDocument): ThemeDocument {
  if (
    theme.id !== DEFAULT_THEME.id ||
    theme.geometry.tileRadius !== LEGACY_DEFAULT_THEME_GEOMETRY.tileRadius ||
    theme.geometry.gridGapX !== LEGACY_DEFAULT_THEME_GEOMETRY.gridGapX ||
    theme.geometry.gridGapY !== LEGACY_DEFAULT_THEME_GEOMETRY.gridGapY
  ) {
    return theme
  }

  return {
    ...theme,
    geometry: {
      ...theme.geometry,
      tileRadius: DEFAULT_THEME.geometry.tileRadius,
      gridGapX: DEFAULT_THEME.geometry.gridGapX,
      gridGapY: DEFAULT_THEME.geometry.gridGapY,
    },
  }
}

export function createDefaultTheme(): ThemeDocument {
  return cloneTheme(DEFAULT_THEME)
}

export function createThemeDocument(name = 'Untitled Theme'): ThemeDocument {
  const theme = createDefaultTheme()
  theme.id = createThemeId()
  theme.name = name
  theme.updatedAt = nowIso()
  return theme
}

export function duplicateThemeDocument(
  theme: ThemeDocument,
  name = `${theme.name} Copy`,
): ThemeDocument {
  const duplicate = cloneTheme(theme)
  duplicate.id = createThemeId()
  duplicate.name = name
  duplicate.updatedAt = nowIso()
  return duplicate
}

export function normalizeThemeDocument(value: unknown): ThemeDocument {
  if (!isRecord(value)) {
    return createDefaultTheme()
  }

  const base = createDefaultTheme()
  const hyper = isRecord(value.hyper) ? value.hyper : {}
  const semantic = isRecord(value.semantic) ? value.semantic : {}
  const canvas = isRecord(value.canvas) ? value.canvas : {}
  const surfaces = isRecord(value.surfaces) ? value.surfaces : {}
  const effects = isRecord(value.effects) ? value.effects : {}
  const geometry = isRecord(value.geometry) ? value.geometry : {}
  const typography = isRecord(value.typography) ? value.typography : {}

  return migrateDefaultThemeGeometry({
    version: THEME_SCHEMA_VERSION,
    id: withDefaultText(value.id, base.id),
    name: withDefaultText(value.name, base.name),
    updatedAt: withDefaultText(value.updatedAt, nowIso()),
    hyper: {
      density: withDefaultNumber(hyper.density, base.hyper.density, -2, 2),
      softness: withDefaultNumber(hyper.softness, base.hyper.softness, 0.5, 2.2),
      atmosphere: withDefaultNumber(hyper.atmosphere, base.hyper.atmosphere, 0, 2.2),
      typeScale: withDefaultNumber(hyper.typeScale, base.hyper.typeScale, 0.75, 1.6),
    },
    semantic: {
      background: withDefaultText(semantic.background, base.semantic.background),
      foreground: withDefaultText(semantic.foreground, base.semantic.foreground),
      card: withDefaultText(semantic.card, base.semantic.card),
      cardForeground: withDefaultText(semantic.cardForeground, base.semantic.cardForeground),
      popover: withDefaultText(semantic.popover, base.semantic.popover),
      popoverForeground: withDefaultText(semantic.popoverForeground, base.semantic.popoverForeground),
      primary: withDefaultText(semantic.primary, base.semantic.primary),
      primaryForeground: withDefaultText(semantic.primaryForeground, base.semantic.primaryForeground),
      secondary: withDefaultText(semantic.secondary, base.semantic.secondary),
      secondaryForeground: withDefaultText(semantic.secondaryForeground, base.semantic.secondaryForeground),
      muted: withDefaultText(semantic.muted, base.semantic.muted),
      mutedForeground: withDefaultText(semantic.mutedForeground, base.semantic.mutedForeground),
      accent: withDefaultText(semantic.accent, base.semantic.accent),
      accentForeground: withDefaultText(semantic.accentForeground, base.semantic.accentForeground),
      destructive: withDefaultText(semantic.destructive, base.semantic.destructive),
      border: withDefaultText(semantic.border, base.semantic.border),
      input: withDefaultText(semantic.input, base.semantic.input),
      ring: withDefaultText(semantic.ring, base.semantic.ring),
    },
    canvas: {
      top: withDefaultText(canvas.top, base.canvas.top),
      mid: withDefaultText(canvas.mid, base.canvas.mid),
      bottom: withDefaultText(canvas.bottom, base.canvas.bottom),
      glowA: withDefaultText(canvas.glowA, base.canvas.glowA),
      glowB: withDefaultText(canvas.glowB, base.canvas.glowB),
    },
    surfaces: {
      toolbar: withDefaultText(surfaces.toolbar, base.surfaces.toolbar),
      toolbarBorder: withDefaultText(surfaces.toolbarBorder, base.surfaces.toolbarBorder),
      control: withDefaultText(surfaces.control, base.surfaces.control),
      controlBorder: withDefaultText(surfaces.controlBorder, base.surfaces.controlBorder),
      panel: withDefaultText(surfaces.panel, base.surfaces.panel),
      panelBorder: withDefaultText(surfaces.panelBorder, base.surfaces.panelBorder),
      tile: withDefaultText(surfaces.tile, base.surfaces.tile),
      tileBorder: withDefaultText(surfaces.tileBorder, base.surfaces.tileBorder),
      tileHoverBorder: withDefaultText(surfaces.tileHoverBorder, base.surfaces.tileHoverBorder),
      mediaBadge: withDefaultText(surfaces.mediaBadge, base.surfaces.mediaBadge),
      mediaBadgeBorder: withDefaultText(surfaces.mediaBadgeBorder, base.surfaces.mediaBadgeBorder),
      lightbox: withDefaultText(surfaces.lightbox, base.surfaces.lightbox),
      lightboxBorder: withDefaultText(surfaces.lightboxBorder, base.surfaces.lightboxBorder),
    },
    effects: {
      glowAOpacity: withDefaultNumber(effects.glowAOpacity, base.effects.glowAOpacity, 0, 1),
      glowBOpacity: withDefaultNumber(effects.glowBOpacity, base.effects.glowBOpacity, 0, 1),
      tileShadowColor: withDefaultText(effects.tileShadowColor, base.effects.tileShadowColor),
      tileShadowOpacity: withDefaultNumber(
        effects.tileShadowOpacity,
        base.effects.tileShadowOpacity,
        0,
        1,
      ),
      mediaScrimColor: withDefaultText(effects.mediaScrimColor, base.effects.mediaScrimColor),
      mediaScrimOpacity: withDefaultNumber(
        effects.mediaScrimOpacity,
        base.effects.mediaScrimOpacity,
        0,
        1,
      ),
      tileHoverOutlineColor: withDefaultText(
        effects.tileHoverOutlineColor,
        base.effects.tileHoverOutlineColor,
      ),
      tileHoverOutlineWidth: withDefaultNumber(
        effects.tileHoverOutlineWidth,
        base.effects.tileHoverOutlineWidth,
        0,
        16,
      ),
      tileHoverOutlineGap: withDefaultNumber(
        effects.tileHoverOutlineGap,
        base.effects.tileHoverOutlineGap,
        0,
        24,
      ),
      toolbarHoverOutlineWidth: withDefaultNumber(
        effects.toolbarHoverOutlineWidth,
        base.effects.toolbarHoverOutlineWidth,
        0,
        16,
      ),
      toolbarHoverOutlineGap: withDefaultNumber(
        effects.toolbarHoverOutlineGap,
        base.effects.toolbarHoverOutlineGap,
        0,
        24,
      ),
    },
    geometry: {
      radius: withDefaultNumber(geometry.radius, base.geometry.radius, 2, 40),
      controlRadius: withDefaultNumber(geometry.controlRadius, base.geometry.controlRadius, 2, 999),
      panelRadius: withDefaultNumber(geometry.panelRadius, base.geometry.panelRadius, 2, 80),
      tileRadius: withDefaultNumber(geometry.tileRadius, base.geometry.tileRadius, 2, 80),
      gridGapX: withDefaultNumber(geometry.gridGapX, base.geometry.gridGapX, 0, 80),
      gridGapY: withDefaultNumber(geometry.gridGapY, base.geometry.gridGapY, 0, 80),
      shellPaddingX: withDefaultNumber(geometry.shellPaddingX, base.geometry.shellPaddingX, 0, 64),
      toolbarPaddingY: withDefaultNumber(
        geometry.toolbarPaddingY,
        base.geometry.toolbarPaddingY,
        0,
        32,
      ),
      toolbarBlur: withDefaultNumber(geometry.toolbarBlur, base.geometry.toolbarBlur, 0, 80),
    },
    typography: {
      sans: withDefaultText(typography.sans, base.typography.sans),
      heading: withDefaultText(typography.heading, base.typography.heading),
      tileBodySize: withDefaultNumber(
        typography.tileBodySize,
        base.typography.tileBodySize,
        10,
        28,
      ),
      tileMetaSize: withDefaultNumber(
        typography.tileMetaSize,
        base.typography.tileMetaSize,
        8,
        24,
      ),
      lightboxBodySize: withDefaultNumber(
        typography.lightboxBodySize,
        base.typography.lightboxBodySize,
        12,
        30,
      ),
    },
  })
}

function px(value: number): string {
  return `${value.toFixed(2)}px`
}

function remFromPx(value: number): string {
  return `${(value / 16).toFixed(4)}rem`
}

function scaleDensity(value: number, density: number): number {
  return value * clamp(1 - density * 0.18, 0.45, 1.75)
}

function scaleSoftness(value: number, softness: number): number {
  return value * softness
}

function scaleAtmosphere(value: number, atmosphere: number): number {
  return value * clamp(atmosphere, 0, 2.2)
}

function scaleType(value: number, typeScale: number): number {
  return value * clamp(typeScale, 0.75, 1.6)
}

function mixWithTransparency(color: string, opacity: number): string {
  const percentage = clamp(opacity, 0, 1) * 100
  return `color-mix(in srgb, ${color} ${percentage.toFixed(2)}%, transparent)`
}

export function deriveThemeVariables(theme: ThemeDocument): Record<string, string> {
  const normalized = normalizeThemeDocument(theme)
  const density = normalized.hyper.density
  const softness = normalized.hyper.softness
  const atmosphere = normalized.hyper.atmosphere
  const typeScale = normalized.hyper.typeScale

  return {
    '--background': normalized.semantic.background,
    '--foreground': normalized.semantic.foreground,
    '--card': normalized.semantic.card,
    '--card-foreground': normalized.semantic.cardForeground,
    '--popover': normalized.semantic.popover,
    '--popover-foreground': normalized.semantic.popoverForeground,
    '--primary': normalized.semantic.primary,
    '--primary-foreground': normalized.semantic.primaryForeground,
    '--secondary': normalized.semantic.secondary,
    '--secondary-foreground': normalized.semantic.secondaryForeground,
    '--muted': normalized.semantic.muted,
    '--muted-foreground': normalized.semantic.mutedForeground,
    '--accent': normalized.semantic.accent,
    '--accent-foreground': normalized.semantic.accentForeground,
    '--destructive': normalized.semantic.destructive,
    '--border': normalized.semantic.border,
    '--input': normalized.semantic.input,
    '--ring': normalized.semantic.ring,
    '--sidebar': normalized.semantic.card,
    '--sidebar-foreground': normalized.semantic.foreground,
    '--sidebar-primary': normalized.semantic.primary,
    '--sidebar-primary-foreground': normalized.semantic.primaryForeground,
    '--sidebar-accent': normalized.semantic.accent,
    '--sidebar-accent-foreground': normalized.semantic.accentForeground,
    '--sidebar-border': normalized.semantic.border,
    '--sidebar-ring': normalized.semantic.ring,
    '--radius': remFromPx(scaleSoftness(normalized.geometry.radius, softness)),
    '--app-font-sans': normalized.typography.sans,
    '--app-font-heading': normalized.typography.heading,
    '--app-canvas-top': normalized.canvas.top,
    '--app-canvas-mid': normalized.canvas.mid,
    '--app-canvas-bottom': normalized.canvas.bottom,
    '--app-canvas-glow-a': mixWithTransparency(
      normalized.canvas.glowA,
      scaleAtmosphere(normalized.effects.glowAOpacity, atmosphere),
    ),
    '--app-canvas-glow-b': mixWithTransparency(
      normalized.canvas.glowB,
      scaleAtmosphere(normalized.effects.glowBOpacity, atmosphere),
    ),
    '--app-toolbar-surface': normalized.surfaces.toolbar,
    '--app-toolbar-border': normalized.surfaces.toolbarBorder,
    '--app-control-surface': normalized.surfaces.control,
    '--app-control-border': normalized.surfaces.controlBorder,
    '--app-panel-surface': normalized.surfaces.panel,
    '--app-panel-border': normalized.surfaces.panelBorder,
    '--app-tile-surface': normalized.surfaces.tile,
    '--app-tile-border': normalized.surfaces.tileBorder,
    '--app-tile-hover-border': normalized.surfaces.tileHoverBorder,
    '--app-media-badge-surface': normalized.surfaces.mediaBadge,
    '--app-media-badge-border': normalized.surfaces.mediaBadgeBorder,
    '--app-lightbox-surface': normalized.surfaces.lightbox,
    '--app-lightbox-border': normalized.surfaces.lightboxBorder,
    '--app-tile-shadow-color': mixWithTransparency(
      normalized.effects.tileShadowColor,
      normalized.effects.tileShadowOpacity,
    ),
    '--app-media-scrim': mixWithTransparency(
      normalized.effects.mediaScrimColor,
      normalized.effects.mediaScrimOpacity,
    ),
    '--app-tile-hover-outline-color': normalized.effects.tileHoverOutlineColor,
    '--app-tile-hover-outline-width': px(normalized.effects.tileHoverOutlineWidth),
    '--app-tile-hover-outline-gap': px(normalized.effects.tileHoverOutlineGap),
    '--app-toolbar-hover-outline-width': px(normalized.effects.toolbarHoverOutlineWidth),
    '--app-toolbar-hover-outline-gap': px(normalized.effects.toolbarHoverOutlineGap),
    '--app-control-radius': px(scaleSoftness(normalized.geometry.controlRadius, softness)),
    '--app-panel-radius': px(scaleSoftness(normalized.geometry.panelRadius, softness)),
    '--app-tile-radius': px(scaleSoftness(normalized.geometry.tileRadius, softness)),
    '--app-grid-gap-x': px(scaleDensity(normalized.geometry.gridGapX, density)),
    '--app-grid-gap-y': px(scaleDensity(normalized.geometry.gridGapY, density)),
    '--app-shell-padding-x': px(scaleDensity(normalized.geometry.shellPaddingX, density)),
    '--app-toolbar-padding-y': px(scaleDensity(normalized.geometry.toolbarPaddingY, density)),
    '--app-toolbar-blur': px(scaleAtmosphere(normalized.geometry.toolbarBlur, atmosphere)),
    '--app-tile-body-size': px(scaleType(normalized.typography.tileBodySize, typeScale)),
    '--app-tile-meta-size': px(scaleType(normalized.typography.tileMetaSize, typeScale)),
    '--app-lightbox-body-size': px(scaleType(normalized.typography.lightboxBodySize, typeScale)),
  }
}

export function serializeThemeDocument(theme: ThemeDocument): string {
  return JSON.stringify(normalizeThemeDocument(theme), null, 2)
}

export function parseThemeDocumentJson(source: string): ThemeDocument {
  return normalizeThemeDocument(JSON.parse(source))
}
