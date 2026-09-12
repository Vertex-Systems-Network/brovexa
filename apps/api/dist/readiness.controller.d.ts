import type { ReadinessResponse } from '@brovexa/contracts';
import { DatabaseService } from './database.service';
export declare class ReadinessController {
    private readonly database;
    constructor(database: DatabaseService);
    getReadiness(): Promise<ReadinessResponse>;
}
