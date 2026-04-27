import { describe, expect, it } from 'vitest'

import {
  resolveTwitterImageSourceSet,
  withTwitterSize,
} from '@/lib/twitter-media-url'

describe('withTwitterSize', () => {
  it('appends the name parameter to pbs.twimg.com /media/ URLs', () => {
    expect(withTwitterSize('https://pbs.twimg.com/media/abc.jpg', 'medium')).toBe(
      'https://pbs.twimg.com/media/abc.jpg?name=medium',
    )
  })

  it('replaces an existing name parameter', () => {
    expect(
      withTwitterSize(
        'https://pbs.twimg.com/media/abc.jpg?name=large&format=jpg',
        'small',
      ),
    ).toBe('https://pbs.twimg.com/media/abc.jpg?name=small&format=jpg')
  })

  it('leaves non-Twitter URLs unchanged', () => {
    expect(withTwitterSize('https://img.example.com/thumb.jpg', 'medium')).toBe(
      'https://img.example.com/thumb.jpg',
    )
  })

  it('leaves Twitter video poster URLs unchanged (not /media/)', () => {
    const posterUrl =
      'https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/poster.jpg'
    expect(withTwitterSize(posterUrl, 'medium')).toBe(posterUrl)
  })

  it('returns the original string for unparseable URLs', () => {
    expect(withTwitterSize('not a url', 'medium')).toBe('not a url')
  })

  it('returns an empty string for empty input', () => {
    expect(withTwitterSize('', 'medium')).toBe('')
  })
})

describe('resolveTwitterImageSourceSet', () => {
  it('returns a srcSet/sizes pair for resizable Twitter URLs', () => {
    const result = resolveTwitterImageSourceSet(
      'https://pbs.twimg.com/media/abc.jpg',
    )
    expect(result.src).toBe('https://pbs.twimg.com/media/abc.jpg?name=medium')
    expect(result.srcSet).toBe(
      'https://pbs.twimg.com/media/abc.jpg?name=small 680w, https://pbs.twimg.com/media/abc.jpg?name=medium 1200w, https://pbs.twimg.com/media/abc.jpg?name=large 2048w',
    )
    expect(result.sizes).toBe(
      '(max-width: 800px) 100vw, (max-width: 1200px) 50vw, 33vw',
    )
  })

  it('returns only src for non-resizable URLs', () => {
    const url = 'https://img.example.com/thumb.jpg'
    expect(resolveTwitterImageSourceSet(url)).toEqual({ src: url })
  })
})
