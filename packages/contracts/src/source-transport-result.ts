import { URL } from 'node:url';
import { z } from 'zod';
import { SourceTransportAdmissionDecisionSchema } from './source-transport';
import { SourceTransportHopChainSchema } from './source-transport-hop-chain';

const IdentifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const VersionSchema = z.string().trim().min(1).max(64);
const DateTimeSchema = z.string().datetime();
const UrlSchema = z.string().url().max(2048);
const ContentTypeSchema = z
  .string()
  .trim()
  .min(3)
  .max(128)
  .regex(/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/);
const NonNegativeSafeIntegerSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const TerminalHttpStatusSchema = z
  .number()
  .int()
  .min(100)
  .max(599)
  .refine((status) => status < 300 || status > 399, 'A terminal transport receipt must not use a redirect status.');

function canonicalUrl(value: string): string {
  return new URL(value).href;
}

export const SourceTransportResponseReceiptSchema = z
  .object({
    version: z.literal('1.0.0'),
    receiptId: IdentifierSchema,
    sourceRequestId: IdentifierSchema,
    sourceTaskId: IdentifierSchema,
    connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    transportPolicyId: IdentifierSchema,
    transportPolicyVersion: VersionSchema,
    hopChain: SourceTransportHopChainSchema,
    hopAdmissions: z.array(SourceTransportAdmissionDecisionSchema).min(1).max(11),
    final: z
      .object({
        transportRequestId: IdentifierSchema,
        url: UrlSchema,
        status: TerminalHttpStatusSchema,
        contentType: ContentTypeSchema,
        responseBytes: NonNegativeSafeIntegerSchema,
        elapsedMs: NonNegativeSafeIntegerSchema.max(120_000),
        receivedAt: DateTimeSchema,
        bodyDigest: z
          .object({
            algorithm: z.literal('sha256'),
            value: z.string().regex(/^[0-9a-f]{64}$/),
          })
          .strict(),
      })
      .strict(),
    bodyIncluded: z.literal(false),
  })
  .strict()
  .superRefine((receipt, ctx) => {
    const chain = receipt.hopChain;
    if (
      chain.sourceRequestId !== receipt.sourceRequestId ||
      chain.sourceTaskId !== receipt.sourceTaskId ||
      chain.connectorKey !== receipt.connectorKey ||
      chain.connectorVersion !== receipt.connectorVersion ||
      chain.transportPolicyId !== receipt.transportPolicyId ||
      chain.transportPolicyVersion !== receipt.transportPolicyVersion
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['hopChain'],
        message: 'Transport result identity must exactly match the hop-chain identity.',
      });
    }

    if (receipt.hopAdmissions.length !== chain.hops.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['hopAdmissions'],
        message: 'Every transport hop must have exactly one corresponding admission decision.',
      });
    }

    const alignedCount = Math.min(receipt.hopAdmissions.length, chain.hops.length);
    for (let index = 0; index < alignedCount; index += 1) {
      const hop = chain.hops[index];
      const admission = receipt.hopAdmissions[index];
      if (!hop || !admission) continue;

      if (admission.decision !== 'allow') {
        ctx.addIssue({
          code: 'custom',
          path: ['hopAdmissions', index, 'decision'],
          message: 'Executed transport hops require an allow admission decision.',
        });
      }
      if (
        admission.sourceRequestId !== receipt.sourceRequestId ||
        admission.connectorKey !== receipt.connectorKey ||
        admission.connectorVersion !== receipt.connectorVersion ||
        admission.transportPolicyId !== receipt.transportPolicyId ||
        admission.transportPolicyVersion !== receipt.transportPolicyVersion
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['hopAdmissions', index],
          message: 'Hop admission identity must match the transport result identity.',
        });
      }
      if (admission.transportRequestId !== hop.transportRequestId) {
        ctx.addIssue({
          code: 'custom',
          path: ['hopAdmissions', index, 'transportRequestId'],
          message: 'Hop admission must bind to the same transport request ID as its hop evidence.',
        });
      }
      if (canonicalUrl(admission.canonicalUrl) !== canonicalUrl(hop.url)) {
        ctx.addIssue({
          code: 'custom',
          path: ['hopAdmissions', index, 'canonicalUrl'],
          message: 'Hop admission canonical URL must exactly match its hop URL.',
        });
      }
      if (Date.parse(admission.evaluatedAt) < Date.parse(hop.resolution.resolvedAt)) {
        ctx.addIssue({
          code: 'custom',
          path: ['hopAdmissions', index, 'evaluatedAt'],
          message: 'Hop admission cannot predate the resolution evidence it authorizes.',
        });
      }
    }

    const lastHop = chain.hops.at(-1);
    const finalAdmission = receipt.hopAdmissions.at(-1);
    if (!lastHop || !finalAdmission) return;

    if (receipt.final.transportRequestId !== lastHop.transportRequestId) {
      ctx.addIssue({
        code: 'custom',
        path: ['final', 'transportRequestId'],
        message: 'Final response must bind to the terminal hop transport request ID.',
      });
    }
    if (canonicalUrl(receipt.final.url) !== canonicalUrl(lastHop.url)) {
      ctx.addIssue({
        code: 'custom',
        path: ['final', 'url'],
        message: 'Final response URL must exactly match the terminal hop URL.',
      });
    }
    if (receipt.final.responseBytes > finalAdmission.maxResponseBytes) {
      ctx.addIssue({
        code: 'custom',
        path: ['final', 'responseBytes'],
        message: 'Final response bytes must not exceed the admitted byte budget.',
      });
    }
    if (receipt.final.elapsedMs > finalAdmission.timeoutMs) {
      ctx.addIssue({
        code: 'custom',
        path: ['final', 'elapsedMs'],
        message: 'Final response elapsed time must not exceed the admitted timeout budget.',
      });
    }
    if (Date.parse(receipt.final.receivedAt) < Date.parse(finalAdmission.evaluatedAt)) {
      ctx.addIssue({
        code: 'custom',
        path: ['final', 'receivedAt'],
        message: 'Final response cannot predate its terminal-hop admission decision.',
      });
    }
  });

export type SourceTransportResponseReceipt = z.infer<typeof SourceTransportResponseReceiptSchema>;

export function parseSourceTransportResponseReceipt(rawReceipt: unknown): SourceTransportResponseReceipt {
  return SourceTransportResponseReceiptSchema.parse(rawReceipt);
}
