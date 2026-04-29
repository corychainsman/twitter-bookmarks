import * as React from 'react'

import {
  ArrowDownUpIcon,
  CaptionsIcon,
  CaptionsOffIcon,
  ExternalLinkIcon,
  ImageIcon,
  ImageUpIcon,
  ImagesIcon,
  MoreHorizontalIcon,
  RefreshCcwIcon,
  SearchIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react'

import type { QueryState } from '@/features/bookmarks/model'
import { resolveToolbarOverflow } from '@/components/toolbar/toolbar-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type BookmarksToolbarProps = {
  canZoomIn: boolean
  canZoomOut: boolean
  canResetZoom: boolean
  currentColumnCount: number
  queryState: QueryState
  resultCount: number
  semanticImagePreviewUrl: string | null
  semanticSourceLabel: string | null
  onSearchChange: (value: string) => void
  onSortChange: (value: QueryState['sort']) => void
  onDirectionToggle: () => void
  onModeChange: (value: QueryState['mode']) => void
  onImmersiveChange: (value: boolean) => void
  onImageSearch: (file: File) => void
  onClearSemanticSource: () => void
  onKeepSeedChange: (value: boolean) => void
  onRerandomize: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
}

const toolbarChipClass =
  'border-[var(--app-control-border)] bg-[var(--app-control-surface)] text-[var(--muted-foreground)] rounded-[var(--app-control-radius)]'

const toolbarControlClass =
  'border-[var(--app-control-border)] bg-[var(--app-control-surface)] text-[var(--foreground)] rounded-[var(--app-control-radius)] hover:bg-[color-mix(in_srgb,var(--app-control-surface)_88%,var(--foreground)_12%)] focus-visible:border-[var(--ring)]'

const toolbarInputControlClass =
  'border-[var(--app-control-border)] bg-[var(--app-control-surface)] text-[var(--foreground)] rounded-[var(--app-control-radius)] hover:bg-[color-mix(in_srgb,var(--app-control-surface)_88%,var(--foreground)_12%)] hover:[box-shadow:0_0_0_var(--app-toolbar-hover-outline-gap)_var(--app-toolbar-surface),0_0_0_calc(var(--app-toolbar-hover-outline-gap)+var(--app-toolbar-hover-outline-width))_var(--app-tile-hover-outline-color)] focus-visible:border-[var(--app-control-border)] focus-visible:[box-shadow:0_0_0_var(--app-toolbar-hover-outline-gap)_var(--app-toolbar-surface),0_0_0_calc(var(--app-toolbar-hover-outline-gap)+var(--app-toolbar-hover-outline-width))_var(--app-tile-hover-outline-color)]'

const toolbarPopoverPanelClass =
  'border border-[var(--app-panel-border)] bg-[var(--app-panel-surface)] text-[var(--foreground)] rounded-[var(--app-panel-radius)] ring-0 shadow-none'

function ToolbarStateButton({
  active,
  activeLabel,
  inactiveLabel,
  activeIcon,
  inactiveIcon,
  onToggle,
  className,
}: {
  active: boolean
  activeLabel: string
  inactiveLabel: string
  activeIcon: React.ReactNode
  inactiveIcon: React.ReactNode
  onToggle: () => void
  className?: string
}) {
  const label = active ? activeLabel : inactiveLabel

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'app-control shrink-0',
        toolbarControlClass,
        'text-muted-foreground',
        className,
      )}
      onClick={onToggle}
    >
      {active ? activeIcon : inactiveIcon}
    </Button>
  )
}

export function BookmarksToolbar({
  canZoomIn,
  canZoomOut,
  canResetZoom,
  currentColumnCount,
  queryState,
  resultCount,
  semanticImagePreviewUrl,
  semanticSourceLabel,
  onSearchChange,
  onSortChange,
  onDirectionToggle,
  onModeChange,
  onImmersiveChange,
  onImageSearch,
  onClearSemanticSource,
  onKeepSeedChange,
  onRerandomize,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: BookmarksToolbarProps) {
  const toolbarRef = React.useRef<HTMLDivElement | null>(null)
  const imageInputRef = React.useRef<HTMLInputElement | null>(null)
  const themeStudioHref = `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/themes`
  const sortDirectionLabel = queryState.dir === 'desc' ? 'Newest first' : 'Oldest first'
  const hasSearchQuery = queryState.q.trim().length > 0
  const hasImageSearchQuery = semanticImagePreviewUrl !== null
  const isRandomSort = queryState.sort === 'random'
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(
    hasSearchQuery || hasImageSearchQuery,
  )
  const [toolbarWidth, setToolbarWidth] = React.useState(0)

  React.useEffect(() => {
    const node = toolbarRef.current
    if (!node) {
      return
    }

    setToolbarWidth(node.clientWidth)

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      setToolbarWidth(entry.contentRect.width)
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const overflowKeys = React.useMemo(
    () =>
      resolveToolbarOverflow({
        containerWidth: toolbarWidth,
        searchExpanded: isSearchExpanded || hasSearchQuery || hasImageSearchQuery,
        isRandomSort,
        hasSemanticSource: semanticSourceLabel !== null,
      }),
    [
      hasImageSearchQuery,
      hasSearchQuery,
      isRandomSort,
      isSearchExpanded,
      semanticSourceLabel,
      toolbarWidth,
    ],
  )
  const overflowSet = React.useMemo(() => new Set(overflowKeys), [overflowKeys])

  const collapseSearch = React.useCallback(() => {
    if (!hasSearchQuery && !hasImageSearchQuery) {
      setIsSearchExpanded(false)
    }
  }, [hasImageSearchQuery, hasSearchQuery])

  const handleImageInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''

      if (!file) {
        return
      }

      onImageSearch(file)
    },
    [onImageSearch],
  )

  const handleSearchPaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedImage = [...event.clipboardData.items]
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .find((file): file is File => file !== null)

      if (!pastedImage) {
        return
      }

      event.preventDefault()
      onImageSearch(pastedImage)
    },
    [onImageSearch],
  )

  const imageSearchButton = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label="Search by image"
      title="Search by image"
      className={cn('app-control shrink-0', toolbarControlClass)}
      onClick={() => imageInputRef.current?.click()}
    >
      <ImageUpIcon />
    </Button>
  )

  const semanticSourceButton = semanticSourceLabel ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Clear ${semanticSourceLabel.toLowerCase()} search`}
      title={`Clear ${semanticSourceLabel.toLowerCase()} search`}
      className={cn('app-control h-9 shrink-0', toolbarControlClass)}
      onClick={onClearSemanticSource}
    >
      <span className="text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
        {semanticSourceLabel}
      </span>
      <XIcon data-icon="inline-end" />
    </Button>
  ) : null
  const imageSearchBadge = semanticImagePreviewUrl ? (
    <Badge
      variant="outline"
      className={cn(
        'app-toolbar-chip pointer-events-auto absolute top-1/2 left-8 z-20 h-6 max-w-28 -translate-y-1/2 gap-1.5 px-1 pr-0.5 text-[0.625rem] font-medium tracking-[0.12em] uppercase',
        toolbarChipClass,
      )}
    >
      <img
        src={semanticImagePreviewUrl}
        alt=""
        className="size-4 rounded-[calc(var(--app-control-radius)-2px)] object-cover"
      />
      <span className="max-w-12 truncate">Image</span>
      <button
        type="button"
        aria-label="Clear image search"
        title="Clear image search"
        className="grid size-5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClearSemanticSource}
      >
        <XIcon className="size-3" />
      </button>
    </Badge>
  ) : null

  return (
    <div className="app-toolbar sticky top-0 z-40">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageInputChange}
      />
      <div
        ref={toolbarRef}
        className="app-toolbar-inner mx-auto flex w-full max-w-[10000px] items-center"
      >
        <Badge
          variant="outline"
          className={cn(
            'app-toolbar-chip h-9 shrink-0 px-3 text-[0.6875rem] font-medium tracking-[0.2em] uppercase',
            toolbarChipClass,
          )}
        >
          {resultCount}
        </Badge>

        <div
          className={cn(
            'relative shrink-0 transition-[width] duration-200 ease-out',
            isSearchExpanded || hasSearchQuery || hasImageSearchQuery
              ? 'w-[clamp(11rem,24vw,22rem)]'
              : 'w-9',
          )}
        >
          {isSearchExpanded || hasSearchQuery || hasImageSearchQuery ? (
            <>
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
                data-icon="inline-start"
              />
              <Input
                id="bookmark-search"
                type="search"
                aria-label="Search bookmarks"
                placeholder="Search"
                autoFocus
                value={queryState.q}
                onBlur={collapseSearch}
                onChange={(event) => onSearchChange(event.target.value)}
                onPaste={handleSearchPaste}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !hasSearchQuery && !hasImageSearchQuery) {
                    event.currentTarget.blur()
                    setIsSearchExpanded(false)
                  }
                }}
                className={cn(
                  'app-control h-9 text-sm',
                  hasImageSearchQuery ? 'pl-[8.25rem]' : 'pl-9',
                  toolbarInputControlClass,
                )}
              />
              {imageSearchBadge}
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Open search"
              className={cn('app-control size-9', toolbarControlClass)}
              onClick={() => setIsSearchExpanded(true)}
            >
              <SearchIcon />
            </Button>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {!overflowSet.has('sort') ? (
            <Select
              value={queryState.sort}
              onValueChange={(value) => onSortChange(value as QueryState['sort'])}
            >
              <SelectTrigger
                aria-label="Sort order"
                className={cn('app-control h-9 min-w-30 shrink-0 sm:min-w-34', toolbarControlClass)}
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
          ) : null}

          {!overflowSet.has('direction') ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={sortDirectionLabel}
              className={cn('app-control h-9 shrink-0', toolbarControlClass)}
              onClick={onDirectionToggle}
            >
              <ArrowDownUpIcon data-icon="inline-start" />
              {queryState.dir === 'desc' ? 'Desc' : 'Asc'}
            </Button>
          ) : null}

          {!overflowSet.has('imageSearch') ? imageSearchButton : null}

          {!hasImageSearchQuery && !overflowSet.has('semanticSource') ? semanticSourceButton : null}

          {!overflowSet.has('mode') ? (
            <ToolbarStateButton
              active={queryState.mode === 'one'}
              activeLabel="One image per tweet"
              inactiveLabel="All images"
              activeIcon={<ImageIcon />}
              inactiveIcon={<ImagesIcon />}
              onToggle={() => onModeChange(queryState.mode === 'one' ? 'all' : 'one')}
            />
          ) : null}

          {!overflowSet.has('immersive') ? (
            <ToolbarStateButton
              active={queryState.immersive}
              activeLabel="Show captions"
              inactiveLabel="Hide captions"
              activeIcon={<CaptionsOffIcon />}
              inactiveIcon={<CaptionsIcon />}
              onToggle={() => onImmersiveChange(!queryState.immersive)}
            />
          ) : null}

          {isRandomSort && !overflowSet.has('seed') ? (
            <label className="app-toolbar-label flex h-9 shrink-0 items-center gap-2 px-3 text-[0.6875rem] font-medium tracking-[0.18em] uppercase">
              Seed
              <Switch
                id="keep-seed"
                size="sm"
                checked={queryState.keepSeed}
                onCheckedChange={onKeepSeedChange}
              />
            </label>
          ) : null}

          {isRandomSort && !overflowSet.has('rerandomize') ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Rerandomize"
              className={cn('app-control', toolbarControlClass)}
              onClick={onRerandomize}
            >
              <RefreshCcwIcon />
            </Button>
          ) : null}

          {!overflowSet.has('zoom') ? (
            <div className="app-toolbar-label flex shrink-0 items-center gap-1 p-1">
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Reset zoom"
                title="Reset zoom"
                className="h-7 min-w-8 rounded-full border-transparent px-2 text-[0.625rem] font-medium tracking-[0.16em] uppercase"
                disabled={!canResetZoom}
                onClick={onZoomReset}
              >
                {currentColumnCount}
              </Button>
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
            </div>
          ) : null}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="More"
                className={cn('app-control shrink-0', toolbarControlClass)}
              >
                <MoreHorizontalIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className={cn('w-60 p-2.5', toolbarPopoverPanelClass)}>
              <div className="flex flex-col gap-2">
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  className={cn(
                    'app-control h-10 w-full justify-start rounded-xl',
                    toolbarControlClass,
                  )}
                >
                  <a href={themeStudioHref} target="_blank" rel="noreferrer">
                    <ExternalLinkIcon data-icon="inline-start" />
                    Open Theme Studio
                  </a>
                </Button>

                {overflowKeys.length > 0 ? (
                  <div className="h-px bg-border" />
                ) : null}

                <div className="flex flex-col gap-2">
                  {overflowSet.has('sort') ? (
                    <div className="rounded-xl border border-border bg-muted/20 p-2">
                      <Select
                        value={queryState.sort}
                        onValueChange={(value) => onSortChange(value as QueryState['sort'])}
                      >
                        <SelectTrigger
                          aria-label="Sort order"
                          className={cn(
                            'app-control h-10 w-full rounded-xl',
                            toolbarControlClass,
                          )}
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
                    </div>
                  ) : null}

                  {overflowSet.has('direction') ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'app-control h-10 w-full justify-between rounded-xl',
                        toolbarControlClass,
                      )}
                      onClick={onDirectionToggle}
                    >
                      <span>Direction</span>
                      <span className="text-muted-foreground">
                        {queryState.dir === 'desc' ? 'Desc' : 'Asc'}
                      </span>
                    </Button>
                  ) : null}

                  {overflowSet.has('imageSearch') ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'app-control h-10 w-full justify-between rounded-xl',
                        toolbarControlClass,
                      )}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <span>Image search</span>
                      <ImageUpIcon />
                    </Button>
                  ) : null}

                  {!hasImageSearchQuery && overflowSet.has('semanticSource') && semanticSourceButton ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'app-control h-10 w-full justify-between rounded-xl',
                        toolbarControlClass,
                      )}
                      onClick={onClearSemanticSource}
                    >
                      <span>{semanticSourceLabel}</span>
                      <XIcon />
                    </Button>
                  ) : null}

                  {overflowSet.has('mode') ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'app-control h-10 w-full justify-between rounded-xl',
                        toolbarControlClass,
                      )}
                      onClick={() =>
                        onModeChange(queryState.mode === 'one' ? 'all' : 'one')
                      }
                    >
                      <span>
                        {queryState.mode === 'one' ? 'One image per tweet' : 'All images'}
                      </span>
                      {queryState.mode === 'one' ? <ImageIcon /> : <ImagesIcon />}
                    </Button>
                  ) : null}

                  {overflowSet.has('immersive') ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'app-control h-10 w-full justify-between rounded-xl',
                        toolbarControlClass,
                      )}
                      onClick={() => onImmersiveChange(!queryState.immersive)}
                    >
                      <span>
                        {queryState.immersive ? 'Show captions' : 'Hide captions'}
                      </span>
                      {queryState.immersive ? <CaptionsOffIcon /> : <CaptionsIcon />}
                    </Button>
                  ) : null}

                  {isRandomSort && overflowSet.has('seed') ? (
                    <label className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Seed</span>
                      <Switch
                        id="keep-seed-overflow"
                        size="sm"
                        checked={queryState.keepSeed}
                        onCheckedChange={onKeepSeedChange}
                      />
                    </label>
                  ) : null}

                  {isRandomSort && overflowSet.has('rerandomize') ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'app-control h-10 w-full justify-center rounded-xl',
                        toolbarControlClass,
                      )}
                      onClick={onRerandomize}
                    >
                      <RefreshCcwIcon data-icon="inline-start" />
                      Rerandomize
                    </Button>
                  ) : null}

                  {overflowSet.has('zoom') ? (
                    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Zoom</span>
                      <div className="app-toolbar-label flex items-center gap-1 p-1">
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label="Reset zoom"
                          title="Reset zoom"
                          className="h-7 min-w-8 rounded-full border-transparent px-2 text-[0.625rem] font-medium tracking-[0.16em] uppercase"
                          disabled={!canResetZoom}
                          onClick={onZoomReset}
                        >
                          {currentColumnCount}
                        </Button>
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
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}
