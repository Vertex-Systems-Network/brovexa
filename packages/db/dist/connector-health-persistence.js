"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectorHealthPersistenceError = void 0;
exports.persistConnectorHealthSnapshot = persistConnectorHealthSnapshot;
exports.getLatestConnectorHealthSnapshot = getLatestConnectorHealthSnapshot;
const source_registry_persistence_1 = require("./source-registry-persistence");
const connectorKeyPattern = /^connector\.[a-z0-9_.-]+$/;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const reasonCodePattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
class ConnectorHealthPersistenceError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'ConnectorHealthPersistenceError';
        this.code = code;
    }
}
exports.ConnectorHealthPersistenceError = ConnectorHealthPersistenceError;
function inputError(message) {
    return new ConnectorHealthPersistenceError('CONNECTOR_HEALTH_INPUT_INVALID', message);
}
function assertIdentifier(value, field, pattern = identifierPattern) {
    if (typeof value !== 'string' || !pattern.test(value))
        throw inputError(`${field} must use the canonical identifier format.`);
}
function assertVersion(value, field) {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > 64) {
        throw inputError(`${field} must be a non-empty version no longer than 64 characters.`);
    }
}
function assertDate(value, field) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime()))
        throw inputError(`${field} must be a valid Date.`);
}
function assertNullableSafeInteger(value, field) {
    if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
        throw inputError(`${field} must be null or a non-negative safe integer.`);
    }
}
function normalizeReasonCodes(values) {
    if (!Array.isArray(values) || values.length > 64)
        throw inputError('reasonCodes must contain at most 64 values.');
    const normalized = values.map((value) => {
        assertIdentifier(value, 'reasonCodes', reasonCodePattern);
        return value;
    });
    if (new Set(normalized).size !== normalized.length)
        throw inputError('reasonCodes must not contain duplicates.');
    return normalized;
}
function normalizeInput(input) {
    assertIdentifier(input.id, 'id');
    assertIdentifier(input.connectorKey, 'connectorKey', connectorKeyPattern);
    assertVersion(input.connectorVersion, 'connectorVersion');
    assertDate(input.observedAt, 'observedAt');
    assertNullableSafeInteger(input.quotaRemaining, 'quotaRemaining');
    assertNullableSafeInteger(input.p95LatencyMs, 'p95LatencyMs');
    if (!Number.isFinite(input.rollingErrorRate) || input.rollingErrorRate < 0 || input.rollingErrorRate > 1) {
        throw inputError('rollingErrorRate must be a finite number between 0 and 1.');
    }
    return { ...input, reasonCodes: normalizeReasonCodes(input.reasonCodes) };
}
function rowToSnapshot(row) {
    const quotaRemaining = row.quota_remaining === null ? null : Number(row.quota_remaining);
    const p95LatencyMs = row.p95_latency_ms === null ? null : Number(row.p95_latency_ms);
    if ((quotaRemaining !== null && !Number.isSafeInteger(quotaRemaining)) ||
        (p95LatencyMs !== null && !Number.isSafeInteger(p95LatencyMs))) {
        throw new ConnectorHealthPersistenceError('CONNECTOR_HEALTH_INPUT_INVALID', `Connector health snapshot ${row.id} contains an integer outside the JavaScript safe range.`);
    }
    return {
        id: row.id,
        connectorDefinitionId: row.connector_definition_id,
        connectorKey: row.connector_key,
        connectorVersion: row.connector_version,
        status: row.status,
        observedAt: row.observed_at,
        quotaRemaining,
        rollingErrorRate: row.rolling_error_rate,
        p95LatencyMs,
        reasonCodes: row.reason_codes,
        envelope: row.envelope,
        createdAt: row.created_at,
    };
}
async function persistConnectorHealthSnapshot(pool, rawInput) {
    const input = normalizeInput(rawInput);
    const registry = await (0, source_registry_persistence_1.resolveConnectorRegistryEntry)(pool, {
        connectorKey: input.connectorKey,
        connectorVersion: input.connectorVersion,
    });
    if (!registry) {
        throw new ConnectorHealthPersistenceError('CONNECTOR_HEALTH_REGISTRY_NOT_FOUND', `Connector ${input.connectorKey}@${input.connectorVersion} is not registered.`);
    }
    const envelope = {
        connectorKey: input.connectorKey,
        connectorVersion: input.connectorVersion,
        status: input.status,
        observedAt: input.observedAt.toISOString(),
        quotaRemaining: input.quotaRemaining,
        rollingErrorRate: input.rollingErrorRate,
        p95LatencyMs: input.p95LatencyMs,
        reasonCodes: input.reasonCodes,
    };
    const inserted = await pool.query(`INSERT INTO connector_health_snapshots (
       id, connector_definition_id, connector_key, connector_version, status,
       observed_at, quota_remaining, rolling_error_rate, p95_latency_ms, reason_codes, envelope
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
     ON CONFLICT (id) DO NOTHING
     RETURNING id, connector_definition_id, connector_key, connector_version, status,
               observed_at, quota_remaining::text, rolling_error_rate, p95_latency_ms::text,
               reason_codes, envelope, created_at`, [
        input.id,
        registry.connectorDefinitionId,
        input.connectorKey,
        input.connectorVersion,
        input.status,
        input.observedAt,
        input.quotaRemaining,
        input.rollingErrorRate,
        input.p95LatencyMs,
        JSON.stringify(input.reasonCodes),
        JSON.stringify(envelope),
    ]);
    const insertedRow = inserted.rows[0];
    if (insertedRow)
        return { created: true, snapshot: rowToSnapshot(insertedRow) };
    const existing = await pool.query(`SELECT id, connector_definition_id, connector_key, connector_version, status,
            observed_at, quota_remaining::text, rolling_error_rate, p95_latency_ms::text,
            reason_codes, envelope, created_at,
            connector_definition_id = $2::uuid
              AND connector_key = $3
              AND connector_version = $4
              AND status = $5
              AND observed_at = $6::timestamptz
              AND quota_remaining IS NOT DISTINCT FROM $7::bigint
              AND rolling_error_rate = $8::double precision
              AND p95_latency_ms IS NOT DISTINCT FROM $9::bigint
              AND reason_codes = $10::jsonb
              AND envelope = $11::jsonb AS same_snapshot
     FROM connector_health_snapshots
     WHERE id = $1`, [
        input.id,
        registry.connectorDefinitionId,
        input.connectorKey,
        input.connectorVersion,
        input.status,
        input.observedAt,
        input.quotaRemaining,
        input.rollingErrorRate,
        input.p95LatencyMs,
        JSON.stringify(input.reasonCodes),
        JSON.stringify(envelope),
    ]);
    const existingRow = existing.rows[0];
    if (!existingRow?.same_snapshot) {
        throw new ConnectorHealthPersistenceError('CONNECTOR_HEALTH_ID_CONFLICT', `Connector health snapshot ${input.id} already exists with different content.`);
    }
    return { created: false, snapshot: rowToSnapshot(existingRow) };
}
async function getLatestConnectorHealthSnapshot(pool, input) {
    assertIdentifier(input.connectorKey, 'connectorKey', connectorKeyPattern);
    assertVersion(input.connectorVersion, 'connectorVersion');
    const result = await pool.query(`SELECT id, connector_definition_id, connector_key, connector_version, status,
            observed_at, quota_remaining::text, rolling_error_rate, p95_latency_ms::text,
            reason_codes, envelope, created_at
     FROM connector_health_snapshots
     WHERE connector_key = $1 AND connector_version = $2
     ORDER BY observed_at DESC, created_at DESC, id DESC
     LIMIT 1`, [input.connectorKey, input.connectorVersion]);
    const row = result.rows[0];
    return row ? rowToSnapshot(row) : null;
}
//# sourceMappingURL=connector-health-persistence.js.map