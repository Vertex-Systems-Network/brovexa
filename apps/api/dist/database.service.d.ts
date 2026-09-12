import { type OnModuleDestroy } from '@nestjs/common';
import { type DatabaseProbe } from '@brovexa/db';
type DatabaseReadiness = {
    configured: false;
} | {
    configured: true;
    ok: true;
    probe: DatabaseProbe;
} | {
    configured: true;
    ok: false;
};
export declare class DatabaseService implements OnModuleDestroy {
    private readonly pool;
    constructor();
    readiness(): Promise<DatabaseReadiness>;
    onModuleDestroy(): Promise<void>;
}
export {};
