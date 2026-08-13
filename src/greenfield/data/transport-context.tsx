import { createContext, useContext, type PropsWithChildren } from "react"

import type { ApiTransport } from "../contracts/interfaces"

const ApiTransportContext = createContext<ApiTransport | null>(null)

export interface ApiTransportProviderProps extends PropsWithChildren {
  transport: ApiTransport
}

export function ApiTransportProvider({ children, transport }: ApiTransportProviderProps) {
  return <ApiTransportContext value={transport}>{children}</ApiTransportContext>
}

export function useApiTransport(): ApiTransport {
  const transport = useContext(ApiTransportContext)
  if (!transport) {
    throw new Error("useApiTransport must be used within an ApiTransportProvider")
  }
  return transport
}

