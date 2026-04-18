import * as React from 'react'

import {
  ArrowDownUpIcon,
  CaptionsIcon,
  CaptionsOffIcon,
  ExternalLinkIcon,
  ImageIcon,
  ImagesIcon,
  MoreHorizontalIcon,
  RefreshCcwIcon,
  SearchIcon,
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

type BookmarksToolbarProps = {
  canZoomIn: boolean
  canZoomOut: boolean
  canResetZoom: boolean
  currentColumnCount: number
  folderOptions: string[]
  queryState: QueryState
  resultCount: number
  onSearchChange: (value: string) => void
  onFolderChange: (value: string) => void
  onSortChange: (value: QueryState['sort']) => void
  onDirectionToggle: () => void
  onModeChange: (value: QueryState['mode']) => void
  onImmersiveChange: (value: boolean) => void
  onKeepSeedChange: (value: boolean) => void
  onRerandomize: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
}

function ToolbarModeToggle({
  value,
  onChange,
  className,
  itemClassName,
}: {
  value: QueryState['mode']
  onChange: (value: QueryState['mode']) => void
  className?: string
  itemClassName?: string
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      className={className}
      onValueChange={(nextValue) => {
        if (nextValue === 'one' || nextValue === 'all') {
          onChange(nextValue)
        }
      }}
    >
      <ToggleGroupItem
        value="one"
        aria-label="One image per tweet"
        title="One image per tweet"
        className={itemClassName}
      >
        <ImageIcon />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="all"
        aria-label="All images"
        title="All images"
        className={itemClassName}
      >
        <ImagesIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

function ToolbarImmersiveToggle({
  immersive,
  onChange,
  className,
  itemClassName,
}: {
  immersive: boolean
  onChange: (value: boolean) => void
  className?: string
  itemClassName?: string
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={immersive ? 'on' : 'off'}
      className={className}
      onValueChange={(nextValue) => {
        if (nextValue === 'on') {
          onChange(true)
        }

        if (nextValue === 'off') {
          onChange(false)
        }
      }}
    >
      <ToggleGroupItem
        value="off"
        aria-label="Show captions"
        title="Show captions"
        className={itemClassName}
      >
        <CaptionsIcon />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="on"
        aria-label="Hide captions"
        title="Hide captions"
        className={itemClassName}
      >
        <CaptionsOffIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export function BookmarksToolbar({
  canZoomIn,
  canZoomOut,
  canResetZoom,
  currentColumnCount,
  folderOptions,
  queryState,
  resultCount,
  onSearchChange,
  onFolderChange,
  onSortChange,
  onDirectionToggle,
  onModeChange,
  onImmersiveChange,
  onKeepSeedChange,
  onRerandomize,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: BookmarksToolbarProps) {
  const toolbarRef = React.useRef<HTMLDivElement | null>(null)
  const sortDirectionLabel = queryState.dir === 'desc' ? 'Newest first' : 'Oldest first'
  const hasSearchQuery = queryState.q.trim().length > 0
  const hasFolderControl = folderOptions.length > 0
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(hasSearchQuery)
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
        searchExpanded: isSearchExpanded || hasSearchQuery,
        hasFolderControl,
        isRandomSort: queryState.sort === 'random',
      }),
    [hasFolderControl, hasSearchQuery, isSearchExpanded, queryState.sort, toolbarWidth],
  )
  const overflowSet = React.useMemo(() => new Set(overflowKeys), [overflowKeys])

  const collapseSearch = React.useCallback(() => {
    if (!hasSearchQuery) {
      setIsSearchExpanded(false)
    }
  }, [hasSearchQuery])

  return (
    <div className="app-toolbar sticky top-0 z-40">
      <div
        ref={toolbarRef}
        className="app-toolbar-inner mx-auto flex w-full max-w-[1920px] items-center overflow-hidden"
      >
        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <div className="app-toolbar-chip px-2.5 py-1 text-[10px] font-medium tracking-[0.28em] uppercase">
            Bookmarks
          </div>
        </div>

        <div
          className={cn(
            'relative shrink-0 overflow-hidden transition-[width] duration-200 ease-out',
            isSearchExpanded || hasSearchQuery ? 'w-[clamp(11rem,24vw,22rem)]' : 'w-9',
          )}
        >
          {isSearchExpanded || hasSearchQuery ? (
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
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !hasSearchQuery) {
                    event.currentTarget.blur()
                    setIsSearchExpanded(false)
                  }
                }}
                className="app-control h-9 pl-9 text-sm"
              />
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Open search"
              className="app-control size-9"
              onClick={() => setIsSearchExpanded(true)}
            >
              <SearchIcon />
            </Button>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden">
          {!overflowSet.has('count') ? (
            <Badge
              variant="outline"
              className="app-toolbar-chip h-9 shrink-0 px-3 text-[11px] font-medium tracking-[0.2em] uppercase"
            >
              {resultCount}
            </Badge>
          ) : null}

          {hasFolderControl && !overflowSet.has('folder') ? (
            <Select
              value={queryState.folder.length > 0 ? queryState.folder : '__all_folders__'}
              onValueChange={(value) => onFolderChange(value === '__all_folders__' ? '' : value)}
            >
              <SelectTrigger
                aria-label="Folder filter"
                className="app-control h-9 min-w-34 max-w-52 shrink-0"
              >
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="__all_folders__">All folders</SelectItem>
                  {folderOptions.map((folderName) => (
                    <SelectItem key={folderName} value={folderName}>
                      {folderName}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}

          {!overflowSet.has('sort') ? (
            <Select
              value={queryState.sort}
              onValueChange={(value) => onSortChange(value as QueryState['sort'])}
            >
              <SelectTrigger
                aria-label="Sort order"
                className="app-control h-9 min-w-30 shrink-0 sm:min-w-34"
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
              className="app-control h-9 shrink-0"
              onClick={onDirectionToggle}
            >
              <ArrowDownUpIcon data-icon="inline-start" />
              {queryState.dir === 'desc' ? 'Desc' : 'Asc'}
            </Button>
          ) : null}

          {!overflowSet.has('mode') ? (
            <ToolbarModeToggle
              value={queryState.mode}
              onChange={onModeChange}
              className="app-control shrink-0 p-0.5"
              itemClassName="size-8 rounded-full border-transparent px-0 text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            />
          ) : null}

          {!overflowSet.has('immersive') ? (
            <ToolbarImmersiveToggle
              immersive={queryState.immersive}
              onChange={onImmersiveChange}
              className="app-control shrink-0 p-0.5"
              itemClassName="size-8 rounded-full border-transparent px-0 text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            />
          ) : null}

          {!overflowSet.has('seed') ? (
            <label className="app-toolbar-label flex h-9 shrink-0 items-center gap-2 px-3 text-[11px] font-medium tracking-[0.18em] uppercase">
              Seed
              <Switch
                id="keep-seed"
                size="sm"
                checked={queryState.keepSeed}
                disabled={queryState.sort !== 'random'}
                onCheckedChange={onKeepSeedChange}
              />
            </label>
          ) : null}

          {queryState.sort === 'random' && !overflowSet.has('rerandomize') ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Rerandomize"
              className="app-control"
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
                className="h-7 min-w-8 rounded-full border-transparent px-2 text-[10px] font-medium tracking-[0.16em] uppercase"
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
                className="app-control shrink-0"
              >
                <MoreHorizontalIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="app-panel w-60 p-2.5">
              <div className="flex flex-col gap-2">
                <Button asChild type="button" variant="outline" className="app-control h-10 w-full justify-start rounded-xl">
                  <a href="/themes" target="_blank" rel="noreferrer">
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
                          className="app-control h-10 w-full rounded-xl"
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

                  {hasFolderControl && overflowSet.has('folder') ? (
                    <div className="rounded-xl border border-border bg-muted/20 p-2">
                      <Select
                        value={queryState.folder.length > 0 ? queryState.folder : '__all_folders__'}
                        onValueChange={(value) =>
                          onFolderChange(value === '__all_folders__' ? '' : value)
                        }
                      >
                        <SelectTrigger
                          aria-label="Folder filter"
                          className="app-control h-10 w-full rounded-xl"
                        >
                          <SelectValue placeholder="Folder" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="__all_folders__">All folders</SelectItem>
                            {folderOptions.map((folderName) => (
                              <SelectItem key={folderName} value={folderName}>
                                {folderName}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {overflowSet.has('count') ? (
                    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Results</span>
                      <Badge variant="outline" className="app-toolbar-chip bg-transparent">
                        {resultCount}
                      </Badge>
                    </div>
                  ) : null}

                  {overflowSet.has('direction') ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="app-control h-10 w-full justify-between rounded-xl"
                      onClick={onDirectionToggle}
                    >
                      <span>Direction</span>
                      <span className="text-muted-foreground">
                        {queryState.dir === 'desc' ? 'Desc' : 'Asc'}
                      </span>
                    </Button>
                  ) : null}

                  {overflowSet.has('mode') ? (
                    <div className="rounded-xl border border-border bg-muted/20 p-1">
                      <ToolbarModeToggle
                        value={queryState.mode}
                        onChange={onModeChange}
                        className="grid w-full grid-cols-2 rounded-xl border-0 bg-transparent p-0"
                        itemClassName="h-10 rounded-lg border-transparent px-0 text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                      />
                    </div>
                  ) : null}

                  {overflowSet.has('immersive') ? (
                    <div className="rounded-xl border border-border bg-muted/20 p-1">
                      <ToolbarImmersiveToggle
                        immersive={queryState.immersive}
                        onChange={onImmersiveChange}
                        className="grid w-full grid-cols-2 rounded-xl border-0 bg-transparent p-0"
                        itemClassName="h-10 rounded-lg border-transparent px-0 text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                      />
                    </div>
                  ) : null}

                  {overflowSet.has('seed') ? (
                    <label className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Seed</span>
                      <Switch
                        id="keep-seed-overflow"
                        size="sm"
                        checked={queryState.keepSeed}
                        disabled={queryState.sort !== 'random'}
                        onCheckedChange={onKeepSeedChange}
                      />
                    </label>
                  ) : null}

                  {queryState.sort === 'random' && overflowSet.has('rerandomize') ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="app-control h-10 w-full justify-center rounded-xl"
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
                          className="h-7 min-w-8 rounded-full border-transparent px-2 text-[10px] font-medium tracking-[0.16em] uppercase"
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
