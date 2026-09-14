"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPgPool = createPgPool;
exports.createDatabase = createDatabase;
exports.withPgTransaction = withPgTransaction;
exports.probeDatabase = probeDatabase;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const agentSchema = __importStar(require("./agent-schema"));
const connectorHealthSchema = __importStar(require("./connector-health-schema"));
const coreSchema = __importStar(require("./schema"));
const sourceSchema = __importStar(require("./source-schema"));
const sourceTaskSchema = __importStar(require("./source-task-schema"));
const sourceTransportAuditSchema = __importStar(require("./source-transport-audit-schema"));
const schema = {
    ...coreSchema,
    ...agentSchema,
    ...sourceSchema,
    ...sourceTaskSchema,
    ...connectorHealthSchema,
    ...sourceTransportAuditSchema,
};
function createPgPool(config) {
    return new pg_1.Pool({
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        ...config,
    });
}
function createDatabase(pool) {
    return (0, node_postgres_1.drizzle)(pool, { schema });
}
async function withPgTransaction(pool, work) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function probeDatabase(pool) {
    const result = await pool.query(`
    SELECT
      current_setting('server_version') AS server_version,
      current_setting('server_version_num') AS server_version_num,
      to_regclass('public.workspaces') IS NOT NULL
        AND to_regclass('public.users') IS NOT NULL
        AND to_regclass('public.workspace_memberships') IS NOT NULL
        AND to_regclass('public.permissions') IS NOT NULL
        AND to_regclass('public.workspace_roles') IS NOT NULL
        AND to_regclass('public.workspace_membership_roles') IS NOT NULL
        AND to_regclass('public.workspace_role_permissions') IS NOT NULL
        AND to_regclass('public.authorization_audit_events') IS NOT NULL
        AND to_regclass('public.job_runs') IS NOT NULL
        AND to_regclass('public.job_work_units') IS NOT NULL
        AND to_regclass('public.job_effects') IS NOT NULL
        AND to_regclass('public.agent_definitions') IS NOT NULL
        AND to_regclass('public.agent_context_receipts') IS NOT NULL
        AND to_regclass('public.agent_runs') IS NOT NULL
        AND to_regclass('public.agent_run_transitions') IS NOT NULL
        AND to_regclass('public.memory_records') IS NOT NULL
        AND to_regclass('public.memory_record_lifecycle_events') IS NOT NULL
        AND to_regclass('public.agent_eval_results') IS NOT NULL
        AND to_regclass('public.agent_execution_plans') IS NOT NULL
        AND to_regclass('public.source_capabilities') IS NOT NULL
        AND to_regclass('public.connector_policies') IS NOT NULL
        AND to_regclass('public.connector_definitions') IS NOT NULL
        AND to_regclass('public.source_admission_snapshots') IS NOT NULL
        AND to_regclass('public.research_job_preflights') IS NOT NULL
        AND to_regclass('public.source_tasks') IS NOT NULL
        AND to_regclass('public.source_task_usage_events') IS NOT NULL
        AND to_regclass('public.connector_health_snapshots') IS NOT NULL
        AND to_regclass('public.source_transport_audit_records') IS NOT NULL
        AS schema_ready
  `);
    const row = result.rows[0];
    if (!row)
        throw new Error('Database probe returned no rows.');
    return {
        serverVersion: row.server_version,
        serverMajor: Math.floor(Number(row.server_version_num) / 10_000),
        schemaReady: row.schema_ready,
    };
}
//# sourceMappingURL=client.js.map