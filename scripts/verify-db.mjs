import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  applyPendingMigrations,
  createDatabase,
  createPgPool,
  probeDatabase,
  rollbackLatestMigration,
  withPgTransaction,
  workspacePreferences,
  workspaces,
} from '../packages/db/dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for database integration verification.');
if (process.env.BROVEXA_DB_TEST_ALLOW_RESET !== 'true') {
  throw new Error('BROVEXA_DB_TEST_ALLOW_RESET=true is required for destructive test reset.');
}

const migrationsDir = resolve('packages/db/migrations');
const pool = createPgPool({ connectionString, max: 4 });
const db = createDatabase(pool);

const expectedMigrations = (await readdir(migrationsDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^\d{4}_.+\.up\.sql$/.test(entry.name))
  .map((entry) => entry.name.slice(0, -'.up.sql'.length))
  .sort();
assert.ok(expectedMigrations.length > 0, 'Expected at least one PostgreSQL migration.');
const latestExpectedMigration = expectedMigrations.at(-1);
assert.ok(latestExpectedMigration, 'Expected a latest PostgreSQL migration.');

const legacyVerifierMigrationCeiling = '0009_connector_execution_safety';
const legacyVerifierMigrationCeilingIndex = expectedMigrations.indexOf(legacyVerifierMigrationCeiling);
assert.ok(
  legacyVerifierMigrationCeilingIndex >= 0,
  `Expected legacy verifier migration ceiling ${legacyVerifierMigrationCeiling}.`,
);
const futureMigrationIds = new Set(expectedMigrations.slice(legacyVerifierMigrationCeilingIndex + 1));

function findPostgresError(error) {
  let current = error;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!current || typeof current !== 'object') return null;
    if (typeof current.code === 'string' && /^[0-9A-Z]{5}$/.test(current.code)) return current;
    current = current.cause;
  }
  return null;
}

function expectPostgresConstraint(expectedCode, expectedConstraint) {
  return (error) => {
    const postgresError = findPostgresError(error);
    assert.ok(postgresError, `Expected nested PostgreSQL error ${expectedCode}.`);
    assert.equal(postgresError.code, expectedCode);
    assert.equal(postgresError.constraint, expectedConstraint);
    return true;
  };
}

async function resetTestDatabase() {
  await pool.query('DROP TABLE IF EXISTS approved_business_contact_evidence');
  await pool.query('DROP TABLE IF EXISTS contact_data_eligibility_decisions');
  await pool.query('DROP TABLE IF EXISTS business_domain_verification_decisions');
  await pool.query('DROP TABLE IF EXISTS business_domain_evidence');
  await pool.query('ALTER TABLE IF EXISTS canonical_businesses DROP CONSTRAINT IF EXISTS canonical_businesses_origin_decision_fk');
  await pool.query('DROP TABLE IF EXISTS canonical_business_lineage_operations');
  await pool.query('DROP TABLE IF EXISTS canonical_business_aliases');
  await pool.query('DROP TABLE IF EXISTS business_resolution_decisions');
  await pool.query('DROP TABLE IF EXISTS candidate_business_match_evidence');
  await pool.query('DROP TABLE IF EXISTS source_business_observations');
  await pool.query('DROP TABLE IF EXISTS canonical_businesses');
  await pool.query('DROP TABLE IF EXISTS source_transport_audit_records CASCADE');
  await pool.query('DROP TABLE IF EXISTS connector_health_snapshots CASCADE');
  await pool.query('DROP TABLE IF EXISTS source_task_usage_events CASCADE');
  await pool.query('DROP TABLE IF EXISTS source_tasks CASCADE');
  await pool.query('DROP TABLE IF EXISTS research_job_preflights CASCADE');
  await pool.query('DROP TABLE IF EXISTS source_admission_snapshots CASCADE');
  await pool.query('DROP TABLE IF EXISTS connector_definitions CASCADE');
  await pool.query('DROP TABLE IF EXISTS connector_policies CASCADE');
  await pool.query('DROP TABLE IF EXISTS source_capabilities CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_execution_plans CASCADE');
  await pool.query('DROP TABLE IF EXISTS memory_record_lifecycle_events CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_run_transitions CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_eval_results CASCADE');
  await pool.query('DROP TABLE IF EXISTS memory_records CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_runs CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_context_receipts CASCADE');
  await pool.query('DROP TABLE IF EXISTS agent_definitions CASCADE');
  await pool.query('DROP TABLE IF EXISTS authorization_audit_events CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_membership_roles CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_role_permissions CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_roles CASCADE');
  await pool.query('DROP TABLE IF EXISTS permissions CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_memberships CASCADE');
  await pool.query('DROP TABLE IF EXISTS users CASCADE');
  await pool.query('DROP TABLE IF EXISTS job_effects CASCADE');
  await pool.query('DROP TABLE IF EXISTS job_checkpoints CASCADE');
  await pool.query('DROP TABLE IF EXISTS job_work_units CASCADE');
  await pool.query('DROP TABLE IF EXISTS job_runs CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspace_preferences CASCADE');
  await pool.query('DROP TABLE IF EXISTS workspaces CASCADE');
  await pool.query('DROP SCHEMA IF EXISTS brovexa_internal CASCADE');
}


function m03Ids(prefix) {
  return {
    business1: prefix + '-business-1',
    business2: prefix + '-business-2',
    businessNew: prefix + '-business-new',
    observation: prefix + '-observation',
    evidence: prefix + '-evidence',
    decision: prefix + '-decision',
    createDecision: prefix + '-create-decision',
    lineage: prefix + '-lineage',
  };
}

async function insertM03Base(client, workspaceId, prefix) {
  const ids = m03Ids(prefix);
  const observedAt = new Date('2026-09-21T12:00:00.000Z');
  const refs = ['ref-1'];
  const signals = [{ signalId: 'signal-1', sourceReferenceIds: refs, type: 'domain', value: 'example.test' }];

  await client.query(
    'INSERT INTO canonical_businesses (id, workspace_id, display_name) VALUES ($1, $2::uuid, $3), ($4, $2::uuid, $5)',
    [ids.business1, workspaceId, 'M03 Business One', ids.business2, 'M03 Business Two'],
  );
  await client.query(
    'INSERT INTO source_business_observations (id, workspace_id, source_candidate_id, source_key, observed_at, source_reference_ids, identity_signals, envelope) VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)',
    [
      ids.observation,
      workspaceId,
      prefix + '-source-candidate',
      'source.test',
      observedAt,
      JSON.stringify(refs),
      JSON.stringify(signals),
      JSON.stringify({
        version: '1.0.0',
        workspaceId,
        sourceObservationId: ids.observation,
        sourceCandidateId: prefix + '-source-candidate',
        sourceKey: 'source.test',
        observedAt: observedAt.toISOString(),
        sourceReferenceIds: refs,
        identitySignals: signals,
      }),
    ],
  );
  return { ids, observedAt, refs, signals };
}

async function insertM03Evidence(client, workspaceId, base, options = {}) {
  const evidenceId = options.evidenceId ?? base.ids.evidence;
  const method = options.method ?? 'deterministic';
  const inferenceRef = method === 'structured_ai' ? (options.inferenceRef ?? 'inference-test') : null;
  const effect = options.effect ?? 'supports_match';
  const confidence = options.confidence ?? 0.99;
  const signalIds = options.signalIds ?? ['signal-1'];
  const refs = options.refs ?? ['ref-1'];
  const recordedAt = new Date('2026-09-21T12:00:01.000Z');

  await client.query(
    'INSERT INTO candidate_business_match_evidence (id, workspace_id, source_observation_id, candidate_canonical_business_id, observation_signal_ids, source_reference_ids, method, inference_ref, effect, reason_code, confidence, recorded_at, envelope) VALUES ($1, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13::jsonb)',
    [
      evidenceId,
      workspaceId,
      base.ids.observation,
      base.ids.business1,
      JSON.stringify(signalIds),
      JSON.stringify(refs),
      method,
      inferenceRef,
      effect,
      effect === 'contradicts_match' ? 'domain.conflict' : 'domain.exact',
      confidence,
      recordedAt,
      JSON.stringify({
        evidenceId,
        workspaceId,
        sourceObservationId: base.ids.observation,
        candidateCanonicalBusinessId: base.ids.business1,
        observationSignalIds: signalIds,
        sourceReferenceIds: refs,
        method,
        inferenceRef,
        effect,
        reasonCode: effect === 'contradicts_match' ? 'domain.conflict' : 'domain.exact',
        confidence,
        recordedAt: recordedAt.toISOString(),
      }),
    ],
  );
  return evidenceId;
}

async function insertM03Decision(client, workspaceId, base, options = {}) {
  const decisionId = options.decisionId ?? base.ids.decision;
  const decision = options.decision ?? 'match_existing';
  const candidateId = decision === 'create_new' ? null : (options.candidateId ?? base.ids.business1);
  const confidence = options.confidence ?? 0.99;
  const reviewState = options.reviewState ?? 'not_required';
  const reviewDecisionRef = options.reviewDecisionRef ?? null;
  const evidenceIds = options.evidenceIds ?? [base.ids.evidence];
  const evaluatedAt = new Date('2026-09-21T12:00:02.000Z');
  const thresholdPolicy = { policyId: 'm03.default', version: '1.0.0', reviewMinimum: 0.7, autoMatchMinimum: 0.95 };
  const reasons = options.reasonCodes ?? ['domain.exact'];

  await client.query(
    'INSERT INTO business_resolution_decisions (id, workspace_id, source_observation_id, candidate_canonical_business_id, decision, confidence, review_state, review_decision_ref, reason_codes, evidence_ids, threshold_policy_id, threshold_policy_version, review_minimum, auto_match_minimum, evaluated_at, envelope) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16::jsonb)',
    [
      decisionId,
      workspaceId,
      base.ids.observation,
      candidateId,
      decision,
      confidence,
      reviewState,
      reviewDecisionRef,
      JSON.stringify(reasons),
      JSON.stringify(evidenceIds),
      thresholdPolicy.policyId,
      thresholdPolicy.version,
      thresholdPolicy.reviewMinimum,
      thresholdPolicy.autoMatchMinimum,
      evaluatedAt,
      JSON.stringify({
        decisionId,
        workspaceId,
        sourceObservationId: base.ids.observation,
        candidateCanonicalBusinessId: candidateId,
        decision,
        confidence,
        reviewState,
        reviewDecisionRef,
        reasonCodes: reasons,
        evidenceIds,
        thresholdPolicy,
        evaluatedAt: evaluatedAt.toISOString(),
      }),
    ],
  );
  return decisionId;
}

async function insertM03ValidGraph(client, workspaceId, prefix) {
  const base = await insertM03Base(client, workspaceId, prefix);
  await insertM03Evidence(client, workspaceId, base);
  await insertM03Decision(client, workspaceId, base);

  await client.query(
    'INSERT INTO canonical_business_aliases (source_observation_id, workspace_id, canonical_business_id, decision_id, attached_at) VALUES ($1, $2::uuid, $3, $4, $5)',
    [base.ids.observation, workspaceId, base.ids.business1, base.ids.decision, new Date('2026-09-21T12:00:03.000Z')],
  );

  await insertM03Decision(client, workspaceId, base, {
    decisionId: base.ids.createDecision,
    decision: 'create_new',
    reviewState: 'approved',
    reviewDecisionRef: prefix + '-review-approval',
  });
  await client.query(
    'INSERT INTO canonical_businesses (id, workspace_id, display_name, origin_decision_id) VALUES ($1, $2::uuid, $3, $4)',
    [base.ids.businessNew, workspaceId, 'M03 New Business', base.ids.createDecision],
  );

  await client.query(
    'INSERT INTO canonical_business_lineage_operations (id, workspace_id, operation_type, request_id, target_canonical_business_id, source_canonical_business_ids, restore_canonical_business_ids, parent_lineage_operation_id, evidence_ids, reason_codes, requested_by_actor_id, requested_at, review_request_id, review_state, reversible, envelope) VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb, $7::jsonb, NULL, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14, $15::jsonb)',
    [
      base.ids.lineage,
      workspaceId,
      'merge',
      prefix + '-merge-request',
      base.ids.business1,
      JSON.stringify([base.ids.business1, base.ids.business2]),
      JSON.stringify([]),
      JSON.stringify([base.ids.evidence]),
      JSON.stringify(['duplicate.business']),
      prefix + '-actor',
      new Date('2026-09-21T12:00:04.000Z'),
      prefix + '-review-request',
      'pending',
      true,
      JSON.stringify({ source: 'verify-db' }),
    ],
  );
  return base;
}

async function verifyM03EntityResolutionGuards(testPool, workspaceId) {
  await assert.rejects(
    withPgTransaction(testPool, async (client) => {
      const base = await insertM03ValidGraph(client, workspaceId, 'm03-valid');
      const counts = await client.query(
        'SELECT (SELECT count(*)::int FROM canonical_businesses WHERE workspace_id = $1::uuid) AS businesses, (SELECT count(*)::int FROM source_business_observations WHERE workspace_id = $1::uuid) AS observations, (SELECT count(*)::int FROM candidate_business_match_evidence WHERE workspace_id = $1::uuid) AS evidence, (SELECT count(*)::int FROM business_resolution_decisions WHERE workspace_id = $1::uuid) AS decisions, (SELECT count(*)::int FROM canonical_business_aliases WHERE workspace_id = $1::uuid) AS aliases, (SELECT count(*)::int FROM canonical_business_lineage_operations WHERE workspace_id = $1::uuid) AS lineage',
        [workspaceId],
      );
      assert.equal(counts.rows[0]?.businesses, 3);
      assert.equal(counts.rows[0]?.observations, 1);
      assert.equal(counts.rows[0]?.evidence, 1);
      assert.equal(counts.rows[0]?.decisions, 2);
      assert.equal(counts.rows[0]?.aliases, 1);
      assert.equal(counts.rows[0]?.lineage, 1);
      const origin = await client.query(
        'SELECT origin_decision_id FROM canonical_businesses WHERE id = $1 AND workspace_id = $2::uuid',
        [base.ids.businessNew, workspaceId],
      );
      assert.equal(origin.rows[0]?.origin_decision_id, base.ids.createDecision);
      throw new Error('m03-valid-rollback');
    }),
    /m03-valid-rollback/,
  );

  await assert.rejects(
    withPgTransaction(testPool, async (client) => {
      const base = await insertM03Base(client, workspaceId, 'm03-provenance');
      await insertM03Evidence(client, workspaceId, base, { refs: ['ref-outside'] });
    }),
    expectPostgresConstraint('23514', 'candidate_business_match_evidence_reference_guard'),
  );

  await assert.rejects(
    withPgTransaction(testPool, async (client) => {
      const base = await insertM03Base(client, workspaceId, 'm03-low-confidence');
      await insertM03Evidence(client, workspaceId, base);
      await insertM03Decision(client, workspaceId, base, { confidence: 0.8 });
    }),
    expectPostgresConstraint('23514', 'business_resolution_decisions_review_policy_guard'),
  );

  await assert.rejects(
    withPgTransaction(testPool, async (client) => {
      const base = await insertM03Base(client, workspaceId, 'm03-contradiction');
      await insertM03Evidence(client, workspaceId, base);
      const conflictingEvidence = base.ids.evidence + '-conflict';
      await insertM03Evidence(client, workspaceId, base, { evidenceId: conflictingEvidence, effect: 'contradicts_match' });
      await insertM03Decision(client, workspaceId, base, { evidenceIds: [base.ids.evidence, conflictingEvidence] });
    }),
    expectPostgresConstraint('23514', 'business_resolution_decisions_review_policy_guard'),
  );

  await assert.rejects(
    withPgTransaction(testPool, async (client) => {
      const base = await insertM03Base(client, workspaceId, 'm03-structured-ai');
      await insertM03Evidence(client, workspaceId, base, { method: 'structured_ai' });
      await insertM03Decision(client, workspaceId, base);
    }),
    expectPostgresConstraint('23514', 'business_resolution_decisions_review_policy_guard'),
  );

  await assert.rejects(
    withPgTransaction(testPool, async (client) => {
      const base = await insertM03Base(client, workspaceId, 'm03-alias-pending');
      await insertM03Evidence(client, workspaceId, base);
      const pendingDecision = await insertM03Decision(client, workspaceId, base, {
        decisionId: base.ids.decision + '-pending',
        decision: 'review_required',
        reviewState: 'pending',
      });
      await client.query(
        'INSERT INTO canonical_business_aliases (source_observation_id, workspace_id, canonical_business_id, decision_id, attached_at) VALUES ($1, $2::uuid, $3, $4, $5)',
        [base.ids.observation, workspaceId, base.ids.business1, pendingDecision, new Date('2026-09-21T12:00:05.000Z')],
      );
    }),
    expectPostgresConstraint('23514', 'canonical_business_aliases_decision_state_guard'),
  );

  await assert.rejects(
    withPgTransaction(testPool, async (client) => {
      const base = await insertM03Base(client, workspaceId, 'm03-lineage-evidence');
      await client.query(
        'INSERT INTO canonical_business_lineage_operations (id, workspace_id, operation_type, request_id, target_canonical_business_id, source_canonical_business_ids, restore_canonical_business_ids, evidence_ids, reason_codes, requested_by_actor_id, requested_at, review_request_id, review_state, reversible, envelope) VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14, $15::jsonb)',
        [
          base.ids.lineage,
          workspaceId,
          'merge',
          'm03-lineage-evidence-request',
          base.ids.business1,
          JSON.stringify([base.ids.business1, base.ids.business2]),
          JSON.stringify([]),
          JSON.stringify(['missing-evidence']),
          JSON.stringify(['duplicate.business']),
          'm03-actor',
          new Date('2026-09-21T12:00:06.000Z'),
          'm03-review',
          'pending',
          true,
          JSON.stringify({ source: 'verify-db' }),
        ],
      );
    }),
    expectPostgresConstraint('23514', 'canonical_business_lineage_operations_evidence_guard'),
  );

  const appendOnlyCases = [
    ['source_business_observations_append_only', 'UPDATE source_business_observations SET observed_at = observed_at WHERE id = $1', (base) => base.ids.observation],
    ['candidate_business_match_evidence_append_only', 'UPDATE candidate_business_match_evidence SET confidence = confidence WHERE id = $1', (base) => base.ids.evidence],
    ['business_resolution_decisions_append_only', 'UPDATE business_resolution_decisions SET confidence = confidence WHERE id = $1', (base) => base.ids.decision],
    ['canonical_business_aliases_append_only', 'DELETE FROM canonical_business_aliases WHERE source_observation_id = $1', (base) => base.ids.observation],
    ['canonical_business_lineage_operations_append_only', 'DELETE FROM canonical_business_lineage_operations WHERE id = $1', (base) => base.ids.lineage],
  ];
  for (let index = 0; index < appendOnlyCases.length; index += 1) {
    const [constraint, mutation, idFor] = appendOnlyCases[index];
    await assert.rejects(
      withPgTransaction(testPool, async (client) => {
        const base = await insertM03ValidGraph(client, workspaceId, 'm03-append-' + index);
        await client.query(mutation, [idFor(base)]);
      }),
      expectPostgresConstraint('23514', constraint),
    );
  }

  await assert.rejects(
    withPgTransaction(testPool, async (client) => {
      const base = await insertM03Base(client, workspaceId, 'm03-cross-fk');
      await insertM03Evidence(client, workspaceId, base);
      const otherWorkspace = await client.query(
        "INSERT INTO workspaces (slug, display_name) VALUES ('m03-cross-fk-other', 'M03 Cross FK Other') RETURNING id",
      );
      const otherWorkspaceId = otherWorkspace.rows[0]?.id;
      assert.ok(otherWorkspaceId);
      const other = await insertM03Base(client, otherWorkspaceId, 'm03-cross-fk-other');
      const recordedAt = new Date('2026-09-21T12:00:07.000Z');
      await client.query(
        'INSERT INTO candidate_business_match_evidence (id, workspace_id, source_observation_id, candidate_canonical_business_id, observation_signal_ids, source_reference_ids, method, inference_ref, effect, reason_code, confidence, recorded_at, envelope) VALUES ($1, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, $7, NULL, $8, $9, $10, $11, $12::jsonb)',
        [
          'm03-cross-tenant-evidence',
          otherWorkspaceId,
          other.ids.observation,
          base.ids.business1,
          JSON.stringify(['signal-1']),
          JSON.stringify(['ref-1']),
          'deterministic',
          'supports_match',
          'domain.exact',
          0.99,
          recordedAt,
          JSON.stringify({
            evidenceId: 'm03-cross-tenant-evidence',
            workspaceId: otherWorkspaceId,
            sourceObservationId: other.ids.observation,
            candidateCanonicalBusinessId: base.ids.business1,
            observationSignalIds: ['signal-1'],
            sourceReferenceIds: ['ref-1'],
            method: 'deterministic',
            inferenceRef: null,
            effect: 'supports_match',
            reasonCode: 'domain.exact',
            confidence: 0.99,
            recordedAt: recordedAt.toISOString(),
          }),
        ],
      );
    }),
    expectPostgresConstraint('23503', 'candidate_business_match_evidence_candidate_fk'),
  );

  await assert.rejects(
    withPgTransaction(testPool, async (client) => {
      const base = await insertM03Base(client, workspaceId, 'm03-cross-origin');
      await insertM03Evidence(client, workspaceId, base);
      await insertM03Decision(client, workspaceId, base, {
        decisionId: base.ids.createDecision,
        decision: 'create_new',
        reviewState: 'approved',
        reviewDecisionRef: 'm03-cross-origin-review',
      });
      const otherWorkspace = await client.query(
        "INSERT INTO workspaces (slug, display_name) VALUES ('m03-cross-origin-other', 'M03 Cross Origin Other') RETURNING id",
      );
      const otherWorkspaceId = otherWorkspace.rows[0]?.id;
      assert.ok(otherWorkspaceId);
      await client.query(
        'INSERT INTO canonical_businesses (id, workspace_id, display_name, origin_decision_id) VALUES ($1, $2::uuid, $3, $4)',
        ['m03-cross-origin-business', otherWorkspaceId, 'Cross Origin Business', base.ids.createDecision],
      );
    }),
    expectPostgresConstraint('23514', 'canonical_businesses_origin_decision_guard'),
  );
}

async function verifyM03EntityEnrichmentFreshnessGuards(testPool, workspaceId) {
  async function seedDomainEvidence(client, prefix, observedAt, refreshAfterSeconds) {
    const businessId = prefix + '-business';
    const evidenceId = prefix + '-evidence';
    await client.query(
      'INSERT INTO canonical_businesses (id, workspace_id, display_name) VALUES ($1, $2::uuid, $3)',
      [businessId, workspaceId, 'M03 Freshness Business'],
    );
    // 0015's malformed source-key regex is tracked in #154. Use its legacy-accepted
    // shape here only to isolate the 0016 freshness guard in this verifier.
    await client.query(
      `INSERT INTO business_domain_evidence
       (id, workspace_id, canonical_business_id, normalized_domain, kind, effect, source_key, source_reference_ids,
        source_policy_id, source_policy_version, source_admission_decision_ref, source_admission_decision, storage_class,
        retention_ttl_seconds, deletion_required, refresh_after_seconds, observed_at, recorded_at)
       VALUES ($1, $2::uuid, $3, 'example.test', 'official_website', 'supports_domain', 'source\\.test', $4::jsonb,
               'policy.public-web', '1.0.0', $5, 'allow', 'EVIDENCE_MINIMAL', 2592000, true, $6, $7, $7)`,
      [evidenceId, workspaceId, businessId, JSON.stringify([prefix + '-ref']), prefix + '-admission', refreshAfterSeconds, observedAt],
    );
    return { businessId, evidenceId };
  }

  async function insertVerifiedDecision(client, workspaceId, prefix, seed, method, evaluatedAt) {
    await client.query(
      `INSERT INTO business_domain_verification_decisions
       (id, workspace_id, canonical_business_id, normalized_domain, decision, method, confidence, evidence_ids,
        reason_codes, review_decision_ref, evaluated_at)
       VALUES ($1, $2::uuid, $3, 'example.test', 'verified', $4, 0.99, $5::jsonb, $6::jsonb, $7, $8)`,
      [
        prefix + '-verification',
        workspaceId,
        seed.businessId,
        method,
        JSON.stringify([seed.evidenceId]),
        JSON.stringify(['domain_independent_support']),
        method === 'human_review' ? prefix + '-review' : null,
        evaluatedAt,
      ],
    );
  }

  await assert.rejects(
    withPgTransaction(testPool, async (client) => {
      const seed = await seedDomainEvidence(
        client,
        'm03-freshness-stale',
        new Date('2026-09-22T00:00:00.000Z'),
        3600,
      );
      await insertVerifiedDecision(
        client,
        workspaceId,
        'm03-freshness-stale',
        seed,
        'deterministic',
        new Date('2026-09-22T02:00:00.000Z'),
      );
    }),
    expectPostgresConstraint('23514', 'business_domain_verification_decisions_freshness_guard'),
  );

  await assert.rejects(
    withPgTransaction(testPool, async (client) => {
      const seed = await seedDomainEvidence(
        client,
        'm03-freshness-future',
        new Date('2026-09-22T02:00:00.000Z'),
        3600,
      );
      await insertVerifiedDecision(
        client,
        workspaceId,
        'm03-freshness-future',
        seed,
        'human_review',
        new Date('2026-09-22T01:00:00.000Z'),
      );
    }),
    expectPostgresConstraint('23514', 'business_domain_verification_decisions_evidence_time_guard'),
  );

  await assert.rejects(
    withPgTransaction(testPool, async (client) => {
      const seed = await seedDomainEvidence(
        client,
        'm03-freshness-boundary',
        new Date('2026-09-22T00:00:00.000Z'),
        3600,
      );
      await insertVerifiedDecision(
        client,
        workspaceId,
        'm03-freshness-boundary',
        seed,
        'deterministic',
        new Date('2026-09-22T01:00:00.000Z'),
      );
      throw new Error('m03-freshness-boundary-allowed');
    }),
    /m03-freshness-boundary-allowed/,
  );

  await assert.rejects(
    withPgTransaction(testPool, async (client) => {
      const seed = await seedDomainEvidence(
        client,
        'm03-freshness-reviewed',
        new Date('2026-09-22T00:00:00.000Z'),
        3600,
      );
      await insertVerifiedDecision(
        client,
        workspaceId,
        'm03-freshness-reviewed',
        seed,
        'human_review',
        new Date('2026-09-22T02:00:00.000Z'),
      );
      throw new Error('m03-freshness-reviewed-allowed');
    }),
    /m03-freshness-reviewed-allowed/,
  );
}

try {
  const identity = await pool.query('SELECT current_database() AS name');
  const databaseName = identity.rows[0]?.name;
  assert.ok(databaseName?.endsWith('_test'), `Refusing destructive verification against database: ${databaseName}`);

  await resetTestDatabase();

  const applied = await applyPendingMigrations(pool, migrationsDir);
  assert.deepEqual(applied, expectedMigrations);

  const probe = await probeDatabase(pool);
  assert.equal(probe.serverMajor, 18, `Expected PostgreSQL 18.x, received ${probe.serverVersion}`);
  assert.equal(probe.schemaReady, true);

  const inserted = await db
    .insert(workspaces)
    .values({ slug: 'm01-verification', displayName: 'M01 Verification' })
    .returning({ id: workspaces.id });
  const workspaceId = inserted[0]?.id;
  assert.ok(workspaceId);

  await db.insert(workspacePreferences).values({ workspaceId, timezone: 'UTC', locale: 'en' });

  await assert.rejects(
    async () => {
      await db.insert(workspaces).values({ slug: 'm01-verification', displayName: 'Duplicate' });
    },
    expectPostgresConstraint('23505', 'workspaces_slug_unique'),
  );

  await assert.rejects(
    async () => {
      await db.insert(workspacePreferences).values({
        workspaceId: randomUUID(),
        timezone: 'UTC',
        locale: 'en',
      });
    },
    expectPostgresConstraint('23503', 'workspace_preferences_workspace_id_workspaces_id_fk'),
  );

  await assert.rejects(
    withPgTransaction(pool, async (client) => {
      await client.query(
        `INSERT INTO workspaces (slug, display_name) VALUES ('rollback-verification', 'Rollback Verification')`,
      );
      throw new Error('rollback-sentinel');
    }),
    /rollback-sentinel/,
  );
  const rolledBackRecord = await pool.query(
    `SELECT count(*)::int AS count FROM workspaces WHERE slug = 'rollback-verification'`,
  );
  assert.equal(rolledBackRecord.rows[0]?.count, 0);

  await verifyM03EntityResolutionGuards(pool, workspaceId);
  await verifyM03EntityEnrichmentFreshnessGuards(pool, workspaceId);

  await pool.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
  const preferenceCount = await pool.query(
    'SELECT count(*)::int AS count FROM workspace_preferences WHERE workspace_id = $1',
    [workspaceId],
  );
  assert.equal(preferenceCount.rows[0]?.count, 0);

  assert.equal(await rollbackLatestMigration(pool, migrationsDir), latestExpectedMigration);
  assert.deepEqual(await applyPendingMigrations(pool, migrationsDir), [latestExpectedMigration]);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  for (const migrationId of [...expectedMigrations].reverse()) {
    assert.equal(await rollbackLatestMigration(pool, migrationsDir), migrationId);
    if (migrationId === '0009_connector_execution_safety') {
      assert.equal((await probeDatabase(pool)).schemaReady, false);
    }
  }
  assert.equal((await probeDatabase(pool)).schemaReady, false);

  const afterRollback = await pool.query(`
    SELECT
      to_regclass('public.workspaces')::text AS workspaces,
      to_regclass('public.users')::text AS users,
      to_regclass('public.job_runs')::text AS job_runs,
      to_regclass('public.job_work_units')::text AS job_work_units,
      to_regclass('public.agent_definitions')::text AS agent_definitions,
      to_regclass('public.agent_context_receipts')::text AS agent_context_receipts,
      to_regclass('public.agent_runs')::text AS agent_runs,
      to_regclass('public.agent_run_transitions')::text AS agent_run_transitions,
      to_regclass('public.memory_records')::text AS memory_records,
      to_regclass('public.memory_record_lifecycle_events')::text AS memory_record_lifecycle_events,
      to_regclass('public.agent_eval_results')::text AS agent_eval_results,
      to_regclass('public.agent_execution_plans')::text AS agent_execution_plans,
      to_regclass('public.source_capabilities')::text AS source_capabilities,
      to_regclass('public.connector_policies')::text AS connector_policies,
      to_regclass('public.connector_definitions')::text AS connector_definitions,
      to_regclass('public.source_admission_snapshots')::text AS source_admission_snapshots,
      to_regclass('public.research_job_preflights')::text AS research_job_preflights,
      to_regclass('public.source_tasks')::text AS source_tasks,
      to_regclass('public.source_task_usage_events')::text AS source_task_usage_events,
      to_regclass('public.connector_health_snapshots')::text AS connector_health_snapshots,
      to_regclass('public.source_transport_audit_records')::text AS source_transport_audit_records
  `);
  assert.equal(afterRollback.rows[0]?.workspaces, null);
  assert.equal(afterRollback.rows[0]?.users, null);
  assert.equal(afterRollback.rows[0]?.job_runs, null);
  assert.equal(afterRollback.rows[0]?.job_work_units, null);
  assert.equal(afterRollback.rows[0]?.agent_definitions, null);
  assert.equal(afterRollback.rows[0]?.agent_context_receipts, null);
  assert.equal(afterRollback.rows[0]?.agent_runs, null);
  assert.equal(afterRollback.rows[0]?.agent_run_transitions, null);
  assert.equal(afterRollback.rows[0]?.memory_records, null);
  assert.equal(afterRollback.rows[0]?.memory_record_lifecycle_events, null);
  assert.equal(afterRollback.rows[0]?.agent_eval_results, null);
  assert.equal(afterRollback.rows[0]?.agent_execution_plans, null);
  assert.equal(afterRollback.rows[0]?.source_capabilities, null);
  assert.equal(afterRollback.rows[0]?.connector_policies, null);
  assert.equal(afterRollback.rows[0]?.connector_definitions, null);
  assert.equal(afterRollback.rows[0]?.source_admission_snapshots, null);
  assert.equal(afterRollback.rows[0]?.research_job_preflights, null);
  assert.equal(afterRollback.rows[0]?.source_tasks, null);
  assert.equal(afterRollback.rows[0]?.source_task_usage_events, null);
  assert.equal(afterRollback.rows[0]?.connector_health_snapshots, null);
  assert.equal(afterRollback.rows[0]?.source_transport_audit_records, null);

  const reapplied = await applyPendingMigrations(pool, migrationsDir);
  assert.deepEqual(reapplied, expectedMigrations);
  assert.equal((await probeDatabase(pool)).schemaReady, true);

  console.log('Brovexa PostgreSQL 18 migration/data-layer integration verification passed.');
} finally {
  await resetTestDatabase();
  await pool.end();
}

function extractCreatedTableNames(sqlText) {
  const tableNames = new Set();
  const createTablePattern = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"?public"?)\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi;
  for (const match of sqlText.matchAll(createTablePattern)) {
    tableNames.add(match[1]);
  }
  return [...tableNames];
}

function quotedIdentifier(identifier) {
  assert.match(identifier, /^[a-z_][a-z0-9_]*$/, `Unsafe PostgreSQL identifier: ${identifier}`);
  return `"${identifier}"`;
}

async function futureCreatedTableNames(futureMigrationFiles) {
  const names = new Set();
  for (const entry of futureMigrationFiles) {
    if (!entry.name.endsWith('.up.sql')) continue;
    const sqlText = await readFile(resolve(migrationsDir, entry.name), 'utf8');
    for (const tableName of extractCreatedTableNames(sqlText)) names.add(tableName);
  }
  return [...names].sort();
}

async function createLegacyReadinessPlaceholders(tableNames) {
  if (tableNames.length === 0) return async () => {};

  const compatibilityPool = createPgPool({ connectionString, max: 2 });
  const created = [];
  try {
    for (const tableName of tableNames) {
      const qualifiedName = `public.${tableName}`;
      const existing = await compatibilityPool.query('SELECT to_regclass($1)::text AS relation', [qualifiedName]);
      if (existing.rows[0]?.relation) continue;
      await compatibilityPool.query(
        `CREATE TABLE ${quotedIdentifier(tableName)} (__legacy_verifier_placeholder boolean NOT NULL DEFAULT true)`,
      );
      created.push(tableName);
    }
  } catch (error) {
    try {
      for (const tableName of [...created].reverse()) {
        await compatibilityPool.query(`DROP TABLE IF EXISTS ${quotedIdentifier(tableName)} CASCADE`);
      }
    } finally {
      await compatibilityPool.end();
    }
    throw error;
  }

  return async () => {
    try {
      for (const tableName of [...created].reverse()) {
        await compatibilityPool.query(`DROP TABLE IF EXISTS ${quotedIdentifier(tableName)} CASCADE`);
      }
    } finally {
      await compatibilityPool.end();
    }
  };
}

async function restoreQuarantinedMigrations(quarantineDir, futureMigrationFiles) {
  try {
    for (const entry of futureMigrationFiles) {
      await rename(resolve(quarantineDir, entry.name), resolve(migrationsDir, entry.name));
    }
  } finally {
    await rm(quarantineDir, { recursive: true, force: true });
  }
}

async function runLegacyPersistenceVerifierSuite() {
  const migrationEntries = await readdir(migrationsDir, { withFileTypes: true });
  const futureMigrationFiles = migrationEntries.filter((entry) => {
    if (!entry.isFile()) return false;
    const match = entry.name.match(/^(\d{4}_.+)\.(up|down)\.sql$/);
    return match ? futureMigrationIds.has(match[1]) : false;
  });

  if (futureMigrationFiles.length === 0) {
    await runLegacyPersistenceVerifiers();
    return;
  }

  const futureTableNames = await futureCreatedTableNames(futureMigrationFiles);
  const quarantineDir = await mkdtemp(resolve(migrationsDir, '.legacy-verification-'));
  let removeReadinessPlaceholders = async () => {};
  try {
    for (const entry of futureMigrationFiles) {
      await rename(resolve(migrationsDir, entry.name), resolve(quarantineDir, entry.name));
    }
    removeReadinessPlaceholders = await createLegacyReadinessPlaceholders(futureTableNames);
    await runLegacyPersistenceVerifiers();
  } finally {
    try {
      await removeReadinessPlaceholders();
    } finally {
      await restoreQuarantinedMigrations(quarantineDir, futureMigrationFiles);
    }
  }
}

async function runLegacyPersistenceVerifiers() {
  await import('./verify-agent-persistence.mjs');
  await import('./verify-memory-evaluation.mjs');
  await import('./verify-agent-memory-lifecycle.mjs');
  await import('./verify-agent-context-runtime.mjs');
  await import('./verify-agent-execution-plan.mjs');
  await import('./verify-agent-plan-dispatcher.mjs');
  await import('./verify-agent-execution-aggregation.mjs');
  await import('./verify-agent-evaluator-decision.mjs');
  await import('./verify-agent-runtime-hardening.mjs');
  await import('./verify-source-registry.mjs');
  await import('./verify-source-task-preflight.mjs');
  await import('./verify-connector-execution-safety.mjs');
}

await runLegacyPersistenceVerifierSuite();
