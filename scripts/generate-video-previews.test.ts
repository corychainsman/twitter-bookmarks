import { describe, expect, it } from 'vitest'

import { buildPreviewFfmpegArgs } from './generate-video-previews'

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

  it('caps preview duration so long videos stay small', () => {
    const args = buildPreviewFfmpegArgs('/input.mp4', '/preview.mp4')

    expect(valueAfter(args, '-t')).toBe('8')
    // The duration cap must come before -vf/-c:v (output options), and applies to the
    // output rather than seeking the input, so the clip starts at 0:00.
    expect(args.indexOf('-t')).toBeGreaterThan(args.indexOf('/input.mp4'))
  })
})
