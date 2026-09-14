"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateSourceDiscoveryDedup = evaluateSourceDiscoveryDedup;
const node_crypto_1 = require("node:crypto");
const source_discovery_dedup_1 = require("./source-discovery-dedup");
const hardDuplicateKinds = new Set([
    'source_external_ref',
    'website_origin',
    'provider_fingerprint',
]);
const keyKindPriority = {
    source_external_ref: 0,
    website_origin: 1,
    provider_fingerprint: 2,
    normalized_name_location: 3,
};
function normalizedKeyValue(key) {
    const value = key.keyValue.trim();
    if (key.keyKind === 'website_origin')
        return new URL(value).origin;
    if (key.keyKind === 'normalized_name_location')
        return value.toLocaleLowerCase('en-US');
    return value;
}
function normalizedKey(key) {
    return {
        keyKind: key.keyKind,
        keyValue: normalizedKeyValue(key),
        keyScope: key.keyScope,
    };
}
function keyIdentity(key) {
    const normalized = normalizedKey(key);
    return `${normalized.keyKind}\u0000${normalized.keyScope ?? ''}\u0000${normalized.keyValue}`;
}
function reasonCode(keyKind) {
    return `dedup.${keyKind}_match`;
}
function groupId(decision, candidateIds, matchedKeys) {
    const fingerprint = (0, node_crypto_1.createHash)('sha256')
        .update(decision)
        .update('\u0000')
        .update(candidateIds.join('\u0000'))
        .update('\u0000')
        .update(matchedKeys.map(keyIdentity).join('\u0000'))
        .digest('hex')
        .slice(0, 24);
    return `dedup-${fingerprint}`;
}
function validationBatch(input, groups = []) {
    return {
        version: '1.0.0',
        batchId: 'dedup-evaluator',
        workspaceId: 'dedup-evaluator',
        researchJobId: 'dedup-evaluator',
        candidates: input.candidates,
        evidence: input.evidence,
        groups,
        evaluatedAt: '1970-01-01T00:00:00.000Z',
    };
}
function evaluateSourceDiscoveryDedup(input) {
    const validated = source_discovery_dedup_1.SourceDiscoveryDedupBatchSchema.parse(validationBatch(input));
    const buckets = new Map();
    for (const evidence of validated.evidence) {
        const key = normalizedKey(evidence);
        const identity = keyIdentity(key);
        const bucket = buckets.get(identity) ?? { identity, key, candidateIds: new Set() };
        bucket.candidateIds.add(evidence.candidateId);
        buckets.set(identity, bucket);
    }
    const repeatedBuckets = [...buckets.values()]
        .filter((bucket) => bucket.candidateIds.size >= 2)
        .sort((left, right) => {
        const leftHard = hardDuplicateKinds.has(left.key.keyKind) ? 0 : 1;
        const rightHard = hardDuplicateKinds.has(right.key.keyKind) ? 0 : 1;
        if (leftHard !== rightHard)
            return leftHard - rightHard;
        if (left.candidateIds.size !== right.candidateIds.size)
            return right.candidateIds.size - left.candidateIds.size;
        const priority = keyKindPriority[left.key.keyKind] - keyKindPriority[right.key.keyKind];
        if (priority !== 0)
            return priority;
        return left.identity.localeCompare(right.identity, 'en-US');
    });
    const claimed = new Set();
    const groups = [];
    for (const bucket of repeatedBuckets) {
        const candidateIds = [...bucket.candidateIds].filter((candidateId) => !claimed.has(candidateId)).sort();
        if (candidateIds.length < 2)
            continue;
        const decision = hardDuplicateKinds.has(bucket.key.keyKind)
            ? 'duplicate'
            : 'possible_duplicate';
        const matchedKeys = repeatedBuckets
            .filter((candidateBucket) => candidateIds.every((candidateId) => candidateBucket.candidateIds.has(candidateId)))
            .filter((candidateBucket) => decision === 'duplicate' || !hardDuplicateKinds.has(candidateBucket.key.keyKind))
            .map((candidateBucket) => candidateBucket.key)
            .sort((left, right) => {
            const priority = keyKindPriority[left.keyKind] - keyKindPriority[right.keyKind];
            return priority !== 0 ? priority : keyIdentity(left).localeCompare(keyIdentity(right), 'en-US');
        })
            .slice(0, 32);
        const reasonCodes = [...new Set(matchedKeys.map((key) => reasonCode(key.keyKind)))].sort();
        const group = {
            groupId: groupId(decision, candidateIds, matchedKeys),
            candidateIds,
            decision,
            matchedKeys,
            reasonCodes,
            canonicalizationState: 'unverified_candidates_only',
        };
        groups.push(group);
        candidateIds.forEach((candidateId) => claimed.add(candidateId));
    }
    return source_discovery_dedup_1.SourceDiscoveryDedupBatchSchema.parse(validationBatch(input, groups)).groups;
}
//# sourceMappingURL=source-discovery-dedup-evaluator.js.map