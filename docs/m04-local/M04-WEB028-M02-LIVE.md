# Brovexa M04 — WEB-028 Real M02 Admission Bridge

Date: 2026-10-16.

## Added candidate

- `apps/worker/src/website-live-m02-admission.ts`: explicit trusted tenant-scoped loader for an approved M02 source transport admission snapshot. The bridge parses the actual Brovexa `SourceTransportAdmissionInputSchema` and calls `evaluateSourceTransportAdmission` (NOT a request-supplied `allow`).
- Rejects changed workspace/inspection, verified URL, GET/HTTPS restrictions, source/policy versions, budget widening, mismatched DNS public IPv4 evidence, stale evaluation, disallowed robots, non-network policy, denied M02 output or changed approved port.
- Extended the v2 live hop interface to carry source key and exact source policy identity, and verifies them again on the returned per-hop admission before network dial. `website-live-acquisition.spec.ts` test callback typing updated.
- Native Vitest regression candidates for fresh allow, stale/foreign resolution and blocked evaluator output.

## Verification

- Isolated TypeScript for live v2 and M02 admission bridge: PASS (local contract declaration shims, NOT full native workspace).
- Existing isolated live acquisition regressions: 76/76 PASS with fake DNS/transport, no external host requests.
- Live DB isolated tests from WEB-027: 10/10 PASS in that prior batch.
- Native Node24/pnpm, real M02 policy+DNS state, PostgreSQL18/Valkey, full CI, external site security acceptance: NOT RUN.

## Activation

This module only returns an adapter callback. It does **not** register a worker, create a trusted policy record, grant tenant approval or dial an external site. A caller must supply a real workspace-scoped snapshot and explicit live execution permission. Production activation remains disabled until gates pass.