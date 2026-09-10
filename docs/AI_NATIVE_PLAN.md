# Brovexa AI-Native Multi-Agent Plan

Status: **ACTIVE**

This plan is the versioned source for Brovexa standing parallel capacity and Supervisor-controlled execution. Live occupancy is not stored here. The authoritative live slot registry is GitHub issue #53, and synchronization truth is the latest valid Supervisor broadcast comment in GitHub issue #50.

## Current execution objective

Milestone M02 remains active. The safe implementation direction is provider-neutral source transport and network-safety certification: deterministic destination classification, injected test-only resolution/transport, redirect-hop revalidation, bounded execution, persistence/audit evidence, observability, and adversarial verification.

The cycle must preserve `networkAccess: 'none'` for real provider traffic. It must not enable production provider HTTP, credentials, unrestricted discovery/acquisition, paid sends, or any external provider activation.

## Capacity model

Generic repository concurrency remains:

- target agents: 6;
- soft maximum: 8;
- scaling beyond the soft maximum requires deliberate Supervisor governance and reviewed evidence.

For the explicitly requested M02 provider-neutral network-safety cycle, five additional standing branches were created from exact current `main` before this governance mutation. The cycle may therefore use:

- 10 assignable worker slots;
- 1 Supervisor integration slot;
- 11 intended live writers in this explicit cycle;
- hard cap: 12 total live writers.

This is a bounded cycle authorization, not an automatic new-agent expansion rule. New-agent arrival still cannot invent branches or slots. If issue #53 has no assignable `OPEN` slot, the Supervisor response remains exactly **Go Home Come Back Next Time**.

### Standing slot definitions

| Slot | Standing branch | Assignable to new agent |
|---|---|---|
| `SUPERVISOR` | `supervisor/integration-control` | No |
| `CONTRACTS` | `agent/contracts-policy` | Yes |
| `DATABASE` | `agent/database-persistence` | Yes |
| `RUNTIME` | `agent/worker-runtime` | Yes |
| `MODULE` | `agent/module-infrastructure` | Yes |
| `VERIFY` | `agent/verification-security` | Yes |
| `NETWORK` | `agent/network-resolution` | Yes |
| `TRANSPORT` | `agent/transport-sandbox` | Yes |
| `REDIRECT` | `agent/redirect-revalidation` | Yes |
| `OBSERVE` | `agent/source-observability` | Yes |
| `ADVERSARY` | `agent/adversarial-network-security` | Yes |

`.agent/slots.yaml` is the machine-readable static definition registry. GitHub issue #53 is the live `OPEN` / `OCCUPIED` registry. Versioned docs never impersonate live occupancy.

## M02 workstream decomposition

The explicit ten-worker cycle is decomposed so each worker receives one bounded work packet, one standing branch and one PR. Live work packets must narrow write scopes to avoid same-path parallel mutation even where role defaults overlap.

1. **CONTRACTS — source transport policy contracts**
   - destination/resolution evidence contracts;
   - compatibility and fail-closed policy interfaces;
   - no runtime network activation.

2. **DATABASE — transport audit persistence**
   - persistence proof for resolver/redirect/audit evidence;
   - no unreserved migration creation;
   - migration numbering remains serialized by Supervisor governance.

3. **RUNTIME — source execution integration**
   - integrate injected provider-neutral primitives into bounded source execution;
   - real provider network remains disabled.

4. **MODULE — source resolution adapter**
   - bounded module-level adapter seams and dependency injection;
   - no shared-file edits without Supervisor integration.

5. **VERIFY — independent security verification**
   - verifier/evaluation surface for network destination and transport invariants;
   - must not weaken existing tests or source-policy controls.

6. **NETWORK — deterministic IPv4/IPv6 classification**
   - private, loopback, link-local, metadata, multicast, unspecified, documentation/reserved and mapped-address handling;
   - mixed-answer evidence must fail closed.

7. **TRANSPORT — injected test-only transport sandbox**
   - deterministic response/failure injection;
   - hop/time/byte budget behavior;
   - no production network path.

8. **REDIRECT — redirect-hop revalidation**
   - revalidate destination evidence at every redirect hop;
   - reject unsafe/rebound/mixed destinations;
   - enforce redirect budgets.

9. **OBSERVE — source transport observability**
   - bounded-cardinality transport metrics and normalized failure reasons;
   - tenant-safe, credential-safe, payload-safe telemetry.

10. **ADVERSARY — hostile network/security matrix**
    - encoded/confusable hosts, IPv4-mapped IPv6, rebinding, metadata/loopback/link-local/multicast/reserved targets and mixed DNS answers;
    - test-only evidence; never real hostile network access.

The Supervisor owns shared integration, migrations registry, coordination manifests, workflow changes, exact-head review, merge order and post-merge synchronization.

## Mandatory new-agent sequence

Every new agent always starts from exact current `main` and reads `AGENTS.md`, `README.md`, `docs/PROJECT_PLAN.md`, `docs/CHECKPOINT.md`, `docs/PARALLEL_AGENT_DEVELOPMENT.md`, this plan, `docs/NEW_AGENT_ONBOARDING.md`, `docs/AGENT_BRANCH_LEASES.md`, `.agent/slots.yaml`, issue #50 and issue #53.

Before feature mutation:

1. Supervisor re-reads issue #53.
2. Supervisor selects an assignable `OPEN` slot.
3. Standing branch must contain exact current `main` and latest sync epoch.
4. Supervisor updates issue #53 with assigned agent, status, start status, main SHA and epoch, incrementing registry revision.
5. Supervisor re-reads issue #53 and confirms assignment.
6. The exact runtime/session instance atomically creates `.leases/<SLOT_ID>.json` on `coordination/leases`.
7. Only after both logical assignment and active lease exist may branch mutation begin.

One occupied slot may have only one live mutating agent instance. Same logical agent identity does not permit multiple simultaneous runtime instances.

## Completion and review

A worker PR remains in progress until its bounded work packet is complete, its handoff is complete, it is synchronized to the latest Supervisor epoch, its active lease matches the current PR head, and required exact-head verification is green.

The exact canonical worker completion signal is:

`Work Done and Submitted`

It must be a top-level PR comment whose body is exactly that phrase. Any commit pushed after `Work Done and Submitted` invalidates the prior signal and requires a new signal after the new head is ready.

A completion signal requests review; it never authorizes merge by itself.

## Supervisor integration protocol

The Main-repository Supervisor uses FIFO with dependency priority and serializes overlapping merges. Before merge it must:

- review the exact current PR head;
- verify issue #53 slot ownership and `coordination/leases` lease identity;
- verify current `main` ancestry / synchronization;
- verify dependency, migration and shared-path state;
- require the repository FULL GATE on the exact head;
- merge only with expected-head protection;
- never force-push or bypass required controls.

After each accepted merge, the Supervisor reads resulting `main`, increments the synchronization epoch, updates the live slot registry baseline, renews/synchronizes active leases and broadcasts the exact alert:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

The authoritative synchronization state is the latest valid Supervisor broadcast comment in issue #50.

## Persistent GitHub Supervisor

`.github/workflows/persistent-supervisor.yml` is the deterministic GitHub-native observer/triage plane. It runs on a five-minute heartbeat plus relevant PR/issue/workflow events and maintains `[Supervisor] Persistent Control Plane Status`.

It checks:

- live `main` and issue #50/#53 synchronization drift;
- all eleven standing slots defined above;
- standing-branch ancestry;
- occupied-slot lease integrity;
- open-slot stray leases;
- fresh trusted completion signals and exact-head CI;
- native default-branch protection state;
- heartbeat freshness.

It never auto-merges, force-pushes, moves refs, releases/takes over leases, changes branch protection, weakens FULL GATE, or mutates product/governance files.

Native GitHub protection for `main` remains an external repository setting and is tracked separately. Repository compensating checks do not pretend that external protection is enabled.

## Security boundary

The M02 ten-worker cycle is expressly provider-neutral. None of these slots may independently:

- enable real provider network traffic;
- enable production DNS/HTTP transport;
- add production credentials/tokens/secrets;
- weaken SSRF/private-network protections;
- bypass tenant/source-policy/authorization gates;
- claim unmeasured or unverified production readiness.

The safe direction is deterministic classification plus injected test-only transport/resolution evidence. Any later real provider transport activation requires a separate reviewed security/product work packet and explicit governance change.

## Agent Instruction Drift Check

Any change to standing slot definitions, capacity semantics, synchronization rules, completion-signal freshness, lease semantics, integration policy or future-agent instructions must update the applicable human and machine control surfaces in the same governance change and pass `verify:parallel` plus atomic lease governance verification.
