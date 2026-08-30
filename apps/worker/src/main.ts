import { createServer } from 'node:http';
import { createPgPool } from '@brovexa/db';
import { parseQueueRedisUrl } from '@brovexa/queue';
import { createCanonicalWorkerRuntime } from './runtime';

async function bootstrap(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const queueRedisUrl = process.env.QUEUE_REDIS_URL;
  const host = process.env.HOST || '0.0.0.0';
  const workerPort = Number(process.env.WORKER_PORT || '3002');

  if (
    !databaseUrl ||
    !queueRedisUrl ||
    !Number.isInteger(workerPort) ||
    workerPort < 1 ||
    workerPort > 65535
  ) {
    throw new Error('Worker configuration is incomplete.');
  }

  const pool = createPgPool({ connectionString: databaseUrl, max: 5 });

  try {
    const runtime = await createCanonicalWorkerRuntime({
      pool,
      connection: parseQueueRedisUrl(queueRedisUrl),
      workerId: `worker-${process.pid}`,
      handlers: {
        'foundation.noop': async (context) => ({
          effectKey: 'foundation.noop.completed',
          effectData: { correlationId: context.correlationId },
        }),
      },
    });

    await runtime.reconcile();
    const reconcileTimer = setInterval(() => {
      void runtime.reconcile().catch(() => {
        console.error('Brovexa worker reconciliation failed.');
      });
    }, 5_000);

    const server = createServer(async (request, response) => {
      if (request.url === '/health') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ status: 'ok', service: 'brovexa-worker' }));
        return;
      }

      if (request.url === '/ready') {
        try {
          const readiness = await runtime.readiness();
          response.writeHead(readiness.ready ? 200 : 503, { 'content-type': 'application/json' });
          response.end(JSON.stringify(readiness));
        } catch {
          response.writeHead(503, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ ready: false }));
        }
        return;
      }

      response.writeHead(404).end();
    });

    let shuttingDown = false;
    async function shutdown(exitCode: number): Promise<void> {
      if (shuttingDown) return;
      shuttingDown = true;
      clearInterval(reconcileTimer);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await runtime.close();
      await pool.end();
      process.exit(exitCode);
    }

    process.on('SIGINT', () => { void shutdown(130); });
    process.on('SIGTERM', () => { void shutdown(143); });

    server.listen(workerPort, host);
  } catch (error) {
    await pool.end();
    throw error;
  }
}

bootstrap().catch(() => {
  console.error('Brovexa worker failed to start.');
  process.exitCode = 1;
});
