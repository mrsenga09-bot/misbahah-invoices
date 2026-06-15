import { authRouter } from "./auth-router";
import { invoiceRouter } from "./invoice-router";
import { fleetRouter } from "./fleet-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  invoice: invoiceRouter,
  fleet: fleetRouter,
});

export type AppRouter = typeof appRouter;
