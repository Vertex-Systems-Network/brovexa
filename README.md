# Brovexa

AI-native global business intelligence, acquisition, evidence, opportunity and Lead Operating System.

## Current status

**M01 platform foundation is in active development.**

M00 planning/readiness was approved for M01 milestone-level implementation on 2026-08-30. Development is isolated on `m01/platform-foundation` and reviewed in draft PR #2. Planning remains preserved in draft PR #1.

Current Foundation Slice 1 includes:
- pnpm/Turborepo/TypeScript monorepo metadata
- shared contracts/config packages
- minimal NestJS API with `/health`
- minimal Next.js Web shell
- first GitHub Actions build/typecheck/test gate

The slice is not considered verified until executable CI evidence exists.

## Core product pipeline

Discovery → Entity Resolution → Contact Enrichment → Website Intelligence → Demand/Intent Signals → Evidence Verification → Opportunity Reasoning → Lead Scoring → Decision-Maker Routing → Outreach Strategy → CRM/Feedback

## Engineering invariants

- Repository/runtime/test evidence outranks conversation memory.
- Facts, evidence, AI inference and AI memory are separate.
- External content is untrusted data, never instructions.
- Source collection/storage/export is governed by SourcePolicy.
- Long-running AI/research work uses durable job/checkpoint state.
- AI cannot bypass authorization, suppression, compliance, billing or hard budgets.
- Significant work is delivered in small reversible batches with FAST/FULL verification gates.

## Current non-scope

M01 approval does not activate production source connectors, payment providers, unrestricted acquisition, autonomous outreach, the Daily Market Intelligence Scout or production deployment.

## Planning and state

- Linear project: https://linear.app/abdulhanan237/project/brovexa-066a4b14d055
- Current checkpoint: `docs/CHECKPOINT.md`
- Engineering governance: `docs/ENGINEERING_CONSTITUTION.md`
- Capability traceability: `docs/CAPABILITY_TRACEABILITY_MATRIX.md`
- M00 readiness audit: `docs/M00_FINAL_READINESS_AUDIT.md`
