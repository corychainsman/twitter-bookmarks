import type { RawBookmarkRecord } from '@/features/bookmarks/model'

export const demoBookmarkRecords: RawBookmarkRecord[] = [
  {
    id: 'demo-001',
    tweetId: 'demo-001',
    sortIndex: '500',
    postedAt: '2026-03-18T14:20:00.000Z',
    url: 'https://x.com/karpathy/status/demo-001',
    text: 'A clean benchmark view for multi-stage compiler experiments.',
    articleTitle: 'Compiler pipelines in practice',
    articleText: 'An article about kernels, schedulers, and compilation stages.',
    quotedTweet: {
      text: 'GPU kernel scheduling is the hidden half of the story.',
    },
    authorName: 'Andrej Karpathy',
    authorHandle: 'karpathy',
    folderNames: ['AI Systems'],
    engagement: {
      likeCount: 4821,
      replyCount: 132,
      repostCount: 804,
    },
    mediaObjects: [
      {
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
        width: 1200,
        height: 800,
      },
      {
        type: 'video',
        previewUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1080&q=70',
        variants: [
          {
            url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
            contentType: 'video/mp4',
            bitrate: 832000,
          },
        ],
        width: 1080,
        height: 1350,
      },
    ],
  },
  {
    id: 'demo-002',
    tweetId: 'demo-002',
    sortIndex: '490',
    postedAt: '2026-03-17T09:10:00.000Z',
    url: 'https://x.com/jxnlco/status/demo-002',
    text: 'Bookmark folders are underrated when you want to keep long-lived research trails tidy.',
    authorName: 'Jason Liu',
    authorHandle: 'jxnlco',
    folderNames: ['Agents', 'Research'],
    engagement: {
      likeCount: 2263,
      replyCount: 47,
      repostCount: 349,
    },
    mediaObjects: [
      {
        type: 'animated_gif',
        previewUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80',
        variants: [
          {
            url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
            contentType: 'video/webm',
          },
          {
            url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
            contentType: 'video/mp4',
          },
        ],
        width: 900,
        height: 900,
      },
    ],
  },
  {
    id: 'demo-003',
    tweetId: 'demo-003',
    sortIndex: '480',
    postedAt: '2026-03-16T18:45:00.000Z',
    url: 'https://x.com/nearcyan/status/demo-003',
    text: 'This thread pairs article enrichment with clean source attribution.',
    articleTitle: 'How to build a bookmark corpus',
    articleText: 'Derived static assets should be shareable while raw private cache stays local.',
    authorName: 'Nearcyan',
    authorHandle: 'nearcyan',
    folderNames: ['Tooling'],
    engagement: {
      likeCount: 1710,
      replyCount: 29,
      repostCount: 214,
    },
    mediaObjects: [
      {
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1000&q=80',
        width: 1000,
        height: 1500,
      },
    ],
  },
  {
    id: 'demo-004',
    tweetId: 'demo-004',
    sortIndex: '470',
    postedAt: '2026-03-15T12:00:00.000Z',
    url: 'https://x.com/swyx/status/demo-004',
    text: 'Prefetching a poster is enough to make long-scrolling video grids feel calm.',
    authorName: 'Shawn Wang',
    authorHandle: 'swyx',
    folderNames: ['Frontend'],
    engagement: {
      likeCount: 3011,
      replyCount: 88,
      repostCount: 541,
    },
    mediaObjects: [
      {
        type: 'video',
        previewUrl: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1200&q=80',
        variants: [
          {
            url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
            contentType: 'video/mp4',
          },
        ],
        width: 1200,
        height: 675,
      },
    ],
  },
  {
    id: 'demo-005',
    tweetId: 'demo-005',
    sortIndex: '460',
    postedAt: '2026-03-14T16:25:00.000Z',
    url: 'https://x.com/addyosmani/status/demo-005',
    text: 'Masonry plus virtualization is enough if the item contracts are stable.',
    authorName: 'Addy Osmani',
    authorHandle: 'addyosmani',
    folderNames: ['Performance'],
    engagement: {
      likeCount: 5520,
      replyCount: 96,
      repostCount: 1203,
    },
    mediaObjects: [
      {
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1280&q=80',
        width: 1280,
        height: 853,
      },
      {
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&w=960&q=80',
        width: 960,
        height: 1280,
      },
    ],
  },
]
