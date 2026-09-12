import { z } from 'zod';
export declare const autonomyTierValues: readonly ['T0', 'T1', 'T2', 'T3', 'T4'];
export declare const AutonomyTierSchema: z.ZodEnum<{
    T0: "T0";
    T1: "T1";
    T2: "T2";
    T3: "T3";
    T4: "T4";
}>;
export type AutonomyTier = z.infer<typeof AutonomyTierSchema>;
export declare const memoryTypeValues: readonly ['working', 'semantic', 'episodic', 'procedural', 'entity', 'lead', 'research', 'workspace_user'];
export declare const MemoryTypeSchema: z.ZodEnum<{
    entity: "entity";
    episodic: "episodic";
    lead: "lead";
    procedural: "procedural";
    research: "research";
    semantic: "semantic";
    working: "working";
    workspace_user: "workspace_user";
}>;
export type MemoryType = z.infer<typeof MemoryTypeSchema>;
export declare const memoryStatusValues: readonly ['proposed', 'active', 'stale', 'conflicted', 'superseded', 'rejected', 'deleted'];
export declare const MemoryStatusSchema: z.ZodEnum<{
    active: "active";
    conflicted: "conflicted";
    deleted: "deleted";
    proposed: "proposed";
    rejected: "rejected";
    stale: "stale";
    superseded: "superseded";
}>;
export type MemoryStatus = z.infer<typeof MemoryStatusSchema>;
export declare const memoryAuthorityValues: readonly ['platform_policy', 'explicit_configuration', 'verified_fact', 'reviewed_human_decision', 'evaluated_agent_conclusion', 'agent_inference', 'historical_context'];
export declare const MemoryAuthoritySchema: z.ZodEnum<{
    agent_inference: "agent_inference";
    evaluated_agent_conclusion: "evaluated_agent_conclusion";
    explicit_configuration: "explicit_configuration";
    historical_context: "historical_context";
    platform_policy: "platform_policy";
    reviewed_human_decision: "reviewed_human_decision";
    verified_fact: "verified_fact";
}>;
export type MemoryAuthority = z.infer<typeof MemoryAuthoritySchema>;
export declare const dataClassificationValues: readonly ['PUBLIC_SOURCE_TRANSIENT', 'PUBLIC_SOURCE_STORABLE', 'BUSINESS_DATA', 'PERSONAL_BUSINESS_CONTACT', 'WORKSPACE_CONFIDENTIAL', 'SECURITY_SENSITIVE', 'BILLING_FINANCIAL', 'AUDIT_IMMUTABLE', 'AI_DERIVED'];
export declare const DataClassificationSchema: z.ZodEnum<{
    AI_DERIVED: "AI_DERIVED";
    AUDIT_IMMUTABLE: "AUDIT_IMMUTABLE";
    BILLING_FINANCIAL: "BILLING_FINANCIAL";
    BUSINESS_DATA: "BUSINESS_DATA";
    PERSONAL_BUSINESS_CONTACT: "PERSONAL_BUSINESS_CONTACT";
    PUBLIC_SOURCE_STORABLE: "PUBLIC_SOURCE_STORABLE";
    PUBLIC_SOURCE_TRANSIENT: "PUBLIC_SOURCE_TRANSIENT";
    SECURITY_SENSITIVE: "SECURITY_SENSITIVE";
    WORKSPACE_CONFIDENTIAL: "WORKSPACE_CONFIDENTIAL";
}>;
export type DataClassification = z.infer<typeof DataClassificationSchema>;
export declare const validationStateValues: readonly ['pending', 'passed', 'failed', 'review'];
export declare const ValidationStateSchema: z.ZodEnum<{
    failed: "failed";
    passed: "passed";
    pending: "pending";
    review: "review";
}>;
export type ValidationState = z.infer<typeof ValidationStateSchema>;
export declare const evaluatorStateValues: readonly ['not_required', 'pending', 'accepted', 'rejected', 'review'];
export declare const EvaluatorStateSchema: z.ZodEnum<{
    accepted: "accepted";
    not_required: "not_required";
    pending: "pending";
    rejected: "rejected";
    review: "review";
}>;
export type EvaluatorState = z.infer<typeof EvaluatorStateSchema>;
export declare const evidenceVerificationValues: readonly ['verified', 'insufficient', 'contradicted', 'stale', 'policy_invalid'];
export declare const EvidenceVerificationSchema: z.ZodEnum<{
    contradicted: "contradicted";
    insufficient: "insufficient";
    policy_invalid: "policy_invalid";
    stale: "stale";
    verified: "verified";
}>;
export type EvidenceVerification = z.infer<typeof EvidenceVerificationSchema>;
export declare const AgentBudgetSchema: z.ZodObject<{
    maxTokens: z.ZodNumber;
    maxSearches: z.ZodNumber;
    maxApiCalls: z.ZodNumber;
    maxCredits: z.ZodNumber;
    maxCurrencyMicros: z.ZodNumber;
    maxRuntimeMs: z.ZodNumber;
    maxConcurrency: z.ZodNumber;
}, z.core.$strip>;
export type AgentBudget = z.infer<typeof AgentBudgetSchema>;
export declare const AgentModelPolicySchema: z.ZodObject<{
    routingMode: z.ZodEnum<{
        approved_models: "approved_models";
        deterministic_only: "deterministic_only";
    }>;
    allowedProviderIds: z.ZodArray<z.ZodString>;
    allowedModelIds: z.ZodArray<z.ZodString>;
    fallbackModelIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type AgentModelPolicy = z.infer<typeof AgentModelPolicySchema>;
export declare const AgentMemoryAccessSchema: z.ZodObject<{
    read: z.ZodArray<z.ZodString>;
    propose: z.ZodArray<z.ZodString>;
    commit: z.ZodArray<z.ZodString>;
    supersede: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type AgentMemoryAccess = z.infer<typeof AgentMemoryAccessSchema>;
export declare const AgentDefinitionSchema: z.ZodObject<{
    key: z.ZodString;
    version: z.ZodString;
    status: z.ZodEnum<{
        approved: "approved";
        disabled: "disabled";
        draft: "draft";
    }>;
    purpose: z.ZodString;
    nonGoals: z.ZodArray<z.ZodString>;
    triggerTypes: z.ZodArray<z.ZodString>;
    inputSchemaId: z.ZodString;
    outputSchemaId: z.ZodString;
    allowedTools: z.ZodArray<z.ZodString>;
    allowedCommands: z.ZodArray<z.ZodString>;
    memory: z.ZodObject<{
        read: z.ZodArray<z.ZodString>;
        propose: z.ZodArray<z.ZodString>;
        commit: z.ZodArray<z.ZodString>;
        supersede: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    autonomyTier: z.ZodEnum<{
        T0: "T0";
        T1: "T1";
        T2: "T2";
        T3: "T3";
        T4: "T4";
    }>;
    humanInterrupts: z.ZodArray<z.ZodString>;
    requiresHumanApproval: z.ZodBoolean;
    modelPolicy: z.ZodObject<{
        routingMode: z.ZodEnum<{
            approved_models: "approved_models";
            deterministic_only: "deterministic_only";
        }>;
        allowedProviderIds: z.ZodArray<z.ZodString>;
        allowedModelIds: z.ZodArray<z.ZodString>;
        fallbackModelIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    promptVersion: z.ZodString;
    skillVersions: z.ZodRecord<z.ZodString, z.ZodString>;
    contextVersion: z.ZodString;
    retryLimit: z.ZodNumber;
    fallbackPolicyId: z.ZodOptional<z.ZodString>;
    budget: z.ZodObject<{
        maxTokens: z.ZodNumber;
        maxSearches: z.ZodNumber;
        maxApiCalls: z.ZodNumber;
        maxCredits: z.ZodNumber;
        maxCurrencyMicros: z.ZodNumber;
        maxRuntimeMs: z.ZodNumber;
        maxConcurrency: z.ZodNumber;
    }, z.core.$strip>;
    deterministicValidators: z.ZodArray<z.ZodString>;
    evidenceRequired: z.ZodBoolean;
    minimumConfidence: z.ZodNumber;
    reviewBelowConfidence: z.ZodNumber;
    independentEvaluatorKey: z.ZodOptional<z.ZodString>;
    evalSuiteId: z.ZodString;
    evalThreshold: z.ZodNumber;
    dataClassifications: z.ZodArray<z.ZodEnum<{
        AI_DERIVED: "AI_DERIVED";
        AUDIT_IMMUTABLE: "AUDIT_IMMUTABLE";
        BILLING_FINANCIAL: "BILLING_FINANCIAL";
        BUSINESS_DATA: "BUSINESS_DATA";
        PERSONAL_BUSINESS_CONTACT: "PERSONAL_BUSINESS_CONTACT";
        PUBLIC_SOURCE_STORABLE: "PUBLIC_SOURCE_STORABLE";
        PUBLIC_SOURCE_TRANSIENT: "PUBLIC_SOURCE_TRANSIENT";
        SECURITY_SENSITIVE: "SECURITY_SENSITIVE";
        WORKSPACE_CONFIDENTIAL: "WORKSPACE_CONFIDENTIAL";
    }>>;
    telemetryRedactionPolicyId: z.ZodString;
    owner: z.ZodString;
    changeReason: z.ZodString;
    rollbackToVersion: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
export interface MemoryNamespaceScope {
    workspaceId: string;
    userId?: string | undefined;
    runId?: string | undefined;
}
export declare function isMemoryNamespaceAllowed(namespace: string, scope: MemoryNamespaceScope): boolean;
export declare const ContextReceiptMemoryRefSchema: z.ZodObject<{
    memoryId: z.ZodString;
    version: z.ZodString;
    namespace: z.ZodString;
    authority: z.ZodEnum<{
        agent_inference: "agent_inference";
        evaluated_agent_conclusion: "evaluated_agent_conclusion";
        explicit_configuration: "explicit_configuration";
        historical_context: "historical_context";
        platform_policy: "platform_policy";
        reviewed_human_decision: "reviewed_human_decision";
        verified_fact: "verified_fact";
    }>;
    status: z.ZodEnum<{
        active: "active";
        conflicted: "conflicted";
        deleted: "deleted";
        proposed: "proposed";
        rejected: "rejected";
        stale: "stale";
        superseded: "superseded";
    }>;
}, z.core.$strip>;
export declare const ContextReceiptSchema: z.ZodObject<{
    id: z.ZodString;
    taskId: z.ZodString;
    workspaceId: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    runId: z.ZodOptional<z.ZodString>;
    agentKey: z.ZodString;
    agentVersion: z.ZodString;
    policyRefs: z.ZodArray<z.ZodString>;
    canonicalRefs: z.ZodArray<z.ZodString>;
    memoryRefs: z.ZodArray<z.ZodObject<{
        memoryId: z.ZodString;
        version: z.ZodString;
        namespace: z.ZodString;
        authority: z.ZodEnum<{
            agent_inference: "agent_inference";
            evaluated_agent_conclusion: "evaluated_agent_conclusion";
            explicit_configuration: "explicit_configuration";
            historical_context: "historical_context";
            platform_policy: "platform_policy";
            reviewed_human_decision: "reviewed_human_decision";
            verified_fact: "verified_fact";
        }>;
        status: z.ZodEnum<{
            active: "active";
            conflicted: "conflicted";
            deleted: "deleted";
            proposed: "proposed";
            rejected: "rejected";
            stale: "stale";
            superseded: "superseded";
        }>;
    }, z.core.$strip>>;
    tokenBudget: z.ZodNumber;
    maxCurrencyMicros: z.ZodNumber;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type ContextReceipt = z.infer<typeof ContextReceiptSchema>;
export declare const MemoryProvenanceSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        activity: "activity";
        evidence: "evidence";
        fact: "fact";
        policy: "policy";
        run: "run";
        user_decision: "user_decision";
    }>;
    refId: z.ZodString;
}, z.core.$strip>;
export declare const MemoryRecordSchema: z.ZodObject<{
    id: z.ZodString;
    version: z.ZodString;
    revisionParentId: z.ZodOptional<z.ZodString>;
    namespace: z.ZodString;
    workspaceId: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    runId: z.ZodOptional<z.ZodString>;
    entityId: z.ZodOptional<z.ZodString>;
    leadId: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<{
        entity: "entity";
        episodic: "episodic";
        lead: "lead";
        procedural: "procedural";
        research: "research";
        semantic: "semantic";
        working: "working";
        workspace_user: "workspace_user";
    }>;
    subtype: z.ZodString;
    subjectRefs: z.ZodArray<z.ZodString>;
    contentSchemaId: z.ZodString;
    contentSchemaVersion: z.ZodString;
    content: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    provenance: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<{
            activity: "activity";
            evidence: "evidence";
            fact: "fact";
            policy: "policy";
            run: "run";
            user_decision: "user_decision";
        }>;
        refId: z.ZodString;
    }, z.core.$strip>>;
    writer: z.ZodEnum<{
        agent: "agent";
        curator: "curator";
        system: "system";
        user: "user";
    }>;
    aiDerived: z.ZodBoolean;
    derivation: z.ZodOptional<z.ZodObject<{
        agentKey: z.ZodString;
        agentVersion: z.ZodString;
        modelId: z.ZodString;
        promptVersion: z.ZodString;
        toolVersions: z.ZodRecord<z.ZodString, z.ZodString>;
    }, z.core.$strip>>;
    confidence: z.ZodNumber;
    authority: z.ZodEnum<{
        agent_inference: "agent_inference";
        evaluated_agent_conclusion: "evaluated_agent_conclusion";
        explicit_configuration: "explicit_configuration";
        historical_context: "historical_context";
        platform_policy: "platform_policy";
        reviewed_human_decision: "reviewed_human_decision";
        verified_fact: "verified_fact";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    observedAt: z.ZodOptional<z.ZodString>;
    lastVerifiedAt: z.ZodOptional<z.ZodString>;
    validFrom: z.ZodOptional<z.ZodString>;
    validTo: z.ZodOptional<z.ZodString>;
    refreshAfter: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        active: "active";
        conflicted: "conflicted";
        deleted: "deleted";
        proposed: "proposed";
        rejected: "rejected";
        stale: "stale";
        superseded: "superseded";
    }>;
    retentionPolicyId: z.ZodString;
    deletionReason: z.ZodOptional<z.ZodString>;
    readCapabilities: z.ZodArray<z.ZodString>;
    writeCapabilities: z.ZodArray<z.ZodString>;
    dataClassification: z.ZodEnum<{
        AI_DERIVED: "AI_DERIVED";
        AUDIT_IMMUTABLE: "AUDIT_IMMUTABLE";
        BILLING_FINANCIAL: "BILLING_FINANCIAL";
        BUSINESS_DATA: "BUSINESS_DATA";
        PERSONAL_BUSINESS_CONTACT: "PERSONAL_BUSINESS_CONTACT";
        PUBLIC_SOURCE_STORABLE: "PUBLIC_SOURCE_STORABLE";
        PUBLIC_SOURCE_TRANSIENT: "PUBLIC_SOURCE_TRANSIENT";
        SECURITY_SENSITIVE: "SECURITY_SENSITIVE";
        WORKSPACE_CONFIDENTIAL: "WORKSPACE_CONFIDENTIAL";
    }>;
    sourcePolicyRefs: z.ZodArray<z.ZodString>;
    jurisdictionRefs: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;
export declare const AgentRunStatusSchema: z.ZodEnum<{
    blocked: "blocked";
    budget_stopped: "budget_stopped";
    cancelled: "cancelled";
    failed: "failed";
    queued: "queued";
    review_required: "review_required";
    running: "running";
    succeeded: "succeeded";
}>;
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;
export declare const AgentRunSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    agentKey: z.ZodString;
    agentVersion: z.ZodString;
    parentRunId: z.ZodOptional<z.ZodString>;
    handoffId: z.ZodOptional<z.ZodString>;
    executionMode: z.ZodEnum<{
        deterministic: "deterministic";
        model: "model";
    }>;
    providerId: z.ZodOptional<z.ZodString>;
    modelId: z.ZodOptional<z.ZodString>;
    promptVersion: z.ZodString;
    skillVersions: z.ZodRecord<z.ZodString, z.ZodString>;
    contextReceiptId: z.ZodString;
    status: z.ZodEnum<{
        blocked: "blocked";
        budget_stopped: "budget_stopped";
        cancelled: "cancelled";
        failed: "failed";
        queued: "queued";
        review_required: "review_required";
        running: "running";
        succeeded: "succeeded";
    }>;
    result: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    confidence: z.ZodOptional<z.ZodNumber>;
    uncertainty: z.ZodArray<z.ZodString>;
    evidenceIds: z.ZodArray<z.ZodString>;
    factIds: z.ZodArray<z.ZodString>;
    sourceIds: z.ZodArray<z.ZodString>;
    assumptions: z.ZodArray<z.ZodString>;
    conflicts: z.ZodArray<z.ZodString>;
    toolSummary: z.ZodArray<z.ZodObject<{
        toolKey: z.ZodString;
        status: z.ZodEnum<{
            blocked: "blocked";
            failed: "failed";
            skipped: "skipped";
            succeeded: "succeeded";
        }>;
        costMicros: z.ZodNumber;
    }, z.core.$strip>>;
    cost: z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        searches: z.ZodNumber;
        apiCalls: z.ZodNumber;
        credits: z.ZodNumber;
        currencyMicros: z.ZodNumber;
    }, z.core.$strip>;
    validationState: z.ZodEnum<{
        failed: "failed";
        passed: "passed";
        pending: "pending";
        review: "review";
    }>;
    evaluatorState: z.ZodEnum<{
        accepted: "accepted";
        not_required: "not_required";
        pending: "pending";
        rejected: "rejected";
        review: "review";
    }>;
    proposedActions: z.ZodArray<z.ZodObject<{
        commandKey: z.ZodString;
        payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        evidenceRefs: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    startedAt: z.ZodOptional<z.ZodString>;
    completedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
export declare const EvalResultSchema: z.ZodObject<{
    id: z.ZodString;
    evaluatorRunId: z.ZodString;
    subjectRunId: z.ZodString;
    decision: z.ZodEnum<{
        accept: "accept";
        reject: "reject";
        review: "review";
    }>;
    evidenceState: z.ZodEnum<{
        contradicted: "contradicted";
        insufficient: "insufficient";
        policy_invalid: "policy_invalid";
        stale: "stale";
        verified: "verified";
    }>;
    reasonCodes: z.ZodArray<z.ZodString>;
    evidenceRefs: z.ZodArray<z.ZodString>;
    policyRefs: z.ZodArray<z.ZodString>;
    confidence: z.ZodNumber;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type EvalResult = z.infer<typeof EvalResultSchema>;
