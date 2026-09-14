# Brovexa — Daily Market Scout Implementation Contract v1.0

Status: **Planning Only — workflow is NOT created/enabled until explicit development authorization**

## Future schedule

After approval:

```yaml
on:
  schedule:
    - cron: '17 8 * * *'
      timezone: 'Asia/Karachi'
  workflow_dispatch:
```

Current GitHub.com Actions supports IANA timezone values on `on.schedule`. Scheduled workflows use the latest commit on the default branch. `:17` avoids start-of-hour congestion.

## Future paths

- `.github/workflows/market-intelligence-scout.yml`
- `tools/market-scout/`
- `research/scout-config.yaml`
- `research/schemas/`
- optional dedicated `research-state` branch until Brovexa DB becomes canonical scout state

No workflow file is created by this planning document.

## GitHub permissions

Minimum default:
- `contents: read`
- `issues: write` only for validated proposal/review output
- no merge/deployment/admin/secrets/environment permissions

If early normalized state requires `contents: write`, isolate it in a separate validated publish job to the research-state branch; the research/model phase does not receive broad repository write authority.

## Run phases

0. Guard: concurrency/config/schema/budget/source-policy checks.
1. Load baseline: Brovexa plan/backlog/prior market state/prior decisions/source registry.
2. Plan bounded fixed/change-focused/rotating/WATCH queries.
3. Acquire from approved official/search/web/community adapters.
4. Normalize untrusted observations to FindingCandidates.
5. Verify primary evidence/contradictions.
6. Diff against prior state + Brovexa plan/implementation/backlog.
7. Generate typed product proposals.
8. Independent evaluator/rule review.
9. Classify ADD / EXPERIMENT / WATCH / REJECT / REVIEW_REQUIRED.
10. Publish only meaningful deltas.

Missing prior baseline = `BASELINE_ESTABLISHMENT`, not false “new” findings.

## ScoutRun schema

Track runId, timestamps, trigger, repo SHA, runner/config/schema/source-policy/AgentDefinition versions, model/provider versions, sources attempted/succeeded/failed, queries/pages/bytes/model calls/tokens, estimated/actual cost, status, coverage gaps, errors and finding/proposal IDs.

Statuses:
`BASELINE_ESTABLISHMENT`, `COMPLETED`, `COMPLETED_NO_DELTA`, `PARTIAL`, `BUDGET_STOPPED`, `SOURCE_BLOCKED`, `MODEL_FAILED`, `FAILED`.

## Finding

Track stable fingerprint, entity/product/provider/standard, capability category, prior/observed state, effective/published/retrieved dates, evidence refs, source authority, confidence, contradiction, freshness, Brovexa relevance and affected plan/issues.

Store only policy-permitted minimum evidence; no raw scraped corpora in Git.

## ProductProposal

Track title/problem/persona/JTBD, finding/evidence IDs, why-now, proposed capability/non-goals, user value, strategic fit, differentiation, confidence, urgency, complexity, architecture disruption, security/privacy/compliance risk, cost/Research Credit effect, dependencies, experiment plan, duplicate links, classification, evaluator reason codes and WATCH next-review date.

## Dedup

Fingerprint normalized problem + capability + persona/domain; compare against canonical plan, Linear, GitHub, prior proposals and rejected/watch cooldown state.

Marketing-copy changes do not create issues.

## Meaningful delta

Publish only for material security/compliance changes, source/API/terms changes, strategic competitor gaps, repeated user pain, new platform/standard impact, material cost/performance opportunity or evidence that a planned Brovexa capability should be simplified/deferred/replaced.

## Publishing

Recommended early pattern:
- one rolling Market Scout Review Queue issue
- separate proposal issue only for high-confidence ADD/EXPERIMENT after dedupe/evaluation
- proposal remains Planning/Research, never auto-development
- WATCH stays in report/state unless review requires issue

No issue moves itself into an implementation milestone.

## State

Early GitHub phase: full run artifacts + compact normalized state on a dedicated research-state branch only through validated publishing if needed.

Mature phase: canonical ScoutRun/Finding/Proposal in Brovexa DB; GitHub Action triggers/reports via authenticated API.

## Idempotency/concurrency

One concurrency group. Stable run/proposal fingerprints prevent duplicates. Publishing operations retry only when idempotent.

## Budgets

Before enablement define hard max queries, pages, bytes, source calls/domain, model calls/tokens, monetary cost, runtime and proposal-issue count. Budget stop creates partial report; it never self-increases.

## Security

External content is untrusted. No shell commands derived from web text. System config is separate from content. Fetch/network adapters are policy/SSRF constrained. Schema validation occurs before evaluation/publishing. Secrets are not placed in prompts/reports. GitHub permissions remain minimum. Action dependencies are pinned/reviewed. Prompt-injection corpus is part of tests.

## Quality metrics

Proposal acceptance, duplicate/noise rate, false-new rate, evidence verification, WATCH conversion, proposal→shipped value where measurable, cost/run, human-review time, security/compliance block rate.

## Release gate

Before future workflow enablement:
- JSON schema fixtures/tests
- zero-write dry-run
- recorded evidence tests
- prompt-injection adversarial suite
- dedupe tests
- budget-stop tests
- GitHub permission audit
- output template review
- manual dry-run on approved branch
- explicit owner approval to add/merge the workflow to default branch

Foundation remains deterministic GitHub Action + versioned Brovexa scout runner. Agentic GitHub workflow features may be evaluated later, not made authoritative by default.