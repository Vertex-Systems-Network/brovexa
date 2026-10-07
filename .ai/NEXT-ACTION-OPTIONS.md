# VSN Organization Next-Action Options Contract

This repository adopts the Vertex Systems Network interactive AI-development handoff standard.

## User-facing handoff

After every repository-development response, expose 1 to 3 currently valid next actions derived from live repository evidence.

- Always include the canonical/recommended next action, but do not bind it permanently to option 1.
- When two or more valid options exist, reshuffle the visible 1/2/3 numbering on every handoff.
- If the previously selected action identity and number are known, that same action must move to a different visible number on the next handoff. With only one valid action, number reuse is allowed.
- Mark the canonical action as **Recommended**. Numbering is ephemeral presentation state and never changes priority, safety, scope, or authorization.
- A reply containing only an option number is a request to start the corresponding next turn. Re-read current repository state before any mutation. If the option became stale or unsafe, fail closed and show the new valid options instead.
- Interactive buttons may be used when the host supports them; otherwise numbered one-line options are the mandatory fallback.

## Autonomous workspace continuation

When the user has already granted standing autonomous-development authority, asked the workspace to continue without technical confirmation, or explicitly requested continuous execution, the numbered handoff is **presentation only** and is not an execution gate.

- Do not pause to ask the user which technical next action to take. Self-select the current canonical/recommended safe action from repository evidence and continue it in the same active workspace turn/session while tool/context/runtime budget remains.
- A technical blocker, test failure, CI failure, merge conflict, stale coordination record, recoverable lease problem, formatting/lint/type error, dependency mismatch, documentation drift, or implementation defect must be diagnosed and repaired by the AI within existing repository authority. Do not ask the user to approve the repair.
- If the preferred lane is genuinely occupied or cannot be safely recovered, preserve its state and continue another dependency-safe authorized packet instead of stopping the whole workspace.
- A stale lease is handled by the existing explicit Supervisor recovery audit; sufficient repository evidence permits recovery without user confirmation. If recovery evidence is insufficient, leave that lease untouched and continue other safe work.
- If a true human-only external gate exists (for example missing credentials/secrets, a legal or business decision, destructive production authorization, or unavailable external access), record it as evidence-backed `WAITING_EXTERNAL` and immediately continue other authorized safe work. Ask the user only when that external input is required **and no other safe repository work remains**.
- Do not end a development turn with a status-only handoff while executable, dependency-safe, authorized repository work remains and the active tool/context/runtime budget still permits progress.
- This rule never weakens exact-head CI, branch protection, security/compliance gates, tenant boundaries, production/provider authorization, destructive-operation safeguards, or the requirement to preserve unmerged work.

## URL-only repository entry

When the user's message contains only this repository's canonical GitHub URL (optionally with surrounding whitespace), treat it as a read-only development entry request.

1. Resolve the repository and default/protected branch.
2. Read this repository's durable/current state and governing instructions.
3. Reconcile open Issues first, then open PRs, then any repository-specific coordination/runner state required by local rules.
4. Do **not** create a branch, commit, PR, merge, deployment, provider call, destructive action, or other mutation from the URL alone.
5. Respond with 1 to 3 shuffled valid next-action options and mark the canonical one **Recommended**.
6. The user's subsequent number selection initiates the normal fully revalidated development turn.

## Safety and local authority

Repository-specific governance, security, exact-head CI, approval, migration, production/provider, release, and one-turn/one-milestone rules remain authoritative and may be stricter than this interaction contract. This file never grants execution authority and never permits bypassing an accepted actionable Issue/PR or deferred work boundary.
