# Brovexa

AI-native global business discovery, intent intelligence, BPO opportunity scoring, and compliant outreach platform.

## Current status

**Planning baseline only. Feature development is not yet approved.**

Brovexa is being designed as an evidence-backed business intelligence system, not as an unrestricted Google Maps scraper. The platform will discover businesses by geography and niche, resolve canonical entities, enrich public/authorized business data, verify websites and digital presence, detect explicit and implicit demand signals, map those signals to BPO/service opportunities, score leads transparently, and prepare compliant human-reviewable outreach strategies.

## Core pipeline

Discovery → Entity Resolution → Contact Enrichment → Website Intelligence → Demand/Intent Signals → Evidence Verification → BPO Opportunity Reasoning → Lead Scoring → Decision-Maker Routing → Outreach Strategy → CRM/Feedback

## Planning rules

- Every material AI conclusion must link to evidence, timestamps, confidence, and model/rule version.
- Facts, evidence, and inference are stored separately.
- External web content is untrusted input and cannot override system/tool policy.
- Source-specific licensing/ToS/caching/retention rules are enforced in the data lifecycle.
- Human approval is required before autonomous external outreach in initial releases.
- Suppression/opt-out and jurisdiction-aware compliance are first-class controls.
- Async pipelines must be idempotent, retry-safe, observable, rate-limited, and cost-bounded.
- Security baseline: OWASP ASVS 5.0 + NIST SSDF 1.1, with SLSA 1.2-aligned supply-chain controls where practical.
- Repository state, tests, documentation, Git history, and Linear are the durable source of truth; chat memory is not.

## Linear

Project: https://linear.app/abdulhanan237/project/brovexa-066a4b14d055

## Development authorization

M00 must be approved before feature implementation starts. M00 covers product scope, source/compliance rules, canonical data/evidence schemas, AI contracts/evaluations, threat model, architecture ADRs, cost/scale assumptions, and the Definition of Ready.
