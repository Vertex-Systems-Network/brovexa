import { type SourceDiscoveryDedupBatch, type SourceDiscoveryDedupGroup } from './source-discovery-dedup';
export type SourceDiscoveryDedupEvaluationInput = Pick<SourceDiscoveryDedupBatch, 'candidates' | 'evidence'>;
export declare function evaluateSourceDiscoveryDedup(input: SourceDiscoveryDedupEvaluationInput): SourceDiscoveryDedupGroup[];
