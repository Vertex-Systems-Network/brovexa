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

A URL-only message is **not** allowed to reintroduce a confirmation gate when standing autonomous-development authority already exists.

- With standing autonomous authority: treat the repository URL as a continuation/re-entry signal. Resolve current repository state, reconcile Issues/PRs/coordination/CI, self-select the canonical dependency-safe action, and continue within the active workspace turn/session without waiting for a number or technical confirmation.
- Without standing autonomous authority: use read-only entry behavior. Resolve the repository and governing state, do not mutate from the URL alone, and present 1 to 3 valid next-action options for the user to select.
- In both modes, revalidate current repository evidence before mutation and preserve all security, branch-protection, production/provider, destructive-action, and authorization gates.

## Safety and local authority

Repository-specific governance, security, exact-head CI, approval, migration, production/provider, and release rules remain authoritative and may be stricter than this interaction contract. Scope/batch boundaries may limit what one packet changes, but under standing autonomous authority they do not require a user re-prompt before the Supervisor selects and starts the next dependency-safe authorized packet. This file never grants execution authority and never permits bypassing an accepted actionable Issue/PR or deferred work boundary.
