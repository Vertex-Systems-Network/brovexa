# Brovexa Project Checkpoint

## State

Planning baseline established. Feature development is **not yet approved**.

## Verified repository state before planning baseline

- Default branch: `main`
- Repository contained only `README.md` with `# brovexa`
- Initial commit: `49673ebd8d40133eaa00d3bd8d760ce4b372fd5a`
- No pre-existing open GitHub issues or feature implementation were found during baseline inspection.

## Planning branch

`planning/brovexa-baseline`

Planning commits:
- `2c795f45bb9828bf6492b1c5a20caf38fe93f89b` — project README baseline
- `9ce73941c84a0b5cd0857755f33c076c98e6cc27` — project plan
- `63a0f0adf35395d59ba973be767dc70b8f1f112a` — engineering constitution

## Linear project

https://linear.app/abdulhanan237/project/brovexa-066a4b14d055

Documents:
- Brovexa — Product & Architecture Master Plan v1.0
- Brovexa — AI-Native Engineering Constitution v1.1

Milestones:
- M00 — Product, Compliance & Architecture Baseline
- M01 — Platform Foundation & Developer Experience
- M02 — Business Discovery & Source Connectors
- M03 — Entity Resolution & Contact Enrichment
- M04 — Website & Digital Presence Intelligence
- M05 — Demand, Intent & Opportunity Signals
- M06 — BPO Intelligence, Scoring & Explainability
- M07 — Outreach Strategy, CRM & Compliance Controls
- M08 — Dashboard, Search, Workflows & APIs
- M09 — Security, Reliability, Scale & Cost Controls
- M10 — Beta, Production Readiness & Launch

Planning issues created: `ABD-209` through `ABD-225`.

## Current gate

`ABD-215 — M00 architecture/readiness approval gate` blocks feature implementation.

M00 must complete and be explicitly approved before M01 implementation begins.

## Research-backed standards baseline

- OWASP ASVS 5.0 for application-security verification appropriate to risk
- NIST SSDF 1.1 as the final secure-development baseline; SSDF 1.2 was draft at planning time
- SLSA 1.2 for current supply-chain provenance/hardening guidance where practical
- OpenTelemetry-compatible logs/metrics/traces where appropriate
- Google Places source-policy/caching restrictions must be enforced by source-policy contracts; provider data is not assumed freely persistable
- Outreach compliance is jurisdiction-aware and suppression/opt-out is mandatory

## Known unverified/unfinished items

- Technology stack has not been selected; M00 architecture decision is intentionally pending.
- Source connectors have not been implemented or enabled.
- No database schemas, workers, APIs or UI have been implemented.
- No AI model/provider has been selected.
- No production compliance/legal sign-off has been performed.
- No automated tests or CI exist yet because implementation has not started.

## Next safe action

Complete M00 issues in order, with special focus on:
1. ABD-210 source-policy/compliance matrix
2. ABD-211 canonical data/evidence schemas
3. ABD-212 AI contracts/evals
4. ABD-213 threat model
5. ABD-214 architecture ADRs

Then review `ABD-215` for explicit M00 approval.
