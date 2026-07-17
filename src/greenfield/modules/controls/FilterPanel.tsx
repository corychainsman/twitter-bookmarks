import * as React from "react"
import { Check, LoaderCircle, Search, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

import type { MediaKind } from "../../contracts/domain"
import type {
  ControlFilterValues,
  DatePreset,
  FilterControlProps,
  FilterToken,
} from "./types"

const MEDIA_OPTIONS: readonly { value: MediaKind; label: string }[] = [
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
]

const DATE_OPTIONS: readonly { value: DatePreset; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
  { value: "year", label: "Past year" },
  { value: "custom", label: "Custom range" },
]

interface FilterPanelProps extends FilterControlProps {
  idPrefix: string
  rangeCommitMode: "release" | "continuous"
  className?: string
}

interface WidthRangeControlProps {
  value: readonly [number, number]
  min: number
  max: number
  step: number
  unit: string
  name: string
  commitMode: "release" | "continuous"
  onChange: (value: readonly [number, number]) => void
}

function WidthRangeControl({
  value,
  min,
  max,
  step,
  unit,
  name,
  commitMode,
  onChange,
}: WidthRangeControlProps) {
  const [draft, setDraft] = React.useState(value)

  function readPair(next: number[]): readonly [number, number] | undefined {
    const first = next[0]
    const second = next[1]
    return first === undefined || second === undefined ? undefined : [first, second]
  }

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h3
          id={`${name}-heading`}
          className="text-base font-medium text-foreground sm:text-sm"
        >
          Original width
        </h3>
        <p className="shrink-0 tabular-nums text-base text-muted-foreground sm:text-sm">
          {draft[0].toLocaleString()}–{draft[1].toLocaleString()} {unit}
        </p>
      </div>
      <Slider
        name={name}
        aria-label="Original media width range"
        thumbLabels={["Minimum original width", "Maximum original width"]}
        min={min}
        max={max}
        step={step}
        value={[draft[0], draft[1]]}
        onValueChange={(next) => {
          const pair = readPair(next)
          if (!pair) return
          setDraft(pair)
          if (commitMode === "continuous") onChange(pair)
        }}
        onValueCommit={(next) => {
          const pair = readPair(next)
          if (!pair) return
          setDraft(pair)
          onChange(pair)
        }}
        className="min-h-12 [&_[data-slot=slider-thumb]]:after:-inset-5 sm:min-h-8"
      />
    </>
  )
}

function replaceFilterValue(
  value: ControlFilterValues,
  patch: Partial<ControlFilterValues>,
): ControlFilterValues {
  return { ...value, ...patch }
}

function toggleMediaKind(
  value: ControlFilterValues,
  kind: MediaKind,
): ControlFilterValues {
  const selected = value.mediaKinds.includes(kind)
  return replaceFilterValue(value, {
    mediaKinds: selected
      ? value.mediaKinds.filter((candidate) => candidate !== kind)
      : [...value.mediaKinds, kind],
  })
}

function addSource(
  value: ControlFilterValues,
  source: FilterToken,
): ControlFilterValues {
  if (value.sources.some((selected) => selected.id === source.id)) {
    return value
  }

  return replaceFilterValue(value, { sources: [...value.sources, source] })
}

function removeSource(
  value: ControlFilterValues,
  sourceId: string,
): ControlFilterValues {
  return replaceFilterValue(value, {
    sources: value.sources.filter((source) => source.id !== sourceId),
  })
}

export function FilterPanel({
  value,
  range,
  sourceSuggestions,
  sourceQuery,
  sourceSearching = false,
  onChange,
  onSourceQueryChange,
  idPrefix,
  rangeCommitMode,
  className,
}: FilterPanelProps) {
  const availableSuggestions = sourceSuggestions.filter(
    (suggestion) =>
      !value.sources.some((selected) => selected.id === suggestion.id),
  )

  return (
    <div className={cn("flex min-h-0 flex-col gap-7", className)}>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-base font-medium text-foreground sm:text-sm">
          Media type
        </legend>
        <div className="flex flex-col gap-2.5 sm:gap-2">
          {MEDIA_OPTIONS.map((option) => {
            const inputId = `${idPrefix}-media-${option.value}`
            const checked = value.mediaKinds.includes(option.value)

            return (
              <label
                key={option.value}
                htmlFor={inputId}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 text-base text-foreground hover:bg-muted/50 sm:min-h-8 sm:gap-2 sm:text-sm"
              >
                <span className="group inline-grid size-5 shrink-0 grid-cols-1 sm:size-4">
                  <input
                    id={inputId}
                    name={`${idPrefix}-media-kind`}
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange(toggleMediaKind(value, option.value))}
                    className="col-start-1 row-start-1 appearance-none rounded-sm border border-input bg-input/30 checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring forced-colors:appearance-auto"
                  />
                  <Check
                    aria-hidden="true"
                    className="pointer-events-none col-start-1 row-start-1 size-4 shrink-0 place-self-center stroke-primary-foreground group-not-has-checked:opacity-0"
                  />
                </span>
                {option.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <section aria-labelledby={`${idPrefix}-source-heading`} className="flex flex-col gap-3">
        <h3
          id={`${idPrefix}-source-heading`}
          className="text-base font-medium text-foreground sm:text-sm"
        >
          Source
        </h3>
        {value.sources.length > 0 ? (
          <ul role="list" className="flex flex-wrap gap-2">
            {value.sources.map((source) => (
              <li key={source.id}>
                <Badge variant="secondary" className="h-7 py-1 pr-1 pl-2.5">
                  {source.label}
                  <button
                    type="button"
                    aria-label={`Remove ${source.label}`}
                    onClick={() => onChange(removeSource(value, source.id))}
                    className="relative grid size-5 shrink-0 place-items-center rounded-full outline-none hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                  >
                    <X aria-hidden="true" className="size-4 shrink-0" />
                    <span
                      aria-hidden="true"
                      className="pointer-fine:hidden absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2"
                    />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 shrink-0 -translate-y-1/2 stroke-muted-foreground"
          />
          <Input
            id={`${idPrefix}-source-search`}
            name={`${idPrefix}-source-search`}
            type="search"
            value={sourceQuery}
            onChange={(event) => onSourceQueryChange(event.currentTarget.value)}
            placeholder="Find a source"
            aria-label="Find a source"
            aria-controls={`${idPrefix}-source-results`}
            className="h-11 pr-9 pl-9 text-base sm:h-8 sm:text-sm"
          />
          {sourceSearching ? (
            <LoaderCircle
              aria-label="Searching sources"
              className="absolute top-1/2 right-2.5 size-4 shrink-0 -translate-y-1/2 animate-spin stroke-muted-foreground motion-reduce:animate-none"
            />
          ) : null}
        </div>
        {sourceQuery.trim() !== "" ? (
          <div
            id={`${idPrefix}-source-results`}
            className="max-h-44 overflow-y-auto rounded-lg bg-muted/40 p-1 ring-1 ring-border"
          >
            {availableSuggestions.length > 0 ? (
              <ul role="list" className="flex flex-col gap-0.5">
                {availableSuggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(addSource(value, suggestion))
                        onSourceQueryChange("")
                      }}
                      className="flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-left text-base text-foreground outline-none hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:min-h-8 sm:text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {suggestion.label}
                      </span>
                      {suggestion.count === undefined ? null : (
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {suggestion.count.toLocaleString()}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-2 text-pretty text-base text-muted-foreground sm:text-sm">
                No matching sources.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <section aria-labelledby={`${idPrefix}-width-heading`} className="flex flex-col gap-4">
        <WidthRangeControl
          key={`${value.widthRange[0]}:${value.widthRange[1]}:${rangeCommitMode}`}
          value={value.widthRange}
          min={range.min}
          max={range.max}
          step={range.step}
          unit={range.unit}
          name={`${idPrefix}-width`}
          commitMode={rangeCommitMode}
          onChange={(nextRange) =>
            onChange(replaceFilterValue(value, { widthRange: nextRange }))
          }
        />
      </section>

      <section aria-labelledby={`${idPrefix}-date-heading`} className="flex flex-col gap-3">
        <h3
          id={`${idPrefix}-date-heading`}
          className="text-base font-medium text-foreground sm:text-sm"
        >
          Date added
        </h3>
        <Select
          value={value.date.preset}
          onValueChange={(preset: DatePreset) =>
            onChange(
              replaceFilterValue(value, {
                date: preset === "custom" ? { ...value.date, preset } : { preset },
              }),
            )
          }
        >
          <SelectTrigger
            aria-label="Date added"
            className="h-11 w-full text-base sm:h-8 sm:text-sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            {DATE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.date.preset === "custom" ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex min-w-0 flex-col gap-1.5 text-base text-muted-foreground sm:text-sm">
              From
              <Input
                name={`${idPrefix}-date-from`}
                type="date"
                value={value.date.from ?? ""}
                max={value.date.to}
                onChange={(event) =>
                  onChange(
                    replaceFilterValue(value, {
                      date: { ...value.date, from: event.currentTarget.value },
                    }),
                  )
                }
                className="h-11 min-w-0 text-base sm:h-8 sm:text-sm"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-base text-muted-foreground sm:text-sm">
              To
              <Input
                name={`${idPrefix}-date-to`}
                type="date"
                value={value.date.to ?? ""}
                min={value.date.from}
                onChange={(event) =>
                  onChange(
                    replaceFilterValue(value, {
                      date: { ...value.date, to: event.currentTarget.value },
                    }),
                  )
                }
                className="h-11 min-w-0 text-base sm:h-8 sm:text-sm"
              />
            </label>
          </div>
        ) : null}
      </section>
    </div>
  )
}
