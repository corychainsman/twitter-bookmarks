declare module 'yet-another-react-lightbox' {
  interface SlideTypes {
    'tweet-embed': SlideTweetEmbed
  }

  interface SlideTweetEmbed {
    type: 'tweet-embed'
    tweetId: string
    tweetUrl: string
    poster?: string
    width?: number
    height?: number
  }
}
