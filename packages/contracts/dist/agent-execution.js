"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentExecutionPlanSchema = exports.AgentExecutionWorkPayloadSchema = exports.AgentExecutionStepSchema = void 0;
const zod_1 = require("zod");
const ai_1 = require("./ai");
const IdentifierSchema = zod_1.z.string().trim().min(1).max(128);
const VersionSchema = zod_1.z.string().trim().min(1).max(64);
const DateTimeSchema = zod_1.z.string().datetime();
const StepKeySchema = zod_1.z.string().regex(/^[a-z][a-z0-9_.-]{0,127}$/);
const AgentKeySchema = zod_1.z.string().regex(/^agent\.[a-z0-9_.-]+$/);
exports.AgentExecutionStepSchema = zod_1.z.object({
    key: StepKeySchema,
    agentKey: AgentKeySchema,
    agentVersion: VersionSchema,
    dependencies: zod_1.z.array(StepKeySchema).max(64),
    toolKeys: zod_1.z.array(IdentifierSchema).max(128),
    commandKeys: zod_1.z.array(IdentifierSchema).max(128),
    policyRefs: zod_1.z.array(IdentifierSchema).min(1).max(128),
    canonicalRefs: zod_1.z.array(IdentifierSchema).max(512),
    memoryRefs: zod_1.z.array(IdentifierSchema).max(512),
    budget: ai_1.AgentBudgetSchema,
});
exports.AgentExecutionWorkPayloadSchema = zod_1.z
    .object({
    version: zod_1.z.literal('1.0.0'),
    dispatchId: IdentifierSchema,
    handlerRegistryVersion: VersionSchema,
    planId: IdentifierSchema,
    planVersion: zod_1.z.number().int().min(1).max(1_000_000),
    workspaceId: IdentifierSchema,
    orchestratorRunId: IdentifierSchema,
    contextReceiptId: IdentifierSchema,
    maxParallelism: zod_1.z.number().int().min(1).max(256),
    stepKey: StepKeySchema,
    agentKey: AgentKeySchema,
    agentVersion: VersionSchema,
    dependencies: zod_1.z.array(StepKeySchema).max(64),
    toolKeys: zod_1.z.array(IdentifierSchema).max(128),
    commandKeys: zod_1.z.array(IdentifierSchema).max(128),
    policyRefs: zod_1.z.array(IdentifierSchema).min(1).max(128),
    canonicalRefs: zod_1.z.array(IdentifierSchema).max(512),
    memoryRefs: zod_1.z.array(IdentifierSchema).max(512),
    budget: ai_1.AgentBudgetSchema,
})
    .superRefine((payload, ctx) => {
    if (payload.agentKey === 'agent.control.orchestrator') {
        ctx.addIssue({
            code: 'custom',
            path: ['agentKey'],
            message: 'Dispatched specialist work cannot recursively target the orchestrator.',
        });
    }
    if (payload.budget.maxConcurrency !== 1) {
        ctx.addIssue({
            code: 'custom',
            path: ['budget', 'maxConcurrency'],
            message: 'Dispatched specialist work must reserve exactly one concurrency slot.',
        });
    }
    for (const [field, values] of [
        ['dependencies', payload.dependencies],
        ['toolKeys', payload.toolKeys],
        ['commandKeys', payload.commandKeys],
        ['policyRefs', payload.policyRefs],
        ['canonicalRefs', payload.canonicalRefs],
        ['memoryRefs', payload.memoryRefs],
    ]) {
        if (new Set(values).size !== values.length) {
            ctx.addIssue({
                code: 'custom',
                path: [field],
                message: `${field} must not contain duplicate identifiers.`,
            });
        }
    }
});
exports.AgentExecutionPlanSchema = zod_1.z
    .object({
    id: IdentifierSchema,
    workspaceId: IdentifierSchema,
    userId: IdentifierSchema,
    runId: IdentifierSchema,
    contextReceiptId: IdentifierSchema,
    orchestratorKey: AgentKeySchema,
    orchestratorVersion: VersionSchema,
    planVersion: zod_1.z.number().int().min(1).max(1_000_000),
    maxParallelism: zod_1.z.number().int().min(1).max(256),
    steps: zod_1.z.array(exports.AgentExecutionStepSchema).min(1).max(64),
    createdAt: DateTimeSchema,
})
    .superRefine((plan, ctx) => {
    if (plan.orchestratorKey !== 'agent.control.orchestrator') {
        ctx.addIssue({
            code: 'custom',
            path: ['orchestratorKey'],
            message: 'Execution plans must be compiled by agent.control.orchestrator.',
        });
    }
    if (plan.maxParallelism > plan.steps.length) {
        ctx.addIssue({
            code: 'custom',
            path: ['maxParallelism'],
            message: 'maxParallelism cannot exceed the number of plan steps.',
        });
    }
    const keys = new Set();
    plan.steps.forEach((step, index) => {
        if (step.agentKey === 'agent.control.orchestrator') {
            ctx.addIssue({
                code: 'custom',
                path: ['steps', index, 'agentKey'],
                message: 'Execution plan steps cannot recursively target the orchestrator.',
            });
        }
        if (step.budget.maxConcurrency !== 1) {
            ctx.addIssue({
                code: 'custom',
                path: ['steps', index, 'budget', 'maxConcurrency'],
                message: 'Nested specialist concurrency is not enabled in the bounded execution foundation.',
            });
        }
        if (keys.has(step.key)) {
            ctx.addIssue({
                code: 'custom',
                path: ['steps', index, 'key'],
                message: `Duplicate execution step key: ${step.key}.`,
            });
        }
        keys.add(step.key);
        const arrays = [
            ['dependencies', step.dependencies],
            ['toolKeys', step.toolKeys],
            ['commandKeys', step.commandKeys],
            ['policyRefs', step.policyRefs],
            ['canonicalRefs', step.canonicalRefs],
            ['memoryRefs', step.memoryRefs],
        ];
        for (const [field, values] of arrays) {
            if (new Set(values).size !== values.length) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['steps', index, field],
                    message: `${field} must not contain duplicate identifiers.`,
                });
            }
        }
    });
    plan.steps.forEach((step, index) => {
        step.dependencies.forEach((dependency, dependencyIndex) => {
            if (dependency === step.key) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['steps', index, 'dependencies', dependencyIndex],
                    message: 'A plan step cannot depend on itself.',
                });
            }
            if (!keys.has(dependency)) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['steps', index, 'dependencies', dependencyIndex],
                    message: `Unknown plan dependency: ${dependency}.`,
                });
            }
        });
    });
    const byKey = new Map(plan.steps.map((step) => [step.key, step]));
    const visiting = new Set();
    const visited = new Set();
    function visit(stepKey) {
        if (visiting.has(stepKey))
            return false;
        if (visited.has(stepKey))
            return true;
        const step = byKey.get(stepKey);
        if (!step)
            return true;
        visiting.add(stepKey);
        for (const dependency of step.dependencies) {
            if (!visit(dependency))
                return false;
        }
        visiting.delete(stepKey);
        visited.add(stepKey);
        return true;
    }
    for (const step of plan.steps) {
        if (!visit(step.key)) {
            ctx.addIssue({
                code: 'custom',
                path: ['steps'],
                message: 'Execution plan dependencies must form an acyclic DAG.',
            });
            break;
        }
    }
});
//# sourceMappingURL=agent-execution.js.map