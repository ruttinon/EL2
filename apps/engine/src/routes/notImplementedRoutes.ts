import type { FastifyInstance } from 'fastify';

const notImplemented = (scope: string) => ({
  statusCode: 501,
  message: `${scope} is not implemented in Phase 26. No generated runtime data is included.`,
  runtimeSource: 'not_present'
});

export async function registerNotImplementedRoutes(app: FastifyInstance) {
}
