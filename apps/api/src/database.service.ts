import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { parseRuntimeEnvironment } from '@brovexa/config';
import { createPgPool, probeDatabase, type DatabaseProbe } from '@brovexa/db';

type DatabaseReadiness =
  | { configured: false }
  | { configured: true; ok: true; probe: DatabaseProbe }
  | { configured: true; ok: false };

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: ReturnType<typeof createPgPool> | null;

  constructor() {
    const runtime = parseRuntimeEnvironment(process.env);
    this.pool = runtime.DATABASE_URL
      ? createPgPool({ connectionString: runtime.DATABASE_URL, max: 5 })
      : null;
  }

  async readiness(): Promise<DatabaseReadiness> {
    if (!this.pool) return { configured: false };

    try {
      return { configured: true, ok: true, probe: await probeDatabase(this.pool) };
    } catch {
      return { configured: true, ok: false };
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
