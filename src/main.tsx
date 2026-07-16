import ReactDOM from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"

import "@/index.css"
import { TooltipProvider } from "@/components/ui/tooltip"
import { GreenfieldApp } from "@/greenfield/GreenfieldApp"
import {
  ApiTransportProvider,
  httpApiTransport,
  mockApiTransport,
} from "@/greenfield/data"
import {
  createGreenfieldQueryClient,
  GreenfieldQueryProvider,
} from "@/greenfield/platform"
import { createGreenfieldRouter } from "@/greenfield/router"
import { registerServiceWorker } from "@/greenfield/service-worker/register"

document.documentElement.classList.add("dark", "scheme-only-dark", "antialiased")

const queryClient = createGreenfieldQueryClient()
const apiTransport = import.meta.env.MODE === "test" ? mockApiTransport : httpApiTransport
const router = createGreenfieldRouter({
  queryClient,
  appComponent: GreenfieldApp,
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <GreenfieldQueryProvider client={queryClient}>
    <ApiTransportProvider transport={apiTransport}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </ApiTransportProvider>
  </GreenfieldQueryProvider>,
)

registerServiceWorker()
