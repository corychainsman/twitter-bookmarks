import * as React from 'react'
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RefreshCcwIcon,
  SaveIcon,
  UploadIcon,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  applySavedTheme,
  deleteSavedTheme,
  replaceActiveTheme,
  resetActiveTheme,
  saveActiveTheme,
  saveActiveThemeCopy,
  useThemeSnapshot,
} from '@/features/theme/store'
import {
  parseThemeDocumentJson,
  serializeThemeDocument,
  type ThemeCanvasTokens,
  type ThemeDocument,
  type ThemeEffects,
  type ThemeGeometry,
  type ThemeHyperparameters,
  type ThemeSemanticTokens,
  type ThemeSurfaceTokens,
  type ThemeTypography,
} from '@/features/theme/model'

type NumericFieldDefinition = {
  key: string
  label: string
  min?: number
  max?: number
  step?: number
}

type TextFieldDefinition = {
  key: string
  label: string
}

function clamp(value: number, min?: number, max?: number): number {
  let next = value

  if (typeof min === 'number') {
    next = Math.max(min, next)
  }

  if (typeof max === 'number') {
    next = Math.min(max, next)
  }

  return next
}

function roundToStep(value: number, step: number): number {
  const precision = step.toString().includes('.') ? step.toString().split('.')[1]?.length ?? 0 : 0
  return Number(value.toFixed(precision))
}

function cssColorToHex(value: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const probe = document.createElement('span')
  probe.style.color = ''
  probe.style.color = value
  if (probe.style.color === '') {
    return null
  }

  probe.style.display = 'none'
  document.body.appendChild(probe)
  const computed = window.getComputedStyle(probe).color
  document.body.removeChild(probe)

  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!match) {
    return null
  }

  const [red, green, blue] = match.slice(1, 4).map((channel) =>
    Number(channel).toString(16).padStart(2, '0'),
  )

  return `#${red}${green}${blue}`
}

function getPrimaryFontFamily(stack: string): string {
  const [primary = ''] = stack.split(',')
  return primary.trim().replace(/^['"]|['"]$/g, '')
}

function isLocalFontAvailable(stack: string): boolean | null {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return null
  }

  const primaryFamily = getPrimaryFontFamily(stack)
  if (primaryFamily.length === 0) {
    return null
  }

  try {
    return document.fonts.check(`16px "${primaryFamily}"`)
  } catch {
    return null
  }
}

const hyperFields: Array<NumericFieldDefinition & { key: keyof ThemeHyperparameters }> = [
  { key: 'density', label: 'Density', min: -2, max: 2, step: 0.1 },
  { key: 'softness', label: 'Softness', min: 0.5, max: 2.2, step: 0.05 },
  { key: 'atmosphere', label: 'Atmosphere', min: 0, max: 2.2, step: 0.05 },
  { key: 'typeScale', label: 'Type Scale', min: 0.75, max: 1.6, step: 0.05 },
]

const semanticFields: Array<TextFieldDefinition & { key: keyof ThemeSemanticTokens }> = [
  { key: 'background', label: 'Background' },
  { key: 'foreground', label: 'Foreground' },
  { key: 'card', label: 'Card' },
  { key: 'cardForeground', label: 'Card Foreground' },
  { key: 'popover', label: 'Popover' },
  { key: 'popoverForeground', label: 'Popover Foreground' },
  { key: 'primary', label: 'Primary' },
  { key: 'primaryForeground', label: 'Primary Foreground' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'secondaryForeground', label: 'Secondary Foreground' },
  { key: 'muted', label: 'Muted' },
  { key: 'mutedForeground', label: 'Muted Foreground' },
  { key: 'accent', label: 'Accent' },
  { key: 'accentForeground', label: 'Accent Foreground' },
  { key: 'destructive', label: 'Destructive' },
  { key: 'border', label: 'Border' },
  { key: 'input', label: 'Input' },
  { key: 'ring', label: 'Ring' },
]

const canvasTextFields: Array<TextFieldDefinition & { key: keyof ThemeCanvasTokens }> = [
  { key: 'top', label: 'Canvas Top' },
  { key: 'mid', label: 'Canvas Mid' },
  { key: 'bottom', label: 'Canvas Bottom' },
  { key: 'glowA', label: 'Glow A' },
  { key: 'glowB', label: 'Glow B' },
]

const canvasNumberFields: Array<NumericFieldDefinition & { key: keyof ThemeEffects }> = [
  { key: 'glowAOpacity', label: 'Glow A Opacity', min: 0, max: 1, step: 0.01 },
  { key: 'glowBOpacity', label: 'Glow B Opacity', min: 0, max: 1, step: 0.01 },
]

const surfaceFields: Array<TextFieldDefinition & { key: keyof ThemeSurfaceTokens }> = [
  { key: 'toolbar', label: 'Toolbar Surface' },
  { key: 'toolbarBorder', label: 'Toolbar Border' },
  { key: 'control', label: 'Control Surface' },
  { key: 'controlBorder', label: 'Control Border' },
  { key: 'panel', label: 'Panel Surface' },
  { key: 'panelBorder', label: 'Panel Border' },
  { key: 'tile', label: 'Tile Surface' },
  { key: 'tileBorder', label: 'Tile Border' },
  { key: 'tileHoverBorder', label: 'Tile Hover Border' },
  { key: 'mediaBadge', label: 'Media Tag Surface' },
  { key: 'mediaBadgeBorder', label: 'Media Tag Border' },
  { key: 'lightbox', label: 'Lightbox Surface' },
  { key: 'lightboxBorder', label: 'Lightbox Border' },
]

const effectTextFields: Array<TextFieldDefinition & { key: keyof ThemeEffects }> = [
  { key: 'tileShadowColor', label: 'Tile Shadow Color' },
  { key: 'mediaScrimColor', label: 'Media Scrim Color' },
  { key: 'tileHoverOutlineColor', label: 'Tile Hover Outline Color' },
]

const effectNumberFields: Array<NumericFieldDefinition & { key: keyof ThemeEffects }> = [
  { key: 'tileShadowOpacity', label: 'Tile Shadow Opacity', min: 0, max: 1, step: 0.01 },
  { key: 'mediaScrimOpacity', label: 'Media Scrim Opacity', min: 0, max: 1, step: 0.01 },
  { key: 'tileHoverOutlineWidth', label: 'Tile Hover Outline Width', min: 0, max: 16, step: 1 },
  { key: 'tileHoverOutlineGap', label: 'Tile Hover Outline Gap', min: 0, max: 24, step: 1 },
  { key: 'toolbarHoverOutlineWidth', label: 'Toolbar Hover Outline Width', min: 0, max: 16, step: 1 },
  { key: 'toolbarHoverOutlineGap', label: 'Toolbar Hover Outline Gap', min: 0, max: 24, step: 1 },
]

const geometryFields: Array<NumericFieldDefinition & { key: keyof ThemeGeometry }> = [
  { key: 'radius', label: 'Base Radius', min: 2, max: 40, step: 1 },
  { key: 'controlRadius', label: 'Control Radius', min: 2, max: 999, step: 1 },
  { key: 'panelRadius', label: 'Panel Radius', min: 2, max: 80, step: 1 },
  { key: 'tileRadius', label: 'Tile Radius', min: 2, max: 80, step: 1 },
  { key: 'gridGapX', label: 'Grid Gap X', min: 0, max: 80, step: 1 },
  { key: 'gridGapY', label: 'Grid Gap Y', min: 0, max: 80, step: 1 },
  { key: 'shellPaddingX', label: 'Shell Padding X', min: 0, max: 64, step: 1 },
  { key: 'toolbarPaddingY', label: 'Toolbar Padding Y', min: 0, max: 32, step: 1 },
  { key: 'toolbarBlur', label: 'Toolbar Blur', min: 0, max: 80, step: 1 },
]

const typographyTextFields: Array<TextFieldDefinition & { key: keyof ThemeTypography }> = [
  { key: 'sans', label: 'Sans Stack' },
  { key: 'heading', label: 'Heading Stack' },
]

const typographyNumberFields: Array<NumericFieldDefinition & { key: keyof ThemeTypography }> = [
  { key: 'tileBodySize', label: 'Tile Body Size', min: 10, max: 28, step: 0.5 },
  { key: 'tileMetaSize', label: 'Tile Meta Size', min: 8, max: 24, step: 0.5 },
  { key: 'lightboxBodySize', label: 'Lightbox Body Size', min: 12, max: 30, step: 0.5 },
]

function slugifyThemeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'theme'
}

function ThemeNumberInput({
  id,
  label,
  value,
  min,
  max,
  step,
  description,
  onCommit,
}: {
  id: string
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  description?: string
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = React.useState(() => String(value))
  const [isEditing, setIsEditing] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const displayValue = isEditing ? draft : String(value)

  const focusAndSelect = React.useCallback(() => {
    const input = inputRef.current
    if (!input) {
      return
    }

    input.focus({ preventScroll: true })
    input.select()
  }, [])

  const nudgeValue = React.useCallback(
    (direction: 1 | -1, isLargeStep: boolean) => {
      const base = Number.isFinite(Number(displayValue)) ? Number(displayValue) : value
      const baseStep = step ?? 1
      const nextStep = isLargeStep ? baseStep * 10 : baseStep
      const nextValue = roundToStep(
        clamp(base + direction * nextStep, min, max),
        baseStep,
      )
      setIsEditing(true)
      setDraft(String(nextValue))
      onCommit(nextValue)
    },
    [displayValue, max, min, onCommit, step, value],
  )

  const commit = React.useCallback(
    (raw: string) => {
      const parsed = Number(raw)
      if (!Number.isFinite(parsed)) {
        setDraft(String(value))
        return
      }

      onCommit(parsed)
    },
    [onCommit, value],
  )

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        ref={inputRef}
        type="number"
        value={displayValue}
        min={min}
        max={max}
        step={step}
        onFocus={(event) => {
          setIsEditing(true)
          setDraft(String(value))
          event.currentTarget.select()
        }}
        onBlur={() => {
          commit(displayValue)
          setIsEditing(false)
        }}
        onChange={(event) => {
          const nextDraft = event.target.value
          setIsEditing(true)
          setDraft(nextDraft)
          if (nextDraft.length > 0 && Number.isFinite(Number(nextDraft))) {
            onCommit(Number(nextDraft))
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            nudgeValue(1, event.shiftKey)
            window.requestAnimationFrame(focusAndSelect)
            return
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            nudgeValue(-1, event.shiftKey)
            window.requestAnimationFrame(focusAndSelect)
            return
          }

          if (event.key === 'Enter') {
            event.preventDefault()
            commit(displayValue)
          }

          if (event.key === 'Escape') {
            event.preventDefault()
            setDraft(String(value))
            setIsEditing(false)
            event.currentTarget.blur()
          }
        }}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  )
}

function ThemeColorInput({
  id,
  label,
  value,
  onCommit,
}: {
  id: string
  label: string
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = React.useState(() => value)
  const [isEditing, setIsEditing] = React.useState(false)
  const pickerRef = React.useRef<HTMLInputElement | null>(null)
  const displayValue = isEditing ? draft : value

  const openPicker = React.useCallback(() => {
    if (pickerRef.current) {
      const pickerHex = cssColorToHex(displayValue) ?? cssColorToHex(value) ?? '#ffffff'
      pickerRef.current.value = pickerHex
      pickerRef.current.click()
    }
  }, [displayValue, value])

  const commit = React.useCallback(() => {
    const nextValue = draft.trim()
    if (nextValue.length === 0 || nextValue === value) {
      setDraft(value)
      return
    }

    onCommit(nextValue)
  }, [draft, onCommit, value])

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Open color picker for ${label}`}
          className="app-control size-9 shrink-0 p-1"
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault()
              openPicker()
            }
          }}
        >
          <span
            className="block size-full rounded-md border border-border"
            style={{ background: displayValue }}
          />
        </button>
        <Input
          id={id}
          value={displayValue}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onFocus={() => {
            setIsEditing(true)
            setDraft(value)
          }}
          onBlur={() => {
            commit()
            setIsEditing(false)
          }}
          onChange={(event) => {
            setIsEditing(true)
            setDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === ' ') {
              event.preventDefault()
              openPicker()
              return
            }

            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }

            if (event.key === 'Escape') {
              event.preventDefault()
              setDraft(value)
              setIsEditing(false)
              event.currentTarget.blur()
            }
          }}
        />
        <input
          ref={pickerRef}
          type="color"
          tabIndex={-1}
          className="sr-only"
          onChange={(event) => {
            setDraft(event.target.value)
            setIsEditing(false)
            onCommit(event.target.value)
          }}
        />
      </div>
      <FieldDescription>Press Space to open the native color picker.</FieldDescription>
    </Field>
  )
}

function ThemeFontInput({
  id,
  label,
  value,
  onCommit,
}: {
  id: string
  label: string
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = React.useState(() => value)
  const [isEditing, setIsEditing] = React.useState(false)
  const displayValue = isEditing ? draft : value
  const availability = isLocalFontAvailable(displayValue)

  const commit = React.useCallback(() => {
    const nextValue = draft.trim()
    if (nextValue.length === 0 || nextValue === value) {
      setDraft(value)
      return
    }

    onCommit(nextValue)
  }, [draft, onCommit, value])

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={displayValue}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onFocus={() => {
          setIsEditing(true)
          setDraft(value)
        }}
        onBlur={() => {
          commit()
          setIsEditing(false)
        }}
        onChange={(event) => {
          setIsEditing(true)
          setDraft(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }

          if (event.key === 'Escape') {
            event.preventDefault()
            setDraft(value)
            setIsEditing(false)
            event.currentTarget.blur()
          }
        }}
      />
      <div
        className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
        style={{ fontFamily: displayValue }}
      >
        Sphinx of black quartz, judge my vow.
      </div>
      <FieldDescription>
        {availability === null
          ? 'Type any installed font family or stack. Browsers cannot reliably enumerate Font Book.'
          : availability
            ? 'Primary family is available on this machine.'
            : 'Primary family is not currently available. The browser will fall back.'}
      </FieldDescription>
    </Field>
  )
}

function ThemeSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card className="app-panel">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function ThemeStudio() {
  const { activeTheme, savedThemes } = useThemeSnapshot()
  const serializedTheme = React.useMemo(
    () => serializeThemeDocument(activeTheme),
    [activeTheme],
  )
  const [copyLabel, setCopyLabel] = React.useState('Copy JSON')
  const [importDraft, setImportDraft] = React.useState('')
  const [importError, setImportError] = React.useState<string | null>(null)
  const [importNotice, setImportNotice] = React.useState<string | null>(null)
  const importInputRef = React.useRef<HTMLInputElement | null>(null)

  const updateTheme = (updater: (theme: ThemeDocument) => ThemeDocument) => {
    replaceActiveTheme(updater(activeTheme))
  }

  const updateHyper = (key: keyof ThemeHyperparameters, value: number) => {
    updateTheme((theme) => ({
      ...theme,
      hyper: {
        ...theme.hyper,
        [key]: value,
      },
    }))
  }

  const updateSemantic = (key: keyof ThemeSemanticTokens, value: string) => {
    updateTheme((theme) => ({
      ...theme,
      semantic: {
        ...theme.semantic,
        [key]: value,
      },
    }))
  }

  const updateCanvas = (key: keyof ThemeCanvasTokens, value: string) => {
    updateTheme((theme) => ({
      ...theme,
      canvas: {
        ...theme.canvas,
        [key]: value,
      },
    }))
  }

  const updateSurfaces = (key: keyof ThemeSurfaceTokens, value: string) => {
    updateTheme((theme) => ({
      ...theme,
      surfaces: {
        ...theme.surfaces,
        [key]: value,
      },
    }))
  }

  const updateEffectsNumber = (key: keyof ThemeEffects, value: number) => {
    updateTheme((theme) => ({
      ...theme,
      effects: {
        ...theme.effects,
        [key]: value,
      },
    }))
  }

  const updateEffectsText = (key: keyof ThemeEffects, value: string) => {
    updateTheme((theme) => ({
      ...theme,
      effects: {
        ...theme.effects,
        [key]: value,
      },
    }))
  }

  const updateGeometry = (key: keyof ThemeGeometry, value: number) => {
    updateTheme((theme) => ({
      ...theme,
      geometry: {
        ...theme.geometry,
        [key]: value,
      },
    }))
  }

  const updateTypographyText = (key: keyof ThemeTypography, value: string) => {
    updateTheme((theme) => ({
      ...theme,
      typography: {
        ...theme.typography,
        [key]: value,
      },
    }))
  }

  const updateTypographyNumber = (key: keyof ThemeTypography, value: number) => {
    updateTheme((theme) => ({
      ...theme,
      typography: {
        ...theme.typography,
        [key]: value,
      },
    }))
  }

  const copyThemeJson = async () => {
    if (!navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(serializedTheme)
    setCopyLabel('Copied')
    window.setTimeout(() => {
      setCopyLabel('Copy JSON')
    }, 1200)
  }

  const downloadThemeJson = () => {
    const blob = new Blob([serializedTheme], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${slugifyThemeName(activeTheme.name)}.theme.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const applyImportedTheme = React.useCallback(
    (source: string, saveToLibrary: boolean) => {
      try {
        const importedTheme = parseThemeDocumentJson(source)
        replaceActiveTheme(importedTheme)
        if (saveToLibrary) {
          saveActiveTheme()
        }
        setImportDraft(serializeThemeDocument(importedTheme))
        setImportError(null)
        setImportNotice(saveToLibrary ? 'Theme imported and saved.' : 'Theme imported.')
      } catch {
        setImportNotice(null)
        setImportError('Theme JSON could not be parsed.')
      }
    },
    [],
  )

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const text = await file.text()
    setImportDraft(text)
    applyImportedTheme(text, true)
    event.target.value = ''
  }

  return (
    <div className="app-studio-shell">
      <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-6">
        <Card className="app-panel">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="flex items-center gap-2">
                <CardTitle>Theme Studio</CardTitle>
                <Badge variant="outline">{savedThemes.length} saved</Badge>
              </div>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="theme-name">Theme Name</FieldLabel>
                  <Input
                    id="theme-name"
                    value={activeTheme.name}
                    onChange={(event) =>
                      updateTheme((theme) => ({
                        ...theme,
                        name: event.target.value,
                      }))
                    }
                  />
                </Field>
              </FieldGroup>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={saveActiveTheme}>
                <SaveIcon data-icon="inline-start" />
                Save
              </Button>
              <Button type="button" variant="outline" onClick={saveActiveThemeCopy}>
                <SaveIcon data-icon="inline-start" />
                Save Copy
              </Button>
              <Button type="button" variant="outline" onClick={resetActiveTheme}>
                <RefreshCcwIcon data-icon="inline-start" />
                Reset
              </Button>
              <Button type="button" variant="outline" onClick={copyThemeJson}>
                <CopyIcon data-icon="inline-start" />
                {copyLabel}
              </Button>
              <Button type="button" variant="outline" onClick={downloadThemeJson}>
                <DownloadIcon data-icon="inline-start" />
                Download
              </Button>
              <Button asChild variant="outline">
                <a href="/" target="_blank" rel="noreferrer">
                  <ExternalLinkIcon data-icon="inline-start" />
                  Open Grid
                </a>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_24rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <ThemeSection
              title="Import Theme"
              description="Paste a theme blob or import a saved .theme.json file from another machine."
            >
              <FieldGroup className="gap-4">
                <Field data-invalid={importError ? true : undefined}>
                  <FieldLabel htmlFor="theme-import-json">Theme JSON</FieldLabel>
                  <Textarea
                    id="theme-import-json"
                    value={importDraft}
                    placeholder='Paste a theme JSON blob here.'
                    aria-invalid={importError ? true : undefined}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    onChange={(event) => {
                      setImportDraft(event.target.value)
                      if (importNotice) {
                        setImportNotice(null)
                      }
                      if (importError) {
                        setImportError(null)
                      }
                    }}
                  />
                  {importError ? (
                    <FieldDescription className="text-destructive">
                      {importError}
                    </FieldDescription>
                  ) : importNotice ? (
                    <FieldDescription>{importNotice}</FieldDescription>
                  ) : (
                    <FieldDescription>
                      Apply switches the live theme. Apply + Save also adds it to your library.
                    </FieldDescription>
                  )}
                </Field>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    onChange={handleImportFile}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => importInputRef.current?.click()}
                  >
                    <UploadIcon data-icon="inline-start" />
                    Import File
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={importDraft.trim().length === 0}
                    onClick={() => applyImportedTheme(importDraft, false)}
                  >
                    Apply
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={importDraft.trim().length === 0}
                    onClick={() => applyImportedTheme(importDraft, true)}
                  >
                    Apply + Save
                  </Button>
                </div>
              </FieldGroup>
            </ThemeSection>

            <ThemeSection
              title="Hyperparameters"
              description="Density compresses spacing, softness expands radii, atmosphere pushes glow and blur, type scale grows copy."
            >
              <FieldGroup className="gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {hyperFields.map((field) => (
                    <ThemeNumberInput
                      key={field.key}
                      id={`hyper-${field.key}`}
                      label={field.label}
                      value={activeTheme.hyper[field.key]}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      onCommit={(value) => updateHyper(field.key, value)}
                    />
                  ))}
                </div>
              </FieldGroup>
            </ThemeSection>

            <ThemeSection title="Semantic Tokens">
              <FieldGroup className="gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {semanticFields.map((field) => (
                    <ThemeColorInput
                      key={field.key}
                      id={`semantic-${field.key}`}
                      label={field.label}
                      value={activeTheme.semantic[field.key]}
                      onCommit={(value) => updateSemantic(field.key, value)}
                    />
                  ))}
                </div>
              </FieldGroup>
            </ThemeSection>

            <ThemeSection title="Canvas">
              <FieldGroup className="gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {canvasTextFields.map((field) => (
                    <ThemeColorInput
                      key={field.key}
                      id={`canvas-${field.key}`}
                      label={field.label}
                      value={activeTheme.canvas[field.key]}
                      onCommit={(value) => updateCanvas(field.key, value)}
                    />
                  ))}
                  {canvasNumberFields.map((field) => (
                    <ThemeNumberInput
                      key={field.key}
                      id={`canvas-${field.key}`}
                      label={field.label}
                      value={activeTheme.effects[field.key] as number}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      onCommit={(value) => updateEffectsNumber(field.key, value)}
                    />
                  ))}
                </div>
              </FieldGroup>
            </ThemeSection>

            <ThemeSection title="Surfaces And Effects">
              <FieldGroup className="gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {surfaceFields.map((field) => (
                    <ThemeColorInput
                      key={field.key}
                      id={`surface-${field.key}`}
                      label={field.label}
                      value={activeTheme.surfaces[field.key]}
                      onCommit={(value) => updateSurfaces(field.key, value)}
                    />
                  ))}
                  {effectTextFields.map((field) => (
                    <ThemeColorInput
                      key={field.key}
                      id={`effects-${field.key}`}
                      label={field.label}
                      value={activeTheme.effects[field.key] as string}
                      onCommit={(value) => updateEffectsText(field.key, value)}
                    />
                  ))}
                  {effectNumberFields.map((field) => (
                    <ThemeNumberInput
                      key={field.key}
                      id={`effects-${field.key}`}
                      label={field.label}
                      value={activeTheme.effects[field.key] as number}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      onCommit={(value) => updateEffectsNumber(field.key, value)}
                    />
                  ))}
                </div>
              </FieldGroup>
            </ThemeSection>

            <ThemeSection title="Geometry">
              <FieldGroup className="gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {geometryFields.map((field) => (
                    <ThemeNumberInput
                      key={field.key}
                      id={`geometry-${field.key}`}
                      label={field.label}
                      value={activeTheme.geometry[field.key]}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      onCommit={(value) => updateGeometry(field.key, value)}
                    />
                  ))}
                </div>
              </FieldGroup>
            </ThemeSection>

            <ThemeSection title="Typography">
              <FieldGroup className="gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {typographyTextFields.map((field) => (
                    <ThemeFontInput
                      key={field.key}
                      id={`typography-${field.key}`}
                      label={field.label}
                      value={activeTheme.typography[field.key] as string}
                      onCommit={(value) => updateTypographyText(field.key, value)}
                    />
                  ))}
                  {typographyNumberFields.map((field) => (
                    <ThemeNumberInput
                      key={field.key}
                      id={`typography-${field.key}`}
                      label={field.label}
                      value={activeTheme.typography[field.key] as number}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      onCommit={(value) => updateTypographyNumber(field.key, value)}
                    />
                  ))}
                </div>
              </FieldGroup>
            </ThemeSection>
          </div>

          <div className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
            <ThemeSection title="Saved Themes">
              <div className="flex flex-col gap-3">
                {savedThemes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved themes yet.</p>
                ) : (
                  savedThemes.map((theme) => (
                    <div key={theme.id} className="rounded-xl border border-border bg-muted/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{theme.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(theme.updatedAt).toLocaleString()}
                          </div>
                        </div>
                        {theme.id === activeTheme.id ? <Badge>Active</Badge> : null}
                      </div>
                      <Separator className="my-3" />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => applySavedTheme(theme.id)}
                        >
                          Apply
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => deleteSavedTheme(theme.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ThemeSection>

            <ThemeSection title="Theme JSON">
              <FieldGroup className="gap-3">
                <Field>
                  <FieldDescription>
                    Save or download this blob as a reusable theme preset.
                  </FieldDescription>
                  <pre className="max-h-[34rem] overflow-auto rounded-xl border border-border bg-background/60 p-3 text-xs leading-5 text-foreground">
                    {serializedTheme}
                  </pre>
                </Field>
              </FieldGroup>
            </ThemeSection>
          </div>
        </div>
      </div>
    </div>
  )
}
