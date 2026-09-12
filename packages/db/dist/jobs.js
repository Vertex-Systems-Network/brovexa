"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCanonicalWork = createCanonicalWork;
exports.claimWorkUnit = claimWorkUnit;
exports.isWorkCancellationRequested = isWorkCancellationRequested;
exports.requestWorkCancellation = requestWorkCancellation;
exports.completeWorkUnitWithEffect = completeWorkUnitWithEffect;
exports.recordWorkFailure = recordWorkFailure;
exports.listRecoverableWorkUnits = listRecoverableWorkUnits;
exports.getWorkUnitStatus = getWorkUnitStatus;
exports.countWorkEffects = countWorkEffects;
const client_1 = require("./client");
async function createCanonicalWork(pool, input) {
    return (0, client_1.withPgTransaction)(pool, async (client) => {
        const insertedRun = await client.query(`INSERT INTO job_runs (
         workspace_id, job_type, job_version, idempotency_key
       ) VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, job_type, idempotency_key) DO NOTHING
       RETURNING id, correlation_id`, [input.workspaceId, input.jobType, input.jobVersion ?? 1, input.idempotencyKey]);
        let run = insertedRun.rows[0];
        const created = Boolean(run);
        if (!run) {
            const existing = await client.query(`SELECT id, correlation_id
         FROM job_runs
         WHERE workspace_id = $1 AND job_type = $2 AND idempotency_key = $3`, [input.workspaceId, input.jobType, input.idempotencyKey]);
            run = existing.rows[0];
            if (!run)
                throw new Error('Canonical job idempotency lookup failed.');
        }
        let workUnitId;
        if (created) {
            const insertedWork = await client.query(`INSERT INTO job_work_units (
           job_run_id, workspace_id, queue_name, work_type, work_version,
           idempotency_key, correlation_id, payload, max_attempts
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
         RETURNING id`, [
                run.id,
                input.workspaceId,
                input.queueName,
                input.workType,
                input.workVersion ?? 1,
                input.idempotencyKey,
                run.correlation_id,
                JSON.stringify(input.payload ?? {}),
                input.maxAttempts ?? 3,
            ]);
            workUnitId = insertedWork.rows[0]?.id;
        }
        else {
            const existingWork = await client.query(`SELECT id
         FROM job_work_units
         WHERE job_run_id = $1 AND work_type = $2 AND idempotency_key = $3`, [run.id, input.workType, input.idempotencyKey]);
            workUnitId = existingWork.rows[0]?.id;
        }
        if (!workUnitId)
            throw new Error('Canonical work-unit identity could not be resolved.');
        return {
            jobRunId: run.id,
            workUnitId,
            correlationId: run.correlation_id,
            created,
        };
    });
}
async function claimWorkUnit(pool, workUnitId, workerId, expectedAttempt, leaseSeconds = 30) {
    return (0, client_1.withPgTransaction)(pool, async (client) => {
        const claimed = await client.query(`UPDATE job_work_units
       SET status = 'running',
           attempt_count = $3,
           worker_id = $2,
           lease_expires_at = now() + ($4::integer * interval '1 second'),
           started_at = COALESCE(started_at, now()),
           next_attempt_at = NULL,
           updated_at = now()
       WHERE id = $1
         AND attempt_count = $3 - 1
         AND cancellation_requested_at IS NULL
         AND (
           status = 'runnable'
           OR (status = 'retry_wait' AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
           OR (status = 'running' AND lease_expires_at <= now())
         )
       RETURNING id, job_run_id, workspace_id, work_type, work_version,
                 correlation_id, payload, attempt_count, max_attempts`, [workUnitId, workerId, expectedAttempt, leaseSeconds]);
        const row = claimed.rows[0];
        if (!row)
            return null;
        await client.query(`UPDATE job_runs
       SET status = 'running', started_at = COALESCE(started_at, now()), updated_at = now()
       WHERE id = $1 AND status IN ('pending', 'running')`, [row.job_run_id]);
        return {
            id: row.id,
            jobRunId: row.job_run_id,
            workspaceId: row.workspace_id,
            workType: row.work_type,
            workVersion: row.work_version,
            correlationId: row.correlation_id,
            payload: row.payload,
            attemptCount: row.attempt_count,
            maxAttempts: row.max_attempts,
        };
    });
}
async function isWorkCancellationRequested(pool, workUnitId) {
    const result = await pool.query(`SELECT cancellation_requested_at IS NOT NULL AS requested
     FROM job_work_units WHERE id = $1`, [workUnitId]);
    return result.rows[0]?.requested ?? false;
}
async function requestWorkCancellation(pool, workUnitId) {
    return (0, client_1.withPgTransaction)(pool, async (client) => {
        const result = await client.query(`UPDATE job_work_units
       SET cancellation_requested_at = COALESCE(cancellation_requested_at, now()),
           status = CASE WHEN status IN ('runnable', 'retry_wait') THEN 'cancelled' ELSE status END,
           completed_at = CASE WHEN status IN ('runnable', 'retry_wait') THEN now() ELSE completed_at END,
           updated_at = now()
       WHERE id = $1 AND status NOT IN ('succeeded', 'cancelled', 'dead_letter', 'review')
       RETURNING status, job_run_id`, [workUnitId]);
        const row = result.rows[0];
        if (!row)
            return null;
        if (row.status === 'cancelled') {
            await client.query(`UPDATE job_runs
         SET status = 'cancelled', completed_at = now(), updated_at = now()
         WHERE id = $1`, [row.job_run_id]);
        }
        return row.status;
    });
}
async function completeWorkUnitWithEffect(pool, workUnitId, effectKey, effectData) {
    return (0, client_1.withPgTransaction)(pool, async (client) => {
        const effect = await client.query(`INSERT INTO job_effects (work_unit_id, effect_key, data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (work_unit_id, effect_key) DO NOTHING
       RETURNING id`, [workUnitId, effectKey, JSON.stringify(effectData)]);
        const completed = await client.query(`UPDATE job_work_units
       SET status = 'succeeded', completed_at = now(), lease_expires_at = NULL,
           worker_id = NULL, last_error_code = NULL, last_error_class = NULL,
           updated_at = now()
       WHERE id = $1 AND status = 'running'
       RETURNING job_run_id`, [workUnitId]);
        const row = completed.rows[0];
        if (!row)
            throw new Error('Work unit was not running during completion.');
        const pending = await client.query(`SELECT count(*)::int AS count
       FROM job_work_units
       WHERE job_run_id = $1 AND status <> 'succeeded'`, [row.job_run_id]);
        if ((pending.rows[0]?.count ?? 1) === 0) {
            await client.query(`UPDATE job_runs
         SET status = 'succeeded', completed_at = now(), updated_at = now()
         WHERE id = $1`, [row.job_run_id]);
        }
        return { effectCreated: Boolean(effect.rows[0]) };
    });
}
async function recordWorkFailure(pool, workUnitId, errorClass, errorCode, retryDelayMs = 0) {
    return (0, client_1.withPgTransaction)(pool, async (client) => {
        const current = await client.query(`SELECT job_run_id, attempt_count, max_attempts, cancellation_requested_at
       FROM job_work_units
       WHERE id = $1
       FOR UPDATE`, [workUnitId]);
        const row = current.rows[0];
        if (!row)
            throw new Error('Work unit not found while recording failure.');
        let status;
        let nextAttemptAt = null;
        if (errorClass === 'cancelled' || row.cancellation_requested_at) {
            status = 'cancelled';
        }
        else if (errorClass === 'permanent') {
            status = 'review';
        }
        else if (row.attempt_count < row.max_attempts) {
            status = 'retry_wait';
            nextAttemptAt = new Date(Date.now() + Math.max(0, retryDelayMs));
        }
        else {
            status = 'dead_letter';
        }
        await client.query(`UPDATE job_work_units
       SET status = $2,
           next_attempt_at = $3,
           completed_at = CASE WHEN $2 IN ('cancelled', 'dead_letter', 'review') THEN now() ELSE NULL END,
           lease_expires_at = NULL,
           worker_id = NULL,
           last_error_code = $4,
           last_error_class = $5,
           updated_at = now()
       WHERE id = $1`, [workUnitId, status, nextAttemptAt, errorCode, errorClass]);
        if (status === 'dead_letter') {
            await client.query(`UPDATE job_runs SET status = 'failed', completed_at = now(), updated_at = now() WHERE id = $1`, [row.job_run_id]);
        }
        else if (status === 'review') {
            await client.query(`UPDATE job_runs SET status = 'review', completed_at = now(), updated_at = now() WHERE id = $1`, [row.job_run_id]);
        }
        else if (status === 'cancelled') {
            await client.query(`UPDATE job_runs SET status = 'cancelled', completed_at = now(), updated_at = now() WHERE id = $1`, [row.job_run_id]);
        }
        return {
            status,
            attemptCount: row.attempt_count,
            maxAttempts: row.max_attempts,
            nextAttemptAt,
        };
    });
}
async function listRecoverableWorkUnits(pool) {
    const result = await pool.query(`SELECT id, correlation_id, attempt_count, next_attempt_at
     FROM job_work_units
     WHERE cancellation_requested_at IS NULL
       AND (
         status = 'runnable'
         OR (status = 'retry_wait' AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
         OR (status = 'running' AND lease_expires_at <= now())
       )
     ORDER BY created_at ASC, id ASC`);
    return result.rows.map((row) => ({
        id: row.id,
        correlationId: row.correlation_id,
        attemptCount: row.attempt_count,
        nextAttemptAt: row.next_attempt_at,
    }));
}
async function getWorkUnitStatus(pool, workUnitId) {
    const result = await pool.query('SELECT status, attempt_count, max_attempts FROM job_work_units WHERE id = $1', [workUnitId]);
    const row = result.rows[0];
    return row
        ? { status: row.status, attemptCount: row.attempt_count, maxAttempts: row.max_attempts }
        : null;
}
async function countWorkEffects(pool, workUnitId) {
    const result = await pool.query('SELECT count(*)::int AS count FROM job_effects WHERE work_unit_id = $1', [workUnitId]);
    return result.rows[0]?.count ?? 0;
}
//# sourceMappingURL=jobs.js.map