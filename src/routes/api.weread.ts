import { createFileRoute } from '@tanstack/react-router'

import { proxyWereadRequest } from '@/lib/server/weread-proxy'

export const Route = createFileRoute('/api/weread')({
  server: {
    handlers: {
      POST: ({ request }) => proxyWereadRequest(request),
    },
  },
})
