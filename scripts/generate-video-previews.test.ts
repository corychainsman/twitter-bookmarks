import { describe, expect, it } from 'vitest'

import {
  buildPlaybackFfmpegArgs,
  buildPreviewFfmpegArgs,
} from './generate-video-previews'

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

describe('video preview ffmpeg args', () => {
  it('strips audio from grid autoplay previews', () => {
    const args = buildPreviewFfmpegArgs('/input.mp4', '/preview.mp4')

    expect(args).toContain('-an')
    expect(valueAfter(args, '-pix_fmt')).toBe('yuv420p')
    expect(valueAfter(args, '-movflags')).toBe('+faststart')
  })

  it('uses conservative Safari-compatible playback MP4 settings', () => {
    const args = buildPlaybackFfmpegArgs('/input.mp4', '/playback.mp4')

    expect(valueAfter(args, '-c:v')).toBe('libx264')
    expect(valueAfter(args, '-profile:v')).toBe('main')
    expect(valueAfter(args, '-level:v')).toBe('4.0')
    expect(valueAfter(args, '-tag:v')).toBe('avc1')
    expect(valueAfter(args, '-pix_fmt')).toBe('yuv420p')
    expect(valueAfter(args, '-movflags')).toBe('+faststart')
  })
})
