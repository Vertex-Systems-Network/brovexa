import type { AgentDefinition, ContextReceiptItem, MemoryStatus } from './agents';
import { sha256Hex } from './sha256';

export type ContextSourceKind = 'policy' | 'canonical' | 'memory';

export interface ContextCandidate {
  sourceKind: ContextSourceKind;
  referenceType: string;
  referenceId: string;
  workspaceId: string | null;
  userId: string | null;
  required: boolean;
  authorityClass: number;
  relevanceBps: number;
  confidenceBps: number;
  tokenCost: number;
  memoryStatus?: MemoryStatus;
  conflicted?: boolean;
  observedAt?: string | null;
  expiresAt?: string | null;
}

export type ContextRejectionReason =
  | 'WORKSPACE_MISMATCH'
  | 'USER_SCOPE_MISMATCH'
  | 'MEMORY_NOT_ACTIVE'
  | 'MEMORY_CONFLICTED'
  | 'MEMORY_EXPIRED'
  | 'OPTIONAL_BUDGET_EXHAUSTED';

export interface RejectedContextCandidate {
  referenceType: string;
  referenceId: string;
  reason: ContextRejectionReason;
}

export interface ContextSelection {
  selectedItems: ContextReceiptItem[];
  selectedTokenCost: number;
  selectionDigest: string;
  rejected: RejectedContextCandidate[];
}

export type ContextSelectionErrorCode =
  | 'INVALID_CONTEXT_CANDIDATE'
  | 'CONTEXT_BUDGET_EXCEEDS_AGENT_LIMIT'
  | 'REQUIRED_CONTEXT_UNAVAILABLE'
  | 'REQUIRED_CONTEXT_EXCEEDS_BUDGET';

export class ContextSelectionError extends Error {
  readonly code: ContextSelectionErrorCode;

  constructor(code: ContextSelectionErrorCode, message: string) {
    super(message);
    this.name = 'ContextSelectionError';
    this.code = code;
  }
}

const sourceRank: Record<ContextSourceKind, number> = {
  policy: 0,
  canonical: 1,
  memory: 2,
};

function validateBasisPoints(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new ContextSelectionError('INVALID_CONTEXT_CANDIDATE', `${field} must be 0..10000.`);
  }
}

function validateCandidate(candidate: ContextCandidate): void {
  if (!candidate.referenceType || !candidate.referenceId) {
    throw new ContextSelectionError(
      'INVALID_CONTEXT_CANDIDATE',
      'Context candidate requires reference type and ID.',
    );
  }
  if (
    !Number.isInteger(candidate.authorityClass) ||
    candidate.authorityClass < 1 ||
    candidate.authorityClass > 7
  ) {
    throw new ContextSelectionError(
      'INVALID_CONTEXT_CANDIDATE',
      'Context candidate authority class must be 1..7.',
    );
  }
  validateBasisPoints(candidate.relevanceBps, 'relevanceBps');
  validateBasisPoints(candidate.confidenceBps, 'confidenceBps');
  if (!Number.isInteger(candidate.tokenCost) || candidate.tokenCost < 0) {
    throw new ContextSelectionError(
      'INVALID_CONTEXT_CANDIDATE',
      'Context candidate token cost must be a non-negative integer.',
    );
  }
}

function candidateRejection(
  candidate: ContextCandidate,
  workspaceId: string,
  userId: string | null,
  nowMs: number,
): ContextRejectionReason | null {
  if (candidate.workspaceId !== null && candidate.workspaceId !== workspaceId) {
    return 'WORKSPACE_MISMATCH';
  }

  if (candidate.sourceKind !== 'policy' && candidate.workspaceId === null) {
    return 'WORKSPACE_MISMATCH';
  }

  if (candidate.userId !== null && candidate.userId !== userId) {
    return 'USER_SCOPE_MISMATCH';
  }

  if (candidate.sourceKind === 'memory') {
    if (candidate.memoryStatus !== 'active') return 'MEMORY_NOT_ACTIVE';
    if (candidate.conflicted === true) return 'MEMORY_CONFLICTED';
    if (candidate.expiresAt) {
      const expiresAtMs = Date.parse(candidate.expiresAt);
      if (!Number.isFinite(expiresAtMs)) {
        throw new ContextSelectionError(
          'INVALID_CONTEXT_CANDIDATE',
          `Invalid expiresAt for ${candidate.referenceType}:${candidate.referenceId}.`,
        );
      }
      if (expiresAtMs <= nowMs) return 'MEMORY_EXPIRED';
    }
  }

  return null;
}

function candidateComparator(left: ContextCandidate, right: ContextCandidate): number {
  if (left.required !== right.required) return left.required ? -1 : 1;
  if (sourceRank[left.sourceKind] !== sourceRank[right.sourceKind]) {
    return sourceRank[left.sourceKind] - sourceRank[right.sourceKind];
  }
  if (left.authorityClass !== right.authorityClass) return left.authorityClass - right.authorityClass;
  if (left.relevanceBps !== right.relevanceBps) return right.relevanceBps - left.relevanceBps;
  if (left.confidenceBps !== right.confidenceBps) return right.confidenceBps - left.confidenceBps;

  const leftObserved = left.observedAt ? Date.parse(left.observedAt) : 0;
  const rightObserved = right.observedAt ? Date.parse(right.observedAt) : 0;
  if (
    Number.isFinite(leftObserved) &&
    Number.isFinite(rightObserved) &&
    leftObserved !== rightObserved
  ) {
    return rightObserved - leftObserved;
  }

  const byType = left.referenceType.localeCompare(right.referenceType);
  return byType !== 0 ? byType : left.referenceId.localeCompare(right.referenceId);
}

function toReceiptItem(candidate: ContextCandidate): ContextReceiptItem {
  return {
    sourceKind: candidate.sourceKind,
    referenceType: candidate.referenceType,
    referenceId: candidate.referenceId,
    authorityClass: candidate.authorityClass,
    required: candidate.required,
    tokenCost: candidate.tokenCost,
  };
}

export interface BuildContextSelectionInput {
  definition: AgentDefinition;
  workspaceId: string;
  userId: string | null;
  tokenBudget: number;
  candidates: readonly ContextCandidate[];
  now?: Date;
}

export function buildContextSelection(input: BuildContextSelectionInput): ContextSelection {
  if (!Number.isInteger(input.tokenBudget) || input.tokenBudget <= 0) {
    throw new ContextSelectionError(
      'INVALID_CONTEXT_CANDIDATE',
      'Context token budget must be positive.',
    );
  }

  if (input.tokenBudget > input.definition.budgets.maxContextTokens) {
    throw new ContextSelectionError(
      'CONTEXT_BUDGET_EXCEEDS_AGENT_LIMIT',
      `Requested context budget ${input.tokenBudget} exceeds agent limit ${input.definition.budgets.maxContextTokens}.`,
    );
  }

  const nowMs = (input.now ?? new Date()).getTime();
  const eligible: ContextCandidate[] = [];
  const rejected: RejectedContextCandidate[] = [];

  for (const candidate of input.candidates) {
    validateCandidate(candidate);
    const reason = candidateRejection(candidate, input.workspaceId, input.userId, nowMs);
    if (reason) {
      if (candidate.required) {
        throw new ContextSelectionError(
          'REQUIRED_CONTEXT_UNAVAILABLE',
          `Required context ${candidate.referenceType}:${candidate.referenceId} rejected: ${reason}.`,
        );
      }
      rejected.push({
        referenceType: candidate.referenceType,
        referenceId: candidate.referenceId,
        reason,
      });
      continue;
    }
    eligible.push(candidate);
  }

  eligible.sort(candidateComparator);

  const selected: ContextCandidate[] = [];
  let selectedTokenCost = 0;

  for (const candidate of eligible.filter((value) => value.required)) {
    if (selectedTokenCost + candidate.tokenCost > input.tokenBudget) {
      throw new ContextSelectionError(
        'REQUIRED_CONTEXT_EXCEEDS_BUDGET',
        `Required context exceeds token budget at ${candidate.referenceType}:${candidate.referenceId}.`,
      );
    }
    selected.push(candidate);
    selectedTokenCost += candidate.tokenCost;
  }

  for (const candidate of eligible.filter((value) => !value.required)) {
    if (selectedTokenCost + candidate.tokenCost > input.tokenBudget) {
      rejected.push({
        referenceType: candidate.referenceType,
        referenceId: candidate.referenceId,
        reason: 'OPTIONAL_BUDGET_EXHAUSTED',
      });
      continue;
    }
    selected.push(candidate);
    selectedTokenCost += candidate.tokenCost;
  }

  const selectedItems = selected.map(toReceiptItem);
  const selectionDigest = sha256Hex(
    JSON.stringify({
      workspaceId: input.workspaceId,
      agentKey: input.definition.key,
      agentVersion: input.definition.version,
      contextVersion: input.definition.contextVersion,
      selectedItems,
    }),
  );

  return {
    selectedItems,
    selectedTokenCost,
    selectionDigest,
    rejected,
  };
}
