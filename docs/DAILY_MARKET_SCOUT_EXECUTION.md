# Brovexa — Daily Market Intelligence Scout Execution Contract v1.0

Status: **Planning Only — scheduled GitHub workflow remains disabled until development authorization**

## Goal

Once implemented and enabled, run a governed research scout every 24 hours to detect meaningful changes that can improve Brovexa product quality, client usability, competitiveness, security, cost or source coverage.

The scout proposes change; it does not silently change Brovexa.

## Schedule

Use an off-hour minute such as `17`, plus manual dispatch. Prevent overlapping runs with workflow concurrency plus canonical run/idempotency state.

## Research lanes

Competitors/adjacent products; APIs/data providers; source policies/licensing; AI agent/eval/retrieval/memory techniques; browser/desktop platform changes; security/standards; privacy/direct-marketing regulation; UX/customer-pain themes; pricing/packages; open-source improvements; geography/taxonomy revisions; CRM/payment/auth ecosystem changes.

## Pipeline

`Trigger → previous ScoutState/backlog → bounded parallel research lanes → source verification → delta detection → dedupe → proposal scoring → independent evaluator/security-policy pass → persist report/proposals → optional governed Linear update`

## Proposal fields

ID/version, category, affected persona, problem/gap, evidence URLs/dates, competitor/reference, external delta, proposed Brovexa change, user/business value, security/privacy/source-policy impact, architecture/data impact, dependencies, complexity, cost impact, confidence, Add/Experiment/Watch/Reject, duplicate/related backlog, owning milestone and recheck/expiry.

## Meaningful delta

Surface only materially new/relevant capability, price/terms/API/policy change, repeated credible customer pain, changed table stakes/differentiation, security/regulatory change, measurable cost/quality technique, or evidence that a Brovexa planning decision is stale/contradicted.

## Dedupe/noise control

Search Linear and GitHub before proposing. Update/relate existing work where possible. Do not create daily duplicate issues or commits merely to prove execution.

## Memory

Persist prior queries/source coverage, observed versions/prices/policies, proposals/rejections, recheck dates and source quality/cost. Scout memory cannot mutate canonical product policy/procedural memory without normal governance.

## Failure/security

Partial lane failure is reported; transient errors may retry, policy/auth errors block/review. Hard time/cost budgets stop cleanly. External content is untrusted. Research uses read-mostly tools and cannot auto-code, merge, alter dependencies/policies/pricing, enable connectors, send outreach or mark implementation complete.

## Metrics

Actionable-proposal precision, noise/duplicate rate, acceptance/experiment rate, stale-decision detection, source coverage, research cost/useful proposal, unsupported finding rate and detection-to-review time.

## Gate

Workflow, credentials, research runner and schedule remain disabled until ABD-215 plus explicit owner consent. First implementation must pass manual/sandbox tests before scheduled enablement.