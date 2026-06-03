import type { FastifyInstance } from "fastify";
// The HTTP contract is what tests assert (via app.inject), not internals.
export function registerHealthRoutes(app: FastifyInstance): void {
  app.get("/health", async () => ({ status: "ok" }));
}
