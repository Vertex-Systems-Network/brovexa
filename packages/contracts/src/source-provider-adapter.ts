/**
 * M03 PROVIDER Slot: Provider Adapter Interface
 * 
 * Provider-neutral adapter interface for LLM provider integration.
 * Maintains networkAccess: 'none' for production - test-only injected responses.
 * No credentials, no external HTTP calls, deterministic behavior only.
 */

import { z } from 'zod';

// ============================================================================
// Core Types & Enums
// ============================================================================

export enum ProviderCapability {
  // Model capabilities
  CHAT_COMPLETION = 'chat_completion',
  TEXT_COMPLETION = 'text_completion',
  EMBEDDING = 'embedding',
  IMAGE_GENERATION = 'image_generation',
  AUDIO_TRANSCRIPTION = 'audio_transcription',
  
  // Context capabilities
  CONTEXT_WINDOW_4K = 'context_4k',
  CONTEXT_WINDOW_8K = 'context_8k',
  CONTEXT_WINDOW_16K = 'context_16k',
  CONTEXT_WINDOW_32K = 'context_32k',
  CONTEXT_WINDOW_64K = 'context_64k',
  CONTEXT_WINDOW_128K = 'context_128k',
  CONTEXT_WINDOW_1M = 'context_1m',
  
  // Feature capabilities
  FUNCTION_CALLING = 'function_calling',
  STRUCTURED_OUTPUT = 'structured_output',
  STREAMING = 'streaming',
  VISION = 'vision',
  TOOL_USE = 'tool_use',
  
  // Safety capabilities
  CONTENT_FILTERING = 'content_filtering',
  PII_REDACTION = 'pii_redaction',
  SAFETY_CLASSIFICATION = 'safety_classification',
}

export enum ProviderSafetyLevel {
  NONE = 'none',
  BASIC = 'basic',
  ENHANCED = 'enhanced',
  STRICT = 'strict',
}

export enum AdapterStatus {
  ACTIVE = 'active',
  DEGRADED = 'degraded',
  DISABLED = 'disabled',
  MAINTENANCE = 'maintenance',
}

// ============================================================================
// Schemas
// ============================================================================

export const ProviderIdentitySchema = z.object({
  providerId: z.string().max(64),
  providerName: z.string().max(128),
  adapterVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  networkAccess: z.literal('none'), // MANDATORY: No production network access
  isTestOnly: z.boolean(),
  safetyAttestations: z.object({
    noCredentialsUsed: z.boolean(),
    noExternalHttpCalls: z.boolean(),
    deterministicResponses: z.boolean(),
    noTenantDataLogged: z.boolean(),
  }),
});

export const ProviderCapabilitySchema = z.object({
  capability: z.nativeEnum(ProviderCapability),
  supported: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
});

export const ProviderModelInfoSchema = z.object({
  modelId: z.string().max(128),
  modelName: z.string().max(256),
  capabilities: z.array(ProviderCapabilitySchema),
  contextWindow: z.number().int().positive(),
  safetyLevel: z.nativeEnum(ProviderSafetyLevel),
  inputTokenLimit: z.number().int().positive().optional(),
  outputTokenLimit: z.number().int().positive().optional(),
});

export const ProviderAdapterConfigSchema = z.object({
  providerId: z.string().max(64),
  modelId: z.string().max(128),
  timeoutMs: z.number().int().positive().default(30000),
  maxRetries: z.number().int().nonnegative().default(3),
  safetyLevel: z.nativeEnum(ProviderSafetyLevel).default(ProviderSafetyLevel.ENHANCED),
  enabledCapabilities: z.array(z.nativeEnum(ProviderCapability)).default([]),
  testResponseInjection: z.boolean().default(true), // MUST be true for M03
});

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().max(100000),
  toolCallId: z.string().max(128).optional(),
  toolCalls: z.array(z.object({
    id: z.string().max(128),
    type: z.literal('function'),
    function: z.object({
      name: z.string().max(128),
      arguments: z.string().max(10000),
    }),
  })).optional(),
});

export const ChatCompletionRequestSchema = z.object({
  requestId: z.string().uuid(),
  messages: z.array(ChatMessageSchema).min(1).max(100),
  modelId: z.string().max(128),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  stopSequences: z.array(z.string().max(100)).optional(),
  stream: z.boolean().default(false),
  tools: z.array(z.object({
    name: z.string().max(128),
    description: z.string().max(512),
    parameters: z.record(z.unknown()),
  })).optional(),
});

export const ChatCompletionResponseSchema = z.object({
  requestId: z.string().uuid(),
  providerId: z.string().max(64),
  modelId: z.string().max(128),
  choices: z.array(z.object({
    index: z.number().int().nonnegative(),
    message: ChatMessageSchema,
    finishReason: z.enum(['stop', 'length', 'tool_calls', 'content_filter']).optional(),
  })).min(1),
  usage: z.object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
  durationMs: z.number().int().positive(),
  isTestResponse: z.boolean(), // MUST be true for M03
});

export const AdapterHealthStatusSchema = z.object({
  providerId: z.string().max(64),
  status: z.nativeEnum(AdapterStatus),
  lastCheckTime: z.string().datetime(),
  responseTimeMs: z.number().int().positive().optional(),
  errorRate: z.number().min(0).max(1).optional(),
  activeRequests: z.number().int().nonnegative(),
  capabilities: z.array(ProviderCapabilitySchema),
});

export const AdapterExecutionResultSchema = z.object({
  success: z.boolean(),
  requestId: z.string().uuid(),
  providerId: z.string().max(64),
  response: ChatCompletionResponseSchema.optional(),
  error: z.object({
    code: z.string().max(64),
    message: z.string().max(512),
    retryable: z.boolean(),
  }).optional(),
  durationMs: z.number().int().positive(),
  isTestExecution: z.boolean(),
  safetyChecksPassed: z.boolean(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ProviderIdentity = z.infer<typeof ProviderIdentitySchema>;
export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>;
export type ProviderModelInfo = z.infer<typeof ProviderModelInfoSchema>;
export type ProviderAdapterConfig = z.infer<typeof ProviderAdapterConfigSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;
export type ChatCompletionResponse = z.infer<typeof ChatCompletionResponseSchema>;
export type AdapterHealthStatus = z.infer<typeof AdapterHealthStatusSchema>;
export type AdapterExecutionResult = z.infer<typeof AdapterExecutionResultSchema>;

// ============================================================================
// Provider Adapter Interface
// ============================================================================

/**
 * Provider Adapter Interface
 * 
 * All provider adapters MUST implement this interface.
 * Network access is strictly forbidden (networkAccess: 'none').
 * All responses must be test-injected and deterministic.
 */
export interface IProviderAdapter {
  /**
   * Get adapter identity with safety attestations
   */
  getIdentity(): ProviderIdentity;
  
  /**
   * Get supported model information
   */
  getModelInfo(modelId: string): Promise<ProviderModelInfo>;
  
  /**
   * Get current health status
   */
  getHealthStatus(): Promise<AdapterHealthStatus>;
  
  /**
   * Execute chat completion request (TEST-ONLY, no external calls)
   */
  chatCompletion(request: ChatCompletionRequest): Promise<AdapterExecutionResult>;
  
  /**
   * Validate configuration before activation
   */
  validateConfig(config: ProviderAdapterConfig): Promise<boolean>;
  
  /**
   * Check if specific capability is supported
   */
  supportsCapability(capability: ProviderCapability): boolean;
  
  /**
   * Graceful shutdown
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// Test Response Injection Helpers
// ============================================================================

/**
 * Generate deterministic test response based on request
 * NO external API calls, NO credentials used
 */
export function generateTestResponse(request: ChatCompletionRequest): ChatCompletionResponse {
  const now = Date.now();
  const durationMs = Math.floor(Math.random() * 100) + 50; // 50-150ms simulated
  
  // Deterministic response based on message count
  const messageCount = request.messages.length;
  const estimatedTokens = messageCount * 15 + 20;
  
  return {
    requestId: request.requestId,
    providerId: 'test-provider',
    modelId: request.modelId,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: `[TEST RESPONSE] Received ${messageCount} messages. This is a deterministic test response with no external API calls.`,
      },
      finishReason: 'stop',
    }],
    usage: {
      promptTokens: estimatedTokens,
      completionTokens: 25,
      totalTokens: estimatedTokens + 25,
    },
    durationMs,
    isTestResponse: true,
  };
}

/**
 * Simulate various error scenarios for testing
 */
export function generateTestError(
  requestId: string,
  providerId: string,
  errorCode: 'TIMEOUT' | 'RATE_LIMIT' | 'INVALID_REQUEST' | 'SERVICE_UNAVAILABLE'
): AdapterExecutionResult {
  const errorMessages: Record<string, string> = {
    TIMEOUT: 'Request timed out after 30000ms (simulated)',
    RATE_LIMIT: 'Rate limit exceeded (simulated)',
    INVALID_REQUEST: 'Invalid request format (simulated)',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable (simulated)',
  };
  
  return {
    success: false,
    requestId,
    providerId,
    error: {
      code: errorCode,
      message: errorMessages[errorCode],
      retryable: errorCode === 'TIMEOUT' || errorCode === 'SERVICE_UNAVAILABLE',
    },
    durationMs: errorCode === 'TIMEOUT' ? 30000 : Math.floor(Math.random() * 100) + 10,
    isTestExecution: true,
    safetyChecksPassed: true,
  };
}

/**
 * Create mock adapter identity
 */
export function createMockIdentity(providerId: string, providerName: string): ProviderIdentity {
  return {
    providerId,
    providerName,
    adapterVersion: '1.0.0',
    networkAccess: 'none',
    isTestOnly: true,
    safetyAttestations: {
      noCredentialsUsed: true,
      noExternalHttpCalls: true,
      deterministicResponses: true,
      noTenantDataLogged: true,
    },
  };
}

/**
 * Validate that adapter maintains security boundaries
 */
export function validateSecurityBoundaries(identity: ProviderIdentity): boolean {
  return (
    identity.networkAccess === 'none' &&
    identity.isTestOnly === true &&
    identity.safetyAttestations.noCredentialsUsed === true &&
    identity.safetyAttestations.noExternalHttpCalls === true &&
    identity.safetyAttestations.deterministicResponses === true
  );
}
