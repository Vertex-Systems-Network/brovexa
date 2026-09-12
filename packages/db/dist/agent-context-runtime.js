"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentContextRuntimeError = void 0;
exports.resolveApprovedAgentDefinition = resolveApprovedAgentDefinition;
exports.buildAndPersistAgentContext = buildAndPersistAgentContext;
exports.getContextReceiptEnvelope = getContextReceiptEnvelope;
const agent_persistence_1 = require("./agent-persistence");
const identity_1 = require("./identity");
const memory_record_schema_1 = require("./memory-record-schema");
class AgentContextRuntimeError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'AgentContextRuntimeError';
        this.code = code;
    }
}
exports.AgentContextRuntimeError = AgentContextRuntimeError;
const authorityRank = {
    platform_policy: 700,
    explicit_configuration: 600,
    verified_fact: 500,
    reviewed_human_decision: 400,
    evaluated_agent_conclusion: 300,
    agent_inference: 200,
    historical_context: 100,
};
const supportedDataClassifications = new Set(memory_record_schema_1.persistedDataClassificationValues);
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function readStringArray(value) {
    if (!Array.isArray(value) || value.some((item) => !isNonEmptyString(item)))
        return null;
    return [...new Set(value.map((item) => item.trim()))];
}
function readDataClassificationArray(value) {
    const values = readStringArray(value);
    if (!values || values.some((item) => !supportedDataClassifications.has(item)))
        return null;
    return values;
}
function readSafeBudget(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function assertIdentifier(value, field) {
    if (!isNonEmptyString(value)) {
        throw new AgentContextRuntimeError('CONTEXT_INPUT_INVALID', `${field} must be non-empty.`);
    }
}
function assertSafeBudget(value, field) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new AgentContextRuntimeError('CONTEXT_INPUT_INVALID', `${field} must be a non-negative safe integer.`);
    }
}
function assertBoundedStringList(values, field, maxItems) {
    if (values.length > maxItems || values.some((value) => !isNonEmptyString(value))) {
        throw new AgentContextRuntimeError('CONTEXT_INPUT_INVALID', `${field} must contain at most ${maxItems} non-empty identifiers.`);
    }
    return [...new Set(values.map((value) => value.trim()))];
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function memoryScopeMatches(pattern, namespace) {
    const expression = `^${pattern.split('*').map(escapeRegExp).join('.*')}$`;
    return new RegExp(expression).test(namespace);
}
function isNamespaceInsideContextScope(namespace, input) {
    const segments = namespace.split('/').filter(Boolean);
    if (segments[0] === 'system' && segments[1] === 'procedural' && segments.length >= 3) {
        return true;
    }
    if (segments[0] === 'workspace' && segments[1] === input.workspaceId && segments.length >= 3) {
        return true;
    }
    if (segments[0] === 'user' &&
        segments[1] === input.userId &&
        segments[2] === 'workspace' &&
        segments[3] === input.workspaceId &&
        segments.length >= 5) {
        return true;
    }
    if (input.runId &&
        segments[0] === 'run' &&
        segments[1] === input.runId &&
        segments.length >= 3) {
        return true;
    }
    return false;
}
function candidateScopeIsConsistent(candidate, input) {
    const segments = candidate.namespace.split('/').filter(Boolean);
    if (segments[0] === 'user')
        return candidate.user_id === input.userId;
    if (segments[0] === 'run')
        return Boolean(input.runId) && candidate.run_id === input.runId;
    return true;
}
function envelopeMatchesCanonical(candidate) {
    const envelope = candidate.envelope;
    return (envelope.id === candidate.id &&
        envelope.version === candidate.version &&
        envelope.namespace === candidate.namespace &&
        envelope.type === candidate.memory_type &&
        envelope.subtype === candidate.subtype &&
        envelope.authority === candidate.authority &&
        envelope.status === candidate.status &&
        envelope.dataClassification === candidate.data_classification);
}
function candidateIsReadable(candidate, authorization) {
    const readCapabilities = readStringArray(candidate.envelope.readCapabilities);
    if (!readCapabilities || readCapabilities.length === 0)
        return false;
    return readCapabilities.some((capability) => authorization.permissions.some((permission) => permission === capability));
}
function estimateTokens(envelope) {
    const bytes = Buffer.byteLength(JSON.stringify(envelope), 'utf8');
    return Math.max(1, Math.ceil(bytes / 4));
}
function specificityScore(candidate, input, targetEntityIds, targetLeadIds) {
    let score = 0;
    if (candidate.entity_id && targetEntityIds.has(candidate.entity_id))
        score += 60;
    if (candidate.lead_id && targetLeadIds.has(candidate.lead_id))
        score += 60;
    if (input.runId && candidate.run_id === input.runId)
        score += 40;
    if (candidate.user_id === input.userId)
        score += 20;
    return score;
}
function dedupeAndRankCandidates(candidates, input) {
    const targetEntityIds = new Set(input.targetEntityIds ?? []);
    const targetLeadIds = new Set(input.targetLeadIds ?? []);
    const ranked = [...candidates].sort((left, right) => {
        const authorityDifference = authorityRank[right.authority] - authorityRank[left.authority];
        if (authorityDifference !== 0)
            return authorityDifference;
        const specificityDifference = specificityScore(right, input, targetEntityIds, targetLeadIds) -
            specificityScore(left, input, targetEntityIds, targetLeadIds);
        if (specificityDifference !== 0)
            return specificityDifference;
        if (right.confidence !== left.confidence)
            return right.confidence - left.confidence;
        const freshnessDifference = right.updated_at.getTime() - left.updated_at.getTime();
        if (freshnessDifference !== 0)
            return freshnessDifference;
        return left.id.localeCompare(right.id);
    });
    const seen = new Set();
    const deduped = [];
    for (const candidate of ranked) {
        const key = `${candidate.namespace}\u0000${candidate.subtype}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        deduped.push(candidate);
    }
    return deduped;
}
function parseResolvedDefinition(row) {
    if (row.status !== 'approved') {
        throw new AgentContextRuntimeError('AGENT_DEFINITION_NOT_APPROVED', `Agent definition ${row.agent_key}@${row.version} is not approved.`);
    }
    const specification = row.specification;
    const memory = isRecord(specification.memory) ? specification.memory : null;
    const budget = isRecord(specification.budget) ? specification.budget : null;
    const readScopes = memory ? readStringArray(memory.read) : null;
    const dataClassifications = readDataClassificationArray(specification.dataClassifications);
    const maxTokens = budget ? readSafeBudget(budget.maxTokens) : null;
    const maxCurrencyMicros = budget ? readSafeBudget(budget.maxCurrencyMicros) : null;
    if (specification.key !== row.agent_key ||
        specification.version !== row.version ||
        specification.status !== row.status ||
        specification.autonomyTier !== row.autonomy_tier ||
        specification.requiresHumanApproval !== row.requires_human_approval ||
        !readScopes ||
        !dataClassifications ||
        dataClassifications.length === 0 ||
        maxTokens === null ||
        maxCurrencyMicros === null) {
        throw new AgentContextRuntimeError('AGENT_DEFINITION_SPEC_INVALID', `Agent definition ${row.agent_key}@${row.version} has an invalid or inconsistent specification.`);
    }
    return {
        id: row.id,
        agentKey: row.agent_key,
        version: row.version,
        autonomyTier: row.autonomy_tier,
        requiresHumanApproval: row.requires_human_approval,
        specification,
        memoryReadScopes: readScopes,
        dataClassifications,
        maxTokens,
        maxCurrencyMicros,
    };
}
async function resolveApprovedAgentDefinition(pool, input) {
    assertIdentifier(input.agentKey, 'agentKey');
    assertIdentifier(input.version, 'version');
    const result = await pool.query(`SELECT
       id,
       agent_key,
       version,
       status,
       autonomy_tier,
       requires_human_approval,
       specification
     FROM agent_definitions
     WHERE agent_key = $1 AND version = $2
     LIMIT 1`, [input.agentKey, input.version]);
    const row = result.rows[0];
    if (!row) {
        throw new AgentContextRuntimeError('AGENT_DEFINITION_NOT_FOUND', `Agent definition ${input.agentKey}@${input.version} was not found.`);
    }
    return parseResolvedDefinition(row);
}
async function buildAndPersistAgentContext(pool, input) {
    assertIdentifier(input.receiptId, 'receiptId');
    assertIdentifier(input.taskId, 'taskId');
    assertIdentifier(input.workspaceId, 'workspaceId');
    assertIdentifier(input.userId, 'userId');
    assertIdentifier(input.agentKey, 'agentKey');
    assertIdentifier(input.agentVersion, 'agentVersion');
    if (input.runId !== undefined)
        assertIdentifier(input.runId, 'runId');
    assertSafeBudget(input.tokenBudget, 'tokenBudget');
    assertSafeBudget(input.maxCurrencyMicros, 'maxCurrencyMicros');
    if (!Number.isFinite(input.createdAt.getTime())) {
        throw new AgentContextRuntimeError('CONTEXT_INPUT_INVALID', 'createdAt must be a valid Date.');
    }
    const policyRefs = assertBoundedStringList(input.policyRefs, 'policyRefs', 128);
    if (policyRefs.length === 0) {
        throw new AgentContextRuntimeError('CONTEXT_POLICY_REQUIRED', 'At least one policy reference is required for a ContextReceipt.');
    }
    const canonicalRefs = assertBoundedStringList(input.canonicalRefs ?? [], 'canonicalRefs', 512);
    const targetEntityIds = assertBoundedStringList(input.targetEntityIds ?? [], 'targetEntityIds', 128);
    const targetLeadIds = assertBoundedStringList(input.targetLeadIds ?? [], 'targetLeadIds', 128);
    const maxMemoryRefs = input.maxMemoryRefs ?? 32;
    if (!Number.isInteger(maxMemoryRefs) || maxMemoryRefs < 0 || maxMemoryRefs > 128) {
        throw new AgentContextRuntimeError('CONTEXT_INPUT_INVALID', 'maxMemoryRefs must be an integer from 0 through 128.');
    }
    const candidateLimit = input.candidateLimit ?? Math.min(512, Math.max(64, maxMemoryRefs * 8));
    if (!Number.isInteger(candidateLimit) || candidateLimit < 1 || candidateLimit > 512) {
        throw new AgentContextRuntimeError('CONTEXT_INPUT_INVALID', 'candidateLimit must be an integer from 1 through 512.');
    }
    const authorization = await (0, identity_1.resolveWorkspaceAuthorization)(pool, {
        workspaceId: input.workspaceId,
        userId: input.userId,
    });
    (0, identity_1.assertWorkspaceCapability)(authorization, 'workspace.read');
    const definition = await resolveApprovedAgentDefinition(pool, {
        agentKey: input.agentKey,
        version: input.agentVersion,
    });
    if (input.tokenBudget > definition.maxTokens ||
        input.maxCurrencyMicros > definition.maxCurrencyMicros) {
        throw new AgentContextRuntimeError('CONTEXT_BUDGET_EXCEEDS_AGENT_LIMIT', `Requested context budget exceeds ${definition.agentKey}@${definition.version} limits.`);
    }
    const candidateResult = await pool.query(`SELECT
       id,
       version,
       namespace,
       user_id,
       run_id,
       entity_id,
       lead_id,
       memory_type,
       subtype,
       confidence,
       authority,
       status,
       data_classification,
       envelope,
       updated_at
     FROM memory_records
     WHERE workspace_id = $1
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > $2)
       AND (user_id IS NULL OR user_id = $3::uuid)
       AND (run_id IS NULL OR run_id IS NOT DISTINCT FROM $4::text)
       AND data_classification = ANY($5::text[])
     ORDER BY updated_at DESC, id ASC
     LIMIT $6`, [
        input.workspaceId,
        input.createdAt,
        input.userId,
        input.runId ?? null,
        definition.dataClassifications,
        candidateLimit,
    ]);
    const normalizedInput = {
        ...input,
        canonicalRefs,
        targetEntityIds,
        targetLeadIds,
    };
    const eligible = candidateResult.rows.filter((candidate) => isNamespaceInsideContextScope(candidate.namespace, normalizedInput) &&
        candidateScopeIsConsistent(candidate, normalizedInput) &&
        definition.memoryReadScopes.some((scope) => memoryScopeMatches(scope, candidate.namespace)) &&
        envelopeMatchesCanonical(candidate) &&
        candidateIsReadable(candidate, authorization));
    const ranked = dedupeAndRankCandidates(eligible, normalizedInput);
    const selectedMemory = [];
    let estimatedMemoryTokens = 0;
    for (const candidate of ranked) {
        if (selectedMemory.length >= maxMemoryRefs)
            break;
        const estimatedTokens = estimateTokens(candidate.envelope);
        if (estimatedMemoryTokens + estimatedTokens > input.tokenBudget)
            continue;
        selectedMemory.push({
            id: candidate.id,
            version: candidate.version,
            namespace: candidate.namespace,
            memoryType: candidate.memory_type,
            subtype: candidate.subtype,
            authority: candidate.authority,
            confidence: candidate.confidence,
            dataClassification: candidate.data_classification,
            estimatedTokens,
            envelope: candidate.envelope,
        });
        estimatedMemoryTokens += estimatedTokens;
    }
    const receipt = {
        id: input.receiptId,
        taskId: input.taskId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        ...(input.runId ? { runId: input.runId } : {}),
        agentKey: definition.agentKey,
        agentVersion: definition.version,
        policyRefs,
        canonicalRefs,
        memoryRefs: selectedMemory.map((memory) => ({
            memoryId: memory.id,
            version: memory.version,
            namespace: memory.namespace,
            authority: memory.authority,
            status: 'active',
        })),
        tokenBudget: input.tokenBudget,
        maxCurrencyMicros: input.maxCurrencyMicros,
        createdAt: input.createdAt.toISOString(),
    };
    await (0, agent_persistence_1.persistContextReceipt)(pool, {
        id: input.receiptId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        runScopeId: input.runId,
        agentDefinitionId: definition.id,
        agentKey: definition.agentKey,
        agentVersion: definition.version,
        receipt,
        tokenBudget: input.tokenBudget,
        maxCurrencyMicros: input.maxCurrencyMicros,
        createdAt: input.createdAt,
    });
    return {
        authorization,
        definition,
        receipt,
        selectedMemory,
        estimatedMemoryTokens,
    };
}
async function getContextReceiptEnvelope(pool, workspaceId, receiptId) {
    const result = await pool.query(`SELECT receipt
     FROM agent_context_receipts
     WHERE workspace_id = $1 AND id = $2`, [workspaceId, receiptId]);
    return result.rows[0]?.receipt ?? null;
}
//# sourceMappingURL=agent-context-runtime.js.map