import * as React from 'react'

import {
  ArrowDownZAIcon,
  ArrowUpAZIcon,
  CaptionsIcon,
  CaptionsOffIcon,
  ExternalLinkIcon,
  ImageIcon,
  ImagesIcon,
  RefreshCcwIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react'

import type { QueryState } from '@/features/bookmarks/model'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Toggle } from '@/components/ui/toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export const toolbarChipClass =
  'border-[var(--app-control-border)] bg-[var(--app-control-surface)] text-[var(--muted-foreground)] rounded-[var(--app-control-radius)]'

export const toolbarControlClass =
  'border-[var(--app-control-border)] bg-[var(--app-control-surface)] text-[var(--foreground)] rounded-[var(--app-control-radius)] hover:bg-[color-mix(in_srgb,var(--app-control-surface)_88%,var(--foreground)_12%)] focus-visible:border-[var(--ring)]'

export const toolbarInputControlClass =
  'border-[var(--app-control-border)] bg-[var(--app-control-surface)] text-[var(--foreground)] rounded-[var(--app-control-radius)] hover:bg-[color-mix(in_srgb,var(--app-control-surface)_88%,var(--foreground)_12%)] hover:[box-shadow:0_0_0_var(--app-toolbar-hover-outline-gap)_var(--app-toolbar-surface),0_0_0_calc(var(--app-toolbar-hover-outline-gap)+var(--app-toolbar-hover-outline-width))_var(--app-tile-hover-outline-color)] focus-visible:border-[var(--app-control-border)] focus-visible:[box-shadow:0_0_0_var(--app-toolbar-hover-outline-gap)_var(--app-toolbar-surface),0_0_0_calc(var(--app-toolbar-hover-outline-gap)+var(--app-toolbar-hover-outline-width))_var(--app-tile-hover-outline-color)]'

export const toolbarPopoverPanelClass =
  'border border-[var(--app-panel-border)] bg-[var(--app-panel-surface)] text-[var(--foreground)] rounded-[var(--app-panel-radius)] ring-0 shadow-none'

export const toolbarSheetPanelClass =
  'border border-[var(--app-panel-border)] bg-[var(--app-panel-surface)] text-[var(--foreground)] shadow-none'

const toolbarDrawerRowClass =
  'flex h-11 min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3 text-sm'

function ToolbarTooltip({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function ToolbarDrawerRow({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn(toolbarDrawerRowClass, className)}>{children}</div>
}

export function ToolbarIconToggle({
  pressed,
  activeLabel,
  inactiveLabel,
  activeIcon,
  inactiveIcon,
  onToggle,
  className,
}: {
  pressed: boolean
  activeLabel: string
  inactiveLabel: string
  activeIcon: React.ReactNode
  inactiveIcon: React.ReactNode
  onToggle: () => void
  className?: string
}) {
  const label = pressed ? activeLabel : inactiveLabel

  return (
    <ToolbarTooltip label={label}>
      <Toggle
        type="button"
        variant="outline"
        size="lg"
        aria-label={label}
        title={label}
        pressed={pressed}
        onPressedChange={() => onToggle()}
        className={cn('app-control shrink-0', toolbarControlClass, className)}
      >
        {pressed ? activeIcon : inactiveIcon}
      </Toggle>
    </ToolbarTooltip>
  )
}

export function ToolbarDirectionToggle({
  dir,
  onToggle,
}: {
  dir: QueryState['dir']
  onToggle: () => void
}) {
  return (
    <ToolbarIconToggle
      pressed={dir === 'desc'}
      activeLabel="Newest first"
      inactiveLabel="Oldest first"
      activeIcon={<ArrowDownZAIcon />}
      inactiveIcon={<ArrowUpAZIcon />}
      onToggle={onToggle}
    />
  )
}

export function ToolbarModeToggle({
  mode,
  onToggle,
}: {
  mode: QueryState['mode']
  onToggle: () => void
}) {
  return (
    <ToolbarIconToggle
      pressed={mode === 'one'}
      activeLabel="One image per tweet"
      inactiveLabel="All images"
      activeIcon={<ImageIcon />}
      inactiveIcon={<ImagesIcon />}
      onToggle={onToggle}
    />
  )
}

export function ToolbarImmersiveToggle({
  immersive,
  onToggle,
}: {
  immersive: boolean
  onToggle: () => void
}) {
  return (
    <ToolbarIconToggle
      pressed={immersive}
      activeLabel="Hide captions"
      inactiveLabel="Show captions"
      activeIcon={<CaptionsOffIcon />}
      inactiveIcon={<CaptionsIcon />}
      onToggle={onToggle}
    />
  )
}

export function ToolbarSortSelect({
  value,
  onValueChange,
  className,
}: {
  value: QueryState['sort']
  onValueChange: (value: QueryState['sort']) => void
  className?: string
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as QueryState['sort'])}>
      <SelectTrigger
        aria-label="Sort order"
        className={cn('app-control h-9 min-w-30 shrink-0 sm:min-w-34', toolbarControlClass, className)}
      >
        <SelectValue placeholder="Sort order" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="bookmarked">Bookmarked</SelectItem>
          <SelectItem value="posted">Posted</SelectItem>
          <SelectItem value="random">Random</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function ToolbarResultCount({
  resultCount,
  className,
}: {
  resultCount: number
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'app-toolbar-chip h-9 shrink-0 px-3 text-[11px] font-medium tracking-[0.2em] uppercase',
        toolbarChipClass,
        className,
      )}
    >
      {resultCount}
    </Badge>
  )
}

export function ToolbarZoomCluster({
  canZoomIn,
  canZoomOut,
  canResetZoom,
  currentColumnCount,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: {
  canZoomIn: boolean
  canZoomOut: boolean
  canResetZoom: boolean
  currentColumnCount: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
}) {
  return (
    <div className="app-toolbar-label flex shrink-0 items-center gap-1 p-1">
      <ToolbarTooltip label="Zoom out">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          className="rounded-full border-transparent bg-transparent"
          disabled={!canZoomOut}
          onClick={onZoomOut}
        >
          <ZoomOutIcon />
        </Button>
      </ToolbarTooltip>
      <ToolbarTooltip label="Reset zoom">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Reset zoom"
          title="Reset zoom"
          className="h-7 min-w-8 rounded-full border-transparent px-2 text-[10px] font-medium tracking-[0.16em] uppercase"
          disabled={!canResetZoom}
          onClick={onZoomReset}
        >
          {currentColumnCount}
        </Button>
      </ToolbarTooltip>
      <ToolbarTooltip label="Zoom in">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          className="rounded-full border-transparent bg-transparent"
          disabled={!canZoomIn}
          onClick={onZoomIn}
        >
          <ZoomInIcon />
        </Button>
      </ToolbarTooltip>
    </div>
  )
}

export function ToolbarRerandomizeButton({
  onRerandomize,
  className,
}: {
  onRerandomize: () => void
  className?: string
}) {
  return (
    <ToolbarTooltip label="Rerandomize">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Rerandomize"
        className={cn('app-control', toolbarControlClass, className)}
        onClick={onRerandomize}
      >
        <RefreshCcwIcon />
      </Button>
    </ToolbarTooltip>
  )
}

export function ToolbarSeedSwitch({
  keepSeed,
  onKeepSeedChange,
}: {
  keepSeed: boolean
  onKeepSeedChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm">
      <span className="text-muted-foreground">Seed</span>
      <Switch
        id="keep-seed-overflow"
        size="sm"
        checked={keepSeed}
        onCheckedChange={onKeepSeedChange}
      />
    </label>
  )
}

export function ToolbarThemeStudioAction({
  href,
}: {
  href: string
}) {
  return (
    <Button
      asChild
      variant="outline"
      className={cn('app-control h-10 w-full justify-start rounded-xl', toolbarControlClass)}
    >
      <a href={href} target="_blank" rel="noreferrer">
        <ExternalLinkIcon data-icon="inline-start" />
        Open Theme Studio
      </a>
    </Button>
  )
}

export function ToolbarOverflowContent({
  canZoomIn,
  canZoomOut,
  canResetZoom,
  currentColumnCount,
  isRandomSort,
  queryState,
  resultCount,
  themeStudioHref,
  overflowKeys,
  onSortChange,
  onDirectionToggle,
  onModeChange,
  onImmersiveChange,
  onKeepSeedChange,
  onRerandomize,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  reverseOrder = false,
}: {
  canZoomIn: boolean
  canZoomOut: boolean
  canResetZoom: boolean
  currentColumnCount: number
  isRandomSort: boolean
  queryState: QueryState
  resultCount: number
  themeStudioHref: string
  overflowKeys: Set<string>
  onSortChange: (value: QueryState['sort']) => void
  onDirectionToggle: () => void
  onModeChange: (value: QueryState['mode']) => void
  onImmersiveChange: (value: boolean) => void
  onKeepSeedChange: (value: boolean) => void
  onRerandomize: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  reverseOrder?: boolean
}) {
  const contentItems = [
    overflowKeys.has('sort') ? (
      <ToolbarDrawerRow key="sort" className="p-2">
        <ToolbarSortSelect
          value={queryState.sort}
          onValueChange={onSortChange}
          className="h-9 w-full rounded-xl"
        />
      </ToolbarDrawerRow>
    ) : null,
    overflowKeys.has('direction') ? (
      <ToolbarDrawerRow key="direction">
        <Button
          type="button"
          variant="outline"
          className={cn('app-control h-9 w-full justify-between rounded-xl', toolbarControlClass)}
          onClick={onDirectionToggle}
        >
          <span>Direction</span>
          <span className="text-muted-foreground">{queryState.dir === 'desc' ? 'Desc' : 'Asc'}</span>
        </Button>
      </ToolbarDrawerRow>
    ) : null,
    overflowKeys.has('mode') ? (
      <ToolbarDrawerRow key="mode">
        <Button
          type="button"
          variant="outline"
          className={cn(
            'app-control h-9 w-full justify-between rounded-xl',
            toolbarControlClass,
            queryState.mode === 'one'
              ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
              : '',
          )}
          onClick={() => onModeChange(queryState.mode === 'one' ? 'all' : 'one')}
        >
          <span>{queryState.mode === 'one' ? 'One image per tweet' : 'All images'}</span>
          {queryState.mode === 'one' ? <ImageIcon /> : <ImagesIcon />}
        </Button>
      </ToolbarDrawerRow>
    ) : null,
    overflowKeys.has('immersive') ? (
      <ToolbarDrawerRow key="immersive">
        <Button
          type="button"
          variant="outline"
          className={cn(
            'app-control h-9 w-full justify-between rounded-xl',
            toolbarControlClass,
            queryState.immersive
              ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
              : '',
          )}
          onClick={() => onImmersiveChange(!queryState.immersive)}
        >
          <span>{queryState.immersive ? 'Hide captions' : 'Show captions'}</span>
          {queryState.immersive ? <CaptionsOffIcon /> : <CaptionsIcon />}
        </Button>
      </ToolbarDrawerRow>
    ) : null,
    isRandomSort ? (
      <ToolbarDrawerRow key="seed">
        <ToolbarSeedSwitch
          keepSeed={queryState.keepSeed}
          onKeepSeedChange={onKeepSeedChange}
        />
      </ToolbarDrawerRow>
    ) : null,
    overflowKeys.has('rerandomize') ? (
      <ToolbarDrawerRow key="rerandomize">
        <Button
          type="button"
          variant="outline"
          className={cn('app-control h-9 w-full justify-center rounded-xl', toolbarControlClass)}
          onClick={onRerandomize}
        >
          <RefreshCcwIcon data-icon="inline-start" />
          Rerandomize
        </Button>
      </ToolbarDrawerRow>
    ) : null,
    overflowKeys.has('zoom') ? (
      <ToolbarDrawerRow key="zoom">
        <span className="text-muted-foreground">Zoom</span>
        <ToolbarZoomCluster
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          canResetZoom={canResetZoom}
          currentColumnCount={currentColumnCount}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onZoomReset={onZoomReset}
        />
      </ToolbarDrawerRow>
    ) : null,
    overflowKeys.has('count') ? (
      <ToolbarDrawerRow key="count">
        <span className="text-muted-foreground">Results</span>
        <ToolbarResultCount resultCount={resultCount} className="bg-transparent" />
      </ToolbarDrawerRow>
    ) : null,
    overflowKeys.size > 0 ? <div key="separator" className="h-px bg-border" /> : null,
    <ToolbarDrawerRow key="theme-studio" className="p-0">
      <ToolbarThemeStudioAction href={themeStudioHref} />
    </ToolbarDrawerRow>,
  ]

  const orderedItems = reverseOrder ? [...contentItems].reverse() : contentItems

  return (
    <div className="flex flex-col gap-2">
      {orderedItems}
    </div>
  )
}
