/**
 * Source Redirect Hop Validation
 * 
 * Revalidates destination evidence at every redirect hop during source transport.
 * Enforces redirect budgets, rejects unsafe/rebound/mixed destinations,
 * and maintains fail-closed security posture throughout redirect chains.
 * 
 * @module source-redirect-hop-validation
 * @see {@link https://github.com/brovexa/brovexa/issues/53} - Slot registry
 * @see {@link ../docs/AI_NATIVE_PLAN.md} - M02 REDIRECT workstream
 */

import type { TransportEvidence } from './source-transport-observability';

/**
 * Classification types for redirect destinations
 */
export type DestinationClassification =
  | 'public_https'
  | 'public_http'
  | 'private_ipv4'
  | 'private_ipv6'
  | 'loopback_ipv4'
  | 'loopback_ipv6'
  | 'link_local_ipv4'
  | 'link_local_ipv6'
  | 'multicast_ipv4'
  | 'multicast_ipv6'
  | 'metadata_endpoint'
  | 'unspecified'
  | 'reserved'
  | 'documentation'
  | 'unknown';

/**
 * Evidence required for each redirect hop
 */
export interface RedirectHopEvidence {
  /** Hop index in the redirect chain (0-based) */
  hopIndex: number;
  /** URL at this hop */
  url: string;
  /** Destination classification at this hop */
  classification: DestinationClassification;
  /** DNS resolution evidence if applicable */
  dnsEvidence?: {
    resolvedAddresses: string[];
    resolverTimestamp: number;
    ttlSeconds: number;
  };
  /** TLS certificate evidence for HTTPS */
  tlsEvidence?: {
    subject: string;
    issuer: string;
    validFrom: number;
    validTo: number;
    fingerprint: string;
  };
  /** Timestamp when this hop was observed */
  observedAt: number;
}

/**
 * Result of validating a single redirect hop
 */
export interface RedirectHopValidationResult {
  /** Whether this hop is valid */
  isValid: boolean;
  /** Hop index being validated */
  hopIndex: number;
  /** Current URL at this hop */
  currentUrl: string;
  /** Previous URL (if any) */
  previousUrl?: string;
  /** Current destination classification */
  currentClassification: DestinationClassification;
  /** Previous classification (if any) */
  previousClassification?: DestinationClassification;
  /** Reason for rejection if invalid */
  rejectionReason?: string;
  /** Security flags detected */
  securityFlags: {
    /** Downgrade from HTTPS to HTTP */
    isDowngrade: boolean;
    /** Transition to private/reserved space */
    isPrivateTransition: boolean;
    /** Metadata endpoint access attempt */
    isMetadataAccess: boolean;
    /** Classification changed unexpectedly */
    isClassificationChange: boolean;
  };
}

/**
 * Configuration for redirect validation
 */
export interface RedirectValidationConfig {
  /** Maximum number of redirects allowed */
  maxRedirects: number;
  /** Whether to allow HTTP downgrades (default: false) */
  allowHttpDowngrade: boolean;
  /** Whether to allow transitions to private addresses (default: false) */
  allowPrivateTransition: boolean;
  /** Whether to require consistent classification across hops */
  requireConsistentClassification: boolean;
  /** Allowed classification transitions (upgrade paths) */
  allowedTransitions?: Array<{
    from: DestinationClassification;
    to: DestinationClassification;
  }>;
}

/**
 * Default redirect validation configuration (fail-closed)
 */
export const DEFAULT_REDIRECT_CONFIG: RedirectValidationConfig = {
  maxRedirects: 5,
  allowHttpDowngrade: false,
  allowPrivateTransition: false,
  requireConsistentClassification: true,
  allowedTransitions: [
    // Allow upgrade from HTTP to HTTPS for public destinations
    { from: 'public_http', to: 'public_https' },
  ],
};

/**
 * Validate a single redirect hop against security policies
 * 
 * @param hopEvidence - Evidence for the current redirect hop
 * @param previousEvidence - Evidence from the previous hop (if any)
 * @param config - Validation configuration
 * @returns Validation result with security flags
 */
export function validateRedirectHop(
  hopEvidence: RedirectHopEvidence,
  previousEvidence: RedirectHopEvidence | null,
  config: RedirectValidationConfig = DEFAULT_REDIRECT_CONFIG
): RedirectHopValidationResult {
  const securityFlags = {
    isDowngrade: false,
    isPrivateTransition: false,
    isMetadataAccess: false,
    isClassificationChange: false,
  };

  const result: RedirectHopValidationResult = {
    isValid: true,
    hopIndex: hopEvidence.hopIndex,
    currentUrl: hopEvidence.url,
    previousUrl: previousEvidence?.url,
    currentClassification: hopEvidence.classification,
    previousClassification: previousEvidence?.classification,
    securityFlags,
  };

  // Check hop count budget
  if (hopEvidence.hopIndex >= config.maxRedirects) {
    result.isValid = false;
    result.rejectionReason = `Redirect budget exceeded: hop ${hopEvidence.hopIndex} >= max ${config.maxRedirects}`;
    return result;
  }

  // Check for metadata endpoint access
  if (hopEvidence.classification === 'metadata_endpoint') {
    securityFlags.isMetadataAccess = true;
    result.isValid = false;
    result.rejectionReason = 'Redirect to cloud metadata endpoint blocked';
    return result;
  }

  // Check for private/reserved address transition
  const isPrivateClassification = (classification: DestinationClassification): boolean => {
    return [
      'private_ipv4',
      'private_ipv6',
      'loopback_ipv4',
      'loopback_ipv6',
      'link_local_ipv4',
      'link_local_ipv6',
      'multicast_ipv4',
      'multicast_ipv6',
      'unspecified',
      'reserved',
      'documentation',
    ].includes(classification);
  };

  if (previousEvidence) {
    const wasPublic = !isPrivateClassification(previousEvidence.classification);
    const isNowPrivate = isPrivateClassification(hopEvidence.classification);

    if (wasPublic && isNowPrivate) {
      securityFlags.isPrivateTransition = true;
      if (!config.allowPrivateTransition) {
        result.isValid = false;
        result.rejectionReason = 'Redirect from public to private/reserved address blocked';
        return result;
      }
    }

    // Check for HTTP downgrade (don't return early - allow multiple flags)
    const isHttps = (url: string): boolean => url.toLowerCase().startsWith('https://');
    const wasHttps = isHttps(previousEvidence.url);
    const isNowHttp = !isHttps(hopEvidence.url);

    if (wasHttps && isNowHttp) {
      securityFlags.isDowngrade = true;
      if (!config.allowHttpDowngrade) {
        result.isValid = false;
        result.rejectionReason = 'HTTPS to HTTP downgrade blocked';
        // Don't return early - allow classification change check to also run
      } else {
        // If downgrade is allowed, don't flag it as a security issue
        securityFlags.isDowngrade = false;
      }
    }

    // Check classification consistency (runs even if downgrade detected)
    if (config.requireConsistentClassification && 
        previousEvidence.classification !== hopEvidence.classification) {
      securityFlags.isClassificationChange = true;

      // Check if this transition is allowed
      const isAllowedTransition = config.allowedTransitions?.some(
        t => t.from === previousEvidence.classification && t.to === hopEvidence.classification
      );

      if (!isAllowedTransition && result.isValid) {
        // Only set rejection if not already rejected by downgrade check
        result.isValid = false;
        result.rejectionReason = `Classification change from '${previousEvidence.classification}' to '${hopEvidence.classification}' not allowed`;
      }
    }
  }

  return result;
}

/**
 * Validate an entire redirect chain
 * 
 * @param hopEvidenceList - Ordered list of evidence for each hop
 * @param config - Validation configuration
 * @returns Array of validation results for each hop
 */
export function validateRedirectChain(
  hopEvidenceList: RedirectHopEvidence[],
  config: RedirectValidationConfig = DEFAULT_REDIRECT_CONFIG
): RedirectHopValidationResult[] {
  const results: RedirectHopValidationResult[] = [];

  for (let i = 0; i < hopEvidenceList.length; i++) {
    const currentEvidence = hopEvidenceList[i];
    const previousEvidence = i > 0 ? hopEvidenceList[i - 1] : null;

    const result = validateRedirectHop(currentEvidence, previousEvidence, config);
    results.push(result);

    // Stop validation chain on first failure (fail-fast)
    if (!result.isValid) {
      break;
    }
  }

  return results;
}

/**
 * Extract destination classification from URL
 * 
 * This is a simplified classifier; in production this would integrate
 * with the full IP classification and DNS evidence system.
 * 
 * @param url - The URL to classify
 * @returns Destination classification
 */
export function classifyRedirectDestination(url: string): DestinationClassification {
  try {
    const parsed = new URL(url);
    // Remove brackets from IPv6 hostname for classification
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Check for metadata endpoints
    const metadataEndpoints = [
      '169.254.169.254',      // AWS EC2
      '169.254.170.2',        // AWS ECS/GCE
      '100.100.100.200',      // Aliyun
      'fd00:ec2::254',        // GCP IPv6
      'metadata.google.internal',
      'instance-data.aws.amazon.com',
    ];

    if (metadataEndpoints.some(ep => hostname.includes(ep))) {
      return 'metadata_endpoint';
    }

    // Check for IPv6 loopback
    if (hostname === '::1') {
      return 'loopback_ipv6';
    }
    
    // Check for IPv4 loopback (127.0.0.0/8)
    if (hostname === 'localhost' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return 'loopback_ipv4';
    }

    // Check for unspecified
    if (hostname === '0.0.0.0' || hostname === '::') {
      return 'unspecified';
    }

    // Basic IPv4 private range check
    if (/^10\./.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) || /^192\.168\./.test(hostname)) {
      return 'private_ipv4';
    }

    // Basic IPv6 unique local address (fc00::/7)
    if (/^f[cd][0-9a-f]{2}:/i.test(hostname)) {
      return 'private_ipv6';
    }

    // Link-local IPv4 (169.254.0.0/16)
    if (/^169\.254\./.test(hostname)) {
      // Already checked metadata endpoints above
      return 'link_local_ipv4';
    }

    // Link-local IPv6 (fe80::/10)
    if (/^fe[89ab][0-9a-f]:/i.test(hostname)) {
      return 'link_local_ipv6';
    }

    // Multicast IPv4 (224.0.0.0/4)
    if (/^22[4-9]\.|^23[0-9]\./.test(hostname)) {
      return 'multicast_ipv4';
    }

    // Multicast IPv6 (ff00::/8)
    if (/^ff/i.test(hostname)) {
      return 'multicast_ipv6';
    }

    // Documentation ranges
    if (/^192\.0\.2\./.test(hostname) || /^198\.51\.100\./.test(hostname) || /^203\.0\.113\./.test(hostname)) {
      return 'documentation';
    }

    // Reserved ranges (simplified)
    if (/^0\./.test(hostname) || /^100\.64\./.test(hostname) || /^198\.18\./.test(hostname)) {
      return 'reserved';
    }

    // Determine if HTTPS or HTTP
    if (parsed.protocol === 'https:') {
      return 'public_https';
    } else if (parsed.protocol === 'http:') {
      return 'public_http';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Create redirect hop evidence from a URL
 * 
 * @param hopIndex - Position in redirect chain
 * @param url - URL at this hop
 * @param dnsEvidence - Optional DNS resolution evidence
 * @param tlsEvidence - Optional TLS certificate evidence
 * @returns Redirect hop evidence
 */
export function createRedirectHopEvidence(
  hopIndex: number,
  url: string,
  dnsEvidence?: RedirectHopEvidence['dnsEvidence'],
  tlsEvidence?: RedirectHopEvidence['tlsEvidence']
): RedirectHopEvidence {
  return {
    hopIndex,
    url,
    classification: classifyRedirectDestination(url),
    dnsEvidence,
    tlsEvidence,
    observedAt: Date.now(),
  };
}

/**
 * Summarize redirect chain validation results
 */
export interface RedirectChainSummary {
  /** Total number of hops */
  totalHops: number;
  /** Whether all hops are valid */
  isValid: boolean;
  /** First failing hop index (if any) */
  firstFailureIndex?: number;
  /** Final destination classification */
  finalClassification?: DestinationClassification;
  /** Security issues detected */
  securityIssues: Array<{
    hopIndex: number;
    issue: string;
    flag: keyof RedirectHopValidationResult['securityFlags'];
  }>;
  /** All validation results */
  hopResults: RedirectHopValidationResult[];
}

/**
 * Generate a summary of redirect chain validation
 * 
 * @param results - Validation results from validateRedirectChain
 * @returns Summary of the validation
 */
export function summarizeRedirectValidation(
  results: RedirectHopValidationResult[]
): RedirectChainSummary {
  const securityIssues: RedirectChainSummary['securityIssues'] = [];
  
  for (const result of results) {
    if (!result.isValid) {
      // Record the first failure
      if (securityIssues.length === 0 || 
          securityIssues.every(i => i.hopIndex !== result.hopIndex)) {
        if (result.rejectionReason) {
          securityIssues.push({
            hopIndex: result.hopIndex,
            issue: result.rejectionReason,
            flag: Object.keys(result.securityFlags).find(
              key => result.securityFlags[key as keyof typeof result.securityFlags]
            ) as keyof RedirectHopValidationResult['securityFlags'] || 'isClassificationChange',
          });
        }
      }
    }

    // Record security flags
    for (const [flag, value] of Object.entries(result.securityFlags)) {
      if (value) {
        securityIssues.push({
          hopIndex: result.hopIndex,
          issue: `${flag} detected`,
          flag: flag as keyof RedirectHopValidationResult['securityFlags'],
        });
      }
    }
  }

  const firstFailure = results.find(r => !r.isValid);

  return {
    totalHops: results.length,
    isValid: results.every(r => r.isValid),
    firstFailureIndex: firstFailure?.hopIndex,
    finalClassification: results[results.length - 1]?.currentClassification,
    securityIssues,
    hopResults: results,
  };
}
