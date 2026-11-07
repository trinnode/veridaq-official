/**
 * Currency display route.
 *
 * GET /api/fx/rate        — current USD → NGN rate (public, 30-minute cache)
 * GET /api/fx/rate?refresh=1 — force a provider round trip
 *
 * Deliberately unauthenticated: the public landing page shows the same Naira
 * figures as the portals, and the value is a public market rate with no user
 * data attached to it.
 */

import type { FastifyPluginAsync } from "fastify"
import { FxService } from "../services/fx.service.js"

export const fxRoutes: FastifyPluginAsync = async (app) => {
  const fxSvc = new FxService(app.redis)

  app.get("/rate", async (req, reply) => {
    const q = req.query as { refresh?: string }
    const quote = await fxSvc.getUsdToNgn(q.refresh === "1")

    // Short public cache so a page load burst does not hit this per tab, while
    // still letting the browser pick up a refreshed rate within a minute.
    reply.header("cache-control", "public, max-age=60")
    return quote
  })
}
