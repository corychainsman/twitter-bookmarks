import type {
  CommittedWallState,
  DiscoveryPage,
  MediaAsset,
  MediaRecord,
  ResultCount,
  WallTile,
} from "./domain"

export interface ApiTransport {
  discover(
    state: CommittedWallState,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<DiscoveryPage>
  count(state: CommittedWallState, signal?: AbortSignal): Promise<ResultCount>
  media(mediaId: string, signal?: AbortSignal): Promise<MediaAsset>
  suggestSources(query: string, signal?: AbortSignal): Promise<SourceSuggestion[]>
}

export interface SourceSuggestion {
  id: string
  label: string
  count: number
}

export interface CompositionEngine {
  compose(records: MediaRecord[], state: CommittedWallState): WallTile[]
}

export interface PlaybackRegistration {
  mediaId: string
  element: HTMLVideoElement
}

export interface PlaybackCoordinator {
  register(registration: PlaybackRegistration): () => void
  setPageVisible(visible: boolean): void
  setSurfaceCovered(covered: boolean): void
}

export interface TelemetryEvent {
  name: string
  durationMs?: number
  value?: number
}

export interface Telemetry {
  performance(event: TelemetryEvent): void
  error(error: Error): void
}
