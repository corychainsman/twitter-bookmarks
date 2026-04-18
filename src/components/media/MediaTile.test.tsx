import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MediaTile } from '@/components/media/MediaTile'
import type { GridItem, TweetDoc } from '@/features/bookmarks/model'
import { formatPostedDate } from '@/lib/format'

const item: GridItem = {
  gridId: 'tweet-1:0',
  tweetId: 'tweet-1',
  mediaIndex: 0,
  mediaType: 'photo',
  thumbUrl: 'https://img.example.com/thumb.jpg',
  fullUrl: 'https://img.example.com/full.jpg',
  width: 1200,
  height: 800,
  aspectRatio: 1.5,
}

const tweet: TweetDoc = {
  id: 'tweet-1',
  sortIndex: '100',
  postedAt: '2026-04-17T08:00:00.000Z',
  url: 'https://x.com/example/status/tweet-1',
  text: 'Immersive mode should hide this tweet copy.',
  authorHandle: 'example',
  folderNames: ['Inspo'],
  media: [
    {
      type: 'photo',
      thumbUrl: 'https://img.example.com/thumb.jpg',
      fullUrl: 'https://img.example.com/full.jpg',
      width: 1200,
      height: 800,
      aspectRatio: 1.5,
    },
  ],
  representativeMediaIndex: 0,
  representativeMotionMediaIndex: 0,
}

describe('MediaTile', () => {
  it('shows bookmark metadata in the default tile mode', () => {
    render(
      <MediaTile
        item={item}
        tweet={tweet}
        immersive={false}
        onOpen={() => {}}
      />,
    )

    expect(screen.getByText(tweet.text)).toBeInTheDocument()
    expect(screen.getByText(/photo/i)).toBeInTheDocument()
    expect(screen.getByText(`@${tweet.authorHandle}`)).toBeInTheDocument()
    expect(screen.getByText(formatPostedDate(tweet.postedAt))).toBeInTheDocument()
    expect(screen.getByText('Inspo')).toBeInTheDocument()
  })

  it('renders only media in immersive mode', () => {
    render(
      <MediaTile
        item={item}
        tweet={tweet}
        immersive
        onOpen={() => {}}
      />,
    )

    expect(screen.getByRole('img', { name: tweet.text })).toBeInTheDocument()
    expect(screen.queryByText(tweet.text)).not.toBeInTheDocument()
    expect(screen.queryByText(/photo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(`@${tweet.authorHandle}`)).not.toBeInTheDocument()
    expect(screen.queryByText(formatPostedDate(tweet.postedAt))).not.toBeInTheDocument()
    expect(screen.queryByText('Inspo')).not.toBeInTheDocument()
  })
})
