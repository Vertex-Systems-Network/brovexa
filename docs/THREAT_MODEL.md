# Brovexa — Threat Model & Security Control Architecture

Status: **Planning Only — security architecture, not certification**

## Baselines
OWASP ASVS 5.0.0; OWASP SSRF guidance; current OWASP GenAI risks including prompt injection, sensitive-data disclosure, poisoning, excessive agency, vector/embedding weaknesses and unbounded consumption; NIST AI RMF/GenAI lifecycle risk/evaluation practices.

## Assets
Auth/session/MFA/reset/invites; tenant/RBAC; connector/payment/model secrets; customer first-party and business-contact data; evidence/provenance; canonical Business/Lead/Deal; Agent/prompt/policy definitions; durable memory/indexes; SourcePolicy/Jurisdiction/suppression; credits/billing/entitlements; audit history; signed release artifacts.

## Trust boundaries
Internet↔public/auth; browser↔Web/API; Desktop OS/client↔API; hostile webpage DOM↔extension content script↔privileged extension/API; services↔DB/storage/cache/search/vector; API↔queues/workers; Brovexa↔web/source endpoints; Brovexa↔models; Brovexa↔CRM/payment/SaaS; tenant↔tenant; model output↔deterministic command; memory↔derived vector index; CI/build↔production.

## Severity
P0 Critical: cross-tenant/secret/payment-policy compromise, unauthorized external action at scale, unrecoverable corruption. P1 High: material data/integrity/agent/memory/cost compromise. P2 scoped/recoverable; P3 low.
No unresolved P0 may ship. Launch-critical P1 needs mitigation/owner/evidence.

## Threats and controls

### T01 Broken tenant authorization — P0
Server-derived tenant principal; object-level auth every command/query; scoped service accounts; permission-aware caches/search/vectors; comprehensive tenant A/B API/job/export/file/memory/integration tests. Zero cross-tenant access tolerance.

### T02 Auth/session/reset/invite abuse — P0/P1
Enumeration-safe flows, rate/risk controls, short single-use tokens, secure cookie/session rotation, MFA/passkey-ready, explicit OAuth linking, session/device revocation, audit.

### T03 RBAC/privilege escalation — P0
Deny-by-default permission matrix, server command auth, role-change audit/re-auth for sensitive actions, no model authority to mutate security/billing/compliance roles.

### T04 Secret leakage — P0
Secret manager/refs, redacted logs/tool traces, scoped rotation, no secrets in prompts/domain rows/content scripts; Desktop OS-secure storage.

### T05 SSRF/unsafe acquisition — P0/P1
Isolated fetcher/egress proxy; validate scheme/host/IP every hop; block private/loopback/link-local/metadata; DNS/redirect revalidation; allowlisted ports/methods; no ambient credentials; strict byte/time/redirect/type limits; test IPv4/IPv6/encoding/rebinding/redirect tricks.

### T06 Malicious fetched content/XSS/file — P1
Never trust/render raw HTML; sanitize/encode; CSP; safe file/content viewers; isolated parsing; size/type/malware controls.

### T07 Direct/indirect prompt injection — P0/P1
External content tagged untrusted; separate system policy from data; structured tools; least privilege; Security Critic; no source text as instructions; deterministic command validators; multilingual/hidden/nested injection red tests.

### T08 Excessive agency — P0
Minimal tools/permissions/autonomy, T0–T4, server policy/budget, no raw DB/shell/credentials, no launch autonomous send/policy/suppression/billing/destructive changes, bounded WorkUnits/evaluator gates.

### T09 Tool argument/output injection — P1
Strict schemas/normalization, parameterized data access, no shell/eval interpolation, encoded downstream display and classified tool results.

### T10 Persistent memory poisoning — P0/P1
Memory promotion pipeline, provenance/authority, no direct web→procedural memory, governed global procedures, conflicts/quarantine, scoped write rights, expiry and red-team cases.

### T11 Vector/RAG tenant leakage/poisoning — P0
Canonical ACL before retrieval, tenant/entity filters/partitioning, minimum necessary indexed text, derived/rebuildable vector refs, source validation, ContextReceipt and deletion propagation. Zero cross-tenant retrieval.

### T12 Model-sensitive information disclosure — P0/P1
Classification-aware Context Builder/model routing, minimum context, approved provider policy/residency, redaction/output validation, no secret context.

### T13 Evidence/source poisoning — P1
SourceReference/hash/time/authority, official/multi-source rules, Evidence Verifier, contradictions retained, model-cited URL is never proof until actually fetched/verified.

### T14 Entity poisoning/false merge — P1
Strict deterministic+AI threshold, ambiguous merge review, reversible merge/split, impact preview and high-collision tests.

### T15 Fake contact/buyer hallucination — P1
Role gap ≠ person; contact needs provenance/verification/freshness; no guessed email marked verified by default; personalization validator.

### T16 ResearchJob scope escalation — P1
Natural-language compiler→editable structured JobVersion; deterministic preflight; hard source/geo/purpose/spend bounds; material expansion creates new version/review.

### T17 Denial of wallet/fan-out — P1
Preflight estimates, hard budgets/quotas/workunit limits, bounded DAG/concurrency, retry caps/circuit breakers, kill switches, budget reservation ledger and spend-velocity alerts.

### T18 Retry/idempotency duplicate effects — P1
Canonical run/workunit DB state, idempotency, transactional effect+outbox, checkpoint verification, dead-letter/review; never depend on transport exactly-once guarantees.

### T19 Cancel/partial inconsistency — P1/P2
Stage-level valid commits, cancellation stops new work, no long DB transaction across external APIs, Partial remains explicit.

### T20 CRM/webhook/import poisoning — P1
Signature/replay/idempotency, staged file import, CSV formula safety, FieldAuthority/conflict queue, loop prevention/reconciliation/provenance.

### T21 Cross-workspace first-party contamination — P0
Strict tenant/purpose class, no cross-customer global use/training absent separate lawful contract, index isolation and eval sanitization.

### T22 Browser-extension attack surface — P1
Least/optional host permissions, typed/origin-checked messages, hostile page isolation, no reusable token in content script, CSP/no remote code, capture preview and signed store releases.

### T23 Desktop deep-link/local/update abuse — P1
Deep links are untrusted navigation input, re-auth/revalidation, OS-secure credential storage, minimal encrypted cache, signed updates, restricted IPC/no arbitrary command.

### T24 Payment entitlement fraud — P0
Signed server webhook, idempotent/out-of-order state machine, redirect never provisions, canonical Subscription/Credit ledger + reconciliation.

### T25 Credit/accounting race — P1
Atomic append-only reserve/consume/refund, rate-table version, hard workspace cap and reconciliation.

### T26 Outreach/spam/suppression bypass — P0/P1
Action-time ContactEligibility, monotonic suppression, frequency/abuse controls, human approval launch, jurisdiction profiles, import/API cannot bypass.

### T27 Opt-out race — P1
Eligibility recheck immediately before external action; suppression cancels pending outbound; opt-out webhooks high priority.

### T28 API/outbound webhook abuse — P1
Scopes/rates, signed outbound webhook, callback SSRF validation, rotation/idempotency/payload minimization/destination verification.

### T29 Search/export exfiltration — P1
Field-level auth/source-export policy at query/export, limits/audit, expiring private files, no hidden restricted columns.

### T30 Object storage leakage — P1
Private bucket, tenant auth before short signed URL, randomized keys, retention/malware/type rules.

### T31 Audit tampering — P1
Restricted append-only audit write path, correlation/time integrity, privileged coverage, immutable/isolated retention and alerts.

### T32 Supply-chain/CI compromise — P0
Lockfiles/review/scans, minimal workflow permissions, pinned trusted actions, protected review, SBOM, signed/provenanced releases and SLSA-aligned hardening.

### T33 Compromised model/provider/regression — P1
Approved providers/data terms, version pin/evals/shadow-canary, output validators, allowlisted fallback and rapid rollback.

### T34 Evaluator rubber-stamp/correlated failure — P1
Independent evidence/context, deterministic validators first, selected evaluator diversity, human samples/disagreement monitoring.

### T35 Policy/config poisoning — P0/P1
Versioned immutable policy/agent/service definitions, permissioned review/publish, no ordinary model writes, audit/rollback.

### T36 Retention/delete remnants — P1
Checkpointed delete orchestration through canonical memory/search/vector/object/provider state with verification; backup expiry semantics truthful.

### T37 Backup/ransomware — P0/P1
Encrypted isolated/immutable backups, separate privileges, restore drills/RPO/RTO/key recovery.

### T38 Telemetry leakage — P1
Structured redacted classification-aware logs; no raw secrets/PII/prompt/source content by default; limited access/retention.

### T39 Support/admin impersonation — P1
Audited time-limited/break-glass access, no password viewing, post-use review and user/security audit visibility where appropriate.

### T40 Provider outage/concentration — P2/P1
Degraded/Partial states, circuit breakers, approved fallbacks only, durable checkpoints, user-visible status; no fake completion.

## Application baseline
Map implementation to versioned OWASP ASVS 5.0.0 requirements rather than a generic `OWASP compliant` claim.

## AI security boundary
Security lives below the model: allowlisted AgentDefinition, auth/policy/budget commands, strict tool schema, untrusted-content isolation, scoped Context Builder, verifier/evaluator, deterministic canonical mutations. System prompts are defense-in-depth—not access control.

## Wave A release security gates
Tenant-isolation suite; auth/reset/RBAC suite; SSRF/egress red-team; prompt/tool/memory poisoning; evidence/entity poisoning; hard-budget/fan-out; suppression/contactability; webhook/import/idempotency; secret/log review; backup restore; SBOM/provenance; launch ASVS control mapping.

## Incident hooks
P0/P1 SecurityEvent can deterministically disable connector/model/AgentDefinition, revoke token, stop jobs, quarantine memory/index records or block outbound; all recovery audited.

## Gate
Cross-link controls into agent evals, architecture ADRs, multi-client/auth plans and production hardening. Every new connector/agent/client requires a threat delta review.