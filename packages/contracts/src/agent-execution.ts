import { z } from 'zod';
import { AgentBudgetSchema } from './ai';

const IdentifierSchema = z.string().trim().min(1).max(128);
const VersionSchema = z.string().trim().min(1).max(64);
const DateTimeSchema = z.string().datetime();
const StepKeySchema = z.string().regex(/^[a-z][a-z0-9_.-]{0,127}$/);
const AgentKeySchema = z.string().regex(/^agent\.[a-z0-9_.-]+$/);

export const AgentExecutionStepSchema = z.object({
  key: StepKeySchema,
  agentKey: AgentKeySchema,
  agentVersion: VersionSchema,
  dependencies: z.array(StepKeySchema).max(64),
  toolKeys: z.array(IdentifierSchema).max(128),
  commandKeys: z.array(IdentifierSchema).max(128),
  policyRefs: z.array(IdentifierSchema).min(1).max(128),
  canonicalRefs: z.array(IdentifierSchema).max(512),
  memoryRefs: z.array(IdentifierSchema).max(512),
  budget: AgentBudgetSchema,
});
export type AgentExecutionStep = z.infer<typeof AgentExecutionStepSchema>;

export const AgentExecutionPlanSchema = z
  .object({
    id: IdentifierSchema,
    workspaceId: IdentifierSchema,
    userId: IdentifierSchema,
    runId: IdentifierSchema,
    contextReceiptId: IdentifierSchema,
    orchestratorKey: AgentKeySchema,
    orchestratorVersion: VersionSchema,
    planVersion: z.number().int().min(1).max(1_000_000),
    maxParallelism: z.number().int().min(1).max(256),
    steps: z.array(AgentExecutionStepSchema).min(1).max(64),
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

    const keys = new Set<string>();
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
      ] as const;
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
    const visiting = new Set<string>();
    const visited = new Set<string>();

    function visit(stepKey: string): boolean {
      if (visiting.has(stepKey)) return false;
      if (visited.has(stepKey)) return true;
      const step = byKey.get(stepKey);
      if (!step) return true;

      visiting.add(stepKey);
      for (const dependency of step.dependencies) {
        if (!visit(dependency)) return false;
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
export type AgentExecutionPlan = z.infer<typeof AgentExecutionPlanSchema>;
