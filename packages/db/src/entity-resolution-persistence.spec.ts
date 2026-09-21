import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  EntityResolutionPersistenceError,
  persistBusinessResolutionDecision,
  persistCandidateBusinessMatchEvidence,
  persistCanonicalBusiness,
  persistCanonicalBusinessAlias,
  persistCanonicalBusinessLineageOperation,
  persistSourceBusinessObservation,
} from './entity-resolution-persistence';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const observedAt = new Date('2026-09-21T10:00:00.000Z');
const evaluatedAt = new Date('2026-09-21T10:01:00.000Z');
const thresholdPolicy = {
  policyId: 'entity-resolution-default',
  version: '1.0.0',
  reviewMinimum: 0.6,
  autoMatchMinimum: 0.9,
} as const;

function poolWith(query: ReturnType<typeof vi.fn>): Pool {
  return { query } as unknown as Pool;
}

function observationInput() {
  return {
    workspaceId,
    sourceObservationId: 'obs-1',
    sourceCandidateId: 'candidate-1',
    sourceKey: 'source.registry',
    observedAt,
    sourceReferenceIds: ['ref-1'],
    identitySignals: [
      {
        signalId: 'signal-1',
        kind: 'business_name',
        rawValue: 'Example Incorporated',
        normalizedValue: 'example incorporated',
        normalizationVersion: '1.0.0',
        sourceScope: null,
        sourceReferenceIds: ['ref-1'],
      },
    ],
  } as const;
}

describe('M03 entity-resolution persistence', () => {
  it('persists canonical businesses with workspace-scoped durable identity', async () => {
    const createdAt = new Date('2026-09-21T10:00:01.000Z');
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          id: 'business-1',
          workspace_id: workspaceId,
          display_name: 'Example Incorporated',
          identity_state: 'active',
          superseded_by_canonical_business_id: null,
          created_at: createdAt,
        },
      ],
    });

    const result = await persistCanonicalBusiness(poolWith(query), {
      id: 'business-1',
      workspaceId,
      displayName: 'Example Incorporated',
    });

    expect(result.created).toBe(true);
    expect(result.record).toMatchObject({
      id: 'business-1',
      workspaceId,
      identityState: 'active',
      supersededByCanonicalBusinessId: null,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('workspace_id'),
      ['business-1', workspaceId, 'Example Incorporated', 'active', null, null],
    );
  });

  it('treats exact observation replay as idempotent and rejects provenance escape before SQL', async () => {
    const input = observationInput();
    const row = {
      id: input.sourceObservationId,
      workspace_id: workspaceId,
      source_candidate_id: input.sourceCandidateId,
      source_key: input.sourceKey,
      observed_at: observedAt,
      source_reference_ids: [...input.sourceReferenceIds],
      identity_signals: input.identitySignals.map((signal) => ({ ...signal })),
      envelope: {
        version: '1.0.0',
        workspaceId,
        sourceObservationId: input.sourceObservationId,
        sourceCandidateId: input.sourceCandidateId,
        sourceKey: input.sourceKey,
        observedAt: observedAt.toISOString(),
        sourceReferenceIds: [...input.sourceReferenceIds],
        identitySignals: input.identitySignals.map((signal) => ({ ...signal })),
      },
      created_at: new Date('2026-09-21T10:00:02.000Z'),
    };
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [row] });

    const replay = await persistSourceBusinessObservation(poolWith(query), input);
    expect(replay.created).toBe(false);
    expect(replay.record.sourceObservationId).toBe('obs-1');

    const invalidQuery = vi.fn();
    await expect(
      persistSourceBusinessObservation(poolWith(invalidQuery), {
        ...input,
        identitySignals: [
          {
            ...input.identitySignals[0],
            sourceReferenceIds: ['ref-outside-observation'],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(EntityResolutionPersistenceError);
    expect(invalidQuery).not.toHaveBeenCalled();
  });

  it('binds candidate evidence to persisted observation signals and their provenance', async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          source_reference_ids: ['ref-1'],
          identity_signals: [
            {
              signalId: 'signal-1',
              sourceReferenceIds: ['ref-1'],
            },
          ],
        },
      ],
    });

    await expect(
      persistCandidateBusinessMatchEvidence(poolWith(query), {
        evidenceId: 'evidence-bad-ref',
        workspaceId,
        sourceObservationId: 'obs-1',
        candidateCanonicalBusinessId: 'business-1',
        observationSignalIds: ['signal-1'],
        sourceReferenceIds: ['ref-2'],
        method: 'deterministic',
        inferenceRef: null,
        effect: 'supports_match',
        reasonCode: 'domain.exact',
        confidence: 0.99,
        recordedAt: evaluatedAt,
      }),
    ).rejects.toMatchObject({ code: 'MATCH_EVIDENCE_ID_CONFLICT' });

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('requires explicit approval for low-confidence, contradictory or structured-AI-assisted matches', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'evidence-ai',
            candidate_canonical_business_id: 'business-1',
            effect: 'supports_match',
            method: 'structured_ai',
            confidence: 0.95,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            candidate_canonical_business_id: 'business-1',
            effect: 'supports_match',
            method: 'structured_ai',
            confidence: 0.95,
          },
        ],
      });

    await expect(
      persistBusinessResolutionDecision(poolWith(query), {
        decisionId: 'decision-ai',
        workspaceId,
        sourceObservationId: 'obs-1',
        candidateCanonicalBusinessId: 'business-1',
        decision: 'match_existing',
        confidence: 0.95,
        reviewState: 'not_required',
        reviewDecisionRef: null,
        reasonCodes: ['ai.support'],
        evidenceIds: ['evidence-ai'],
        thresholdPolicy,
        evaluatedAt,
      }),
    ).rejects.toMatchObject({ code: 'RESOLUTION_DECISION_EVIDENCE_INVALID' });

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('requires decision evidence from the same observation and selected canonical candidate', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'evidence-1',
            candidate_canonical_business_id: 'business-1',
            effect: 'supports_match',
            method: 'deterministic',
            confidence: 0.99,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            candidate_canonical_business_id: 'business-1',
            effect: 'supports_match',
            method: 'deterministic',
            confidence: 0.99,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'decision-1',
            workspace_id: workspaceId,
            source_observation_id: 'obs-1',
            candidate_canonical_business_id: 'business-1',
            decision: 'match_existing',
            confidence: 0.99,
            review_state: 'not_required',
            review_decision_ref: null,
            reason_codes: ['domain.exact'],
            evidence_ids: ['evidence-1'],
            threshold_policy_id: thresholdPolicy.policyId,
            threshold_policy_version: thresholdPolicy.version,
            review_minimum: thresholdPolicy.reviewMinimum,
            auto_match_minimum: thresholdPolicy.autoMatchMinimum,
            evaluated_at: evaluatedAt,
            created_at: new Date('2026-09-21T10:01:01.000Z'),
          },
        ],
      });

    const result = await persistBusinessResolutionDecision(poolWith(query), {
      decisionId: 'decision-1',
      workspaceId,
      sourceObservationId: 'obs-1',
      candidateCanonicalBusinessId: 'business-1',
      decision: 'match_existing',
      confidence: 0.99,
      reviewState: 'not_required',
      reviewDecisionRef: null,
      reasonCodes: ['domain.exact'],
      evidenceIds: ['evidence-1'],
      thresholdPolicy,
      evaluatedAt,
    });

    expect(result.created).toBe(true);
    expect(query.mock.calls[0]?.[0]).toContain('workspace_id = $1::uuid');
    expect(query.mock.calls[0]?.[0]).toContain('source_observation_id = $2');

    const badEvidenceQuery = vi.fn().mockResolvedValueOnce({ rows: [] });
    await expect(
      persistBusinessResolutionDecision(poolWith(badEvidenceQuery), {
        decisionId: 'decision-2',
        workspaceId,
        sourceObservationId: 'obs-1',
        candidateCanonicalBusinessId: 'business-1',
        decision: 'match_existing',
        confidence: 0.99,
        reviewState: 'not_required',
        reviewDecisionRef: null,
        reasonCodes: ['domain.exact'],
        evidenceIds: ['evidence-missing'],
        thresholdPolicy,
        evaluatedAt,
      }),
    ).rejects.toMatchObject({ code: 'RESOLUTION_DECISION_EVIDENCE_INVALID' });
  });

  it('blocks alias attachment from pending review and keeps workspace in every decision lookup', async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          source_observation_id: 'obs-1',
          candidate_canonical_business_id: 'business-1',
          decision: 'review_required',
          review_state: 'pending',
          origin_decision_id: null,
        },
      ],
    });

    await expect(
      persistCanonicalBusinessAlias(poolWith(query), {
        workspaceId,
        sourceObservationId: 'obs-1',
        canonicalBusinessId: 'business-1',
        decisionId: 'decision-review',
        attachedAt: evaluatedAt,
      }),
    ).rejects.toMatchObject({ code: 'CANONICAL_ALIAS_DECISION_INVALID' });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('decision.workspace_id = $2::uuid'), [
      'decision-review',
      workspaceId,
      'business-1',
    ]);
  });

  it('binds create_new aliases only to canonical businesses created by the same decision', async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          source_observation_id: 'obs-1',
          candidate_canonical_business_id: null,
          decision: 'create_new',
          review_state: 'not_required',
          origin_decision_id: 'different-decision',
        },
      ],
    });

    await expect(
      persistCanonicalBusinessAlias(poolWith(query), {
        workspaceId,
        sourceObservationId: 'obs-1',
        canonicalBusinessId: 'business-new',
        decisionId: 'decision-create',
        attachedAt: evaluatedAt,
      }),
    ).rejects.toMatchObject({ code: 'CANONICAL_ALIAS_DECISION_INVALID' });
  });

  it('requires every lineage identity and split parent to belong to the same workspace', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ id: 'business-1' }] });

    await expect(
      persistCanonicalBusinessLineageOperation(poolWith(query), {
        operationId: 'lineage-1',
        workspaceId,
        operationType: 'merge',
        requestId: 'merge-request-1',
        targetCanonicalBusinessId: 'business-1',
        sourceCanonicalBusinessIds: ['business-1', 'business-2'],
        evidenceIds: ['evidence-1'],
        reasonCodes: ['duplicate.business'],
        requestedByActorId: 'actor-1',
        requestedAt: evaluatedAt,
        reviewRequestId: 'review-1',
      }),
    ).rejects.toMatchObject({ code: 'LINEAGE_ENTITY_NOT_FOUND' });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain('workspace_id = $1::uuid');
  });
});

describe('0014 canonical entity-resolution migration contract', () => {
  it('enforces tenant binding, append-only evidence and reversible lineage storage', async () => {
    const migration = await readFile(
      resolve(process.cwd(), 'migrations/0014_canonical_entity_resolution_persistence.up.sql'),
      'utf8',
    );
    const rollback = await readFile(
      resolve(process.cwd(), 'migrations/down/0014_canonical_entity_resolution_persistence.down.sql'),
      'utf8',
    );

    for (const table of [
      'canonical_businesses',
      'source_business_observations',
      'candidate_business_match_evidence',
      'business_resolution_decisions',
      'canonical_business_aliases',
      'canonical_business_lineage_operations',
    ]) {
      expect(migration).toContain(`CREATE TABLE ${table}`);
      expect(rollback).toContain(`DROP TABLE IF EXISTS ${table}`);
    }

    expect(migration).toContain('FOREIGN KEY (source_observation_id, workspace_id)');
    expect(migration).toContain('FOREIGN KEY (candidate_canonical_business_id, workspace_id)');
    expect(migration).toContain('FOREIGN KEY (canonical_business_id, workspace_id)');
    expect(migration).toContain('FOREIGN KEY (parent_lineage_operation_id, workspace_id)');
    expect(migration).toContain('source_business_observations_append_only');
    expect(migration).toContain('candidate_business_match_evidence_append_only');
    expect(migration).toContain('business_resolution_decisions_append_only');
    expect(migration).toContain('canonical_business_lineage_operations_append_only');
    expect(migration).toContain('canonical_business_aliases_decision_state_guard');
    expect(migration).toContain('canonical_business_aliases_origin_decision_guard');
    expect(migration).toContain('candidate_business_match_evidence_provenance_guard');
    expect(migration).toContain('business_resolution_decisions_review_policy_guard');
    expect(migration).toContain('canonical_business_lineage_operations_evidence_guard');
    expect(migration).toContain('threshold_policy_id text NOT NULL');
    expect(migration).toContain("operation_type = 'split'");
    expect(migration).toContain('reversible boolean NOT NULL DEFAULT true');
    expect(migration).not.toContain('http://');
    expect(migration).not.toContain('https://');
  });

  it('rejects duplicate migration objects and enforces rollback plus schema parity guards', async () => {
    const migration = await readFile(
      resolve(process.cwd(), 'migrations/0014_canonical_entity_resolution_persistence.up.sql'),
      'utf8',
    );
    const rollback = await readFile(
      resolve(process.cwd(), 'migrations/down/0014_canonical_entity_resolution_persistence.down.sql'),
      'utf8',
    );
    const schema = await readFile(resolve(process.cwd(), 'src/entity-resolution-schema.ts'), 'utf8');

    const expectedTables = [
      'canonical_businesses',
      'source_business_observations',
      'candidate_business_match_evidence',
      'business_resolution_decisions',
      'canonical_business_aliases',
      'canonical_business_lineage_operations',
    ];
    for (const table of expectedTables) {
      expect(migration.split('CREATE TABLE ' + table + ' (')).toHaveLength(2);
    }

    const indexes = [...migration.matchAll(/CREATE INDEX ([a-z0-9_]+)/g)].map((match) => match[1]);
    const functions = [...migration.matchAll(/CREATE OR REPLACE FUNCTION ([a-z0-9_.]+)/g)].map((match) => match[1]);
    const triggers = [...migration.matchAll(/CREATE TRIGGER ([a-z0-9_]+)/g)].map((match) => match[1]);
    expect(indexes).toHaveLength(7);
    expect(new Set(indexes).size).toBe(7);
    expect(functions).toHaveLength(6);
    expect(new Set(functions).size).toBe(6);
    expect(triggers).toHaveLength(11);
    expect(new Set(triggers).size).toBe(11);

    expect(migration).not.toMatch(/\\nAS \\$\\n/);
    for (const fn of [
      'brovexa_internal.guard_candidate_match_evidence_provenance',
      'brovexa_internal.guard_resolution_decision_policy',
      'brovexa_internal.guard_canonical_business_origin',
      'brovexa_internal.guard_lineage_evidence',
    ]) {
      expect(migration).toContain('CREATE OR REPLACE FUNCTION ' + fn + '()');
    }
    expect(migration.match(/business_resolution_decisions_threshold_policy_version_check/g) ?? []).toHaveLength(1);
    expect(migration).toContain("CHECK (threshold_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$')");

    const fkDrop = rollback.indexOf('DROP CONSTRAINT IF EXISTS canonical_businesses_origin_decision_fk');
    const decisionDrop = rollback.indexOf('DROP TABLE IF EXISTS business_resolution_decisions');
    expect(fkDrop).toBeGreaterThanOrEqual(0);
    expect(decisionDrop).toBeGreaterThan(fkDrop);

    for (const checkName of [
      'candidate_business_match_evidence_signal_array_check',
      'candidate_business_match_evidence_refs_array_check',
      'business_resolution_decisions_reasons_array_check',
      'business_resolution_decisions_evidence_array_check',
      'canonical_business_lineage_operations_evidence_array_check',
      'canonical_business_lineage_operations_reason_array_check',
    ]) {
      expect(schema.match(new RegExp(checkName, 'g')) ?? []).toHaveLength(1);
    }
    expect(schema).toContain('jsonb_array_length($' + '{table.observationSignalIds}) > 0');
    expect(schema).toContain('jsonb_array_length($' + '{table.sourceReferenceIds}) > 0');
    expect(schema).toContain('jsonb_array_length($' + '{table.reasonCodes}) > 0');
    expect(schema).toContain('jsonb_array_length($' + '{table.evidenceIds}) > 0');
  });

  it('scopes every idempotency conflict fallback by workspace before replay', async () => {
    const persistence = await readFile(resolve(process.cwd(), 'src/entity-resolution-persistence.ts'), 'utf8');
    const scopedFallbacks = [
      'FROM canonical_businesses WHERE id = $1 AND workspace_id = $2::uuid',
      'FROM source_business_observations WHERE id = $1 AND workspace_id = $2::uuid',
      'FROM candidate_business_match_evidence WHERE id = $1 AND workspace_id = $2::uuid',
      'FROM business_resolution_decisions WHERE id = $1 AND workspace_id = $2::uuid',
      'FROM canonical_business_aliases WHERE source_observation_id = $1 AND workspace_id = $2::uuid',
      'FROM canonical_business_lineage_operations WHERE id = $1 AND workspace_id = $2::uuid',
    ];
    for (const fragment of scopedFallbacks) {
      expect(persistence.split(fragment)).toHaveLength(2);
    }
  });

});
