export type AppRoute = 'bookmarks' | 'themes'

export function resolveAppRoute(pathname: string, baseUrl: string): AppRoute {
  const normalizedBase = baseUrl === '/' ? '/' : `/${baseUrl.replace(/^\/+|\/+$/g, '')}`
  const relativePath =
    normalizedBase !== '/' && pathname.startsWith(normalizedBase)
      ? pathname.slice(normalizedBase.length)
      : pathname
  const normalizedPath = `/${relativePath.replace(/^\/+|\/+$/g, '')}`

  return normalizedPath === '/themes' ? 'themes' : 'bookmarks'
}
