# Brovexa Desktop & Browser Client Plan

Status: **Planning Only — no implementation authorized**

Linear: ABD-226 through ABD-230.

## Product model
Brovexa is one intelligence platform with four first-class clients:

1. Web operator application
2. Desktop operator application
3. Chrome/Chromium extension
4. Firefox extension

Canonical business identity, evidence, signals, opportunities, scores, CRM state, compliance and audit history live in the backend. Clients reuse versioned contracts and may cache/stage only data explicitly allowed by source/privacy policy.

## Shared client contracts
All clients share versioned contracts for:
- authentication/session/device state
- tenant/workspace context
- business lookup and canonical IDs
- evidence submission
- signals/opportunities/scores
- research jobs
- lead/list/CRM actions
- navigation/deep-link targets
- capability/version negotiation
- errors/retries

Stable logical routes must exist for Business, BusinessLocation, Evidence, Signal, Opportunity, Lead, ResearchJob, OutreachDraft and CRMRecord.

## Desktop application

### Role
Persistent daily analyst/sales-operations workspace with native notifications, browser handoff and secure local capabilities.

### V1 capabilities
- secure sign-in and workspace switching
- global search/command palette
- Command Center/Today
- Business 360
- evidence timeline
- signals/opportunities
- lead queue
- research job monitor
- outreach review
- CRM notes/tasks
- native notifications
- Web/extension-to-desktop deep links
- bounded offline cache where policy permits
- secure local preferences/session storage
- staged auto-update channels
- safe diagnostics

### Later options
- tray/background mode
- local file evidence intake
- local OCR/document processing where permitted
- local model for non-sensitive workloads
- offline draft/review mode
- desktop hotkeys

### Use cases
1. Analyst starts a discovery job and receives a native completion/failure alert.
2. Extension opens the current canonical company directly in desktop Business 360.
3. BD operator reviews high-priority evidence/opportunities without tab overload.
4. Outreach recommendation goes to a human approval queue.
5. Brief network failure does not destroy selected cached context; allowed edits reconcile after reconnect.

### Security
- no plaintext passwords/long-lived tokens
- OS-secure credential storage abstraction
- device/session revocation
- authenticated/validated deep links
- deep links are navigation requests, never authorization
- local cache encrypted where necessary and governed by retention TTL
- signed releases and verified update metadata

Windows is the initial primary desktop target; macOS/Linux portability is evaluated and tested rather than assumed.

## Chrome / Chromium extension

### Role
Bring Brovexa context to the pages where users already research businesses.

### V1 interaction
Use a side panel where supported plus a compact toolbar popup.

### V1 capabilities
- detect current domain/page and request possible canonical business match
- show Business 360 summary
- show website state, latest signals, top opportunity, score/confidence
- save current URL/page as an evidence candidate with user note/type
- trigger allowed company research/enrichment
- add to list/lead queue
- create follow-up task
- open exact record in Web/Desktop
- show source/compliance warning when retention/use is restricted

### Later permission-gated modules
- Gmail context
- Google Calendar meeting context
- CRM page integrations
- selected professional-network helpers only where provider policy permits

### Use cases
1. Company website → instant canonical match and opportunity summary.
2. Hiring page → one-click evidence candidate.
3. RFP/tender/news page → submit for evidence verification.
4. Ambiguous match → manual entity review instead of auto-merge.
5. Start company research without copying name/domain.

### Security
- Manifest V3
- no remotely hosted executable code
- least-privilege permissions; prefer user-gesture/active-tab style access when practical
- content scripts never receive reusable backend credentials
- page DOM/external text is untrusted data, never agent instructions
- backend communication restricted to approved Brovexa API origins
- evidence submissions preserve provenance, timestamp and initiating user/action

## Firefox extension
Firefox is not a forked product. It shares UI, domain logic, API client, evidence contracts and most extension code with Chromium.

Manifest V3 runtime details differ between browsers. Chrome uses extension service workers for background execution, while Firefox continues to differ in background support. Browser-specific runtime/permission differences must remain behind explicit adapters with automated tests.

Use cases are contract-equivalent to Chrome where APIs permit. Unsupported capabilities degrade visibly.

## Cross-client authentication
Recommended principles:
- central OIDC/OAuth-compatible identity
- desktop device/session tokens stored securely
- extension short-lived tokens through browser-safe auth flow
- refresh credentials never exposed to content scripts
- logout/revoke propagates
- tenant/workspace revalidated server-side on privileged requests

## Deep links
Logical examples:
- `brovexa://business/{id}`
- `brovexa://evidence/{id}`
- `brovexa://opportunity/{id}`
- `brovexa://job/{id}`

Desktop validates current identity/tenant/server permissions before displaying or acting on a deep-linked resource.

## Offline options

### A. No offline data
Lowest risk, simplest.

### B. Bounded read cache — recommended initial target
Cache only recent user-selected canonical summaries/metadata where source policy permits.

### C. Full offline workspace
Encrypted local DB, conflict resolution, background sync and retention enforcement. Implement only if demonstrated customer demand justifies the complexity.

## Notifications
Candidate events:
- discovery/research completed
- job failed/action required
- high-confidence opportunity
- manual review requested
- outreach approval requested
- connector/source failure
- quota/cost threshold

Sensitive content should be hidden from OS notification previews by default.

## Release channels
- development
- internal alpha
- beta
- stable

Each client declares version, compatible backend API range, build provenance, changelog and rollback path. Backend may enforce a minimum secure client version.

## Testing matrix
Shared:
- API contract
- auth/tenant
- evidence provenance
- permissions
- stale-client compatibility

Desktop:
- installer/updater
- deep links
- secure storage
- notifications
- cache/offline
- crash/restart

Extensions:
- Chrome stable
- Chromium/Edge smoke where applicable
- Firefox stable
- permissions
- background/content lifecycle
- tab navigation/reload
- malicious page/prompt-injection cases
- CSP/remote-code checks
- store packaging

## UX rules
- entity-match state is explicit
- one primary extension action per state
- AI score always exposes evidence/reasoning
- freshness/confidence visible
- destructive/high-impact actions require confirmation
- permission prompts explain user benefit before browser prompt
- errors indicate retry vs manual review

## Post-approval development order
1. Shared API/domain contracts
2. Web design system + Business 360 vertical slice
3. Chrome/Chromium extension vertical slice
4. Firefox compatibility adapter
5. Desktop shell/deep links
6. Cross-client auth/sync
7. notifications/update channels
8. hardening/store packaging/E2E

## Research references
- Tauri 2: https://v2.tauri.app/start/
- WXT: https://wxt.dev/
- Chrome Manifest V3: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- Firefox background/WebExtensions behavior: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background

## Authorization
This plan does not authorize implementation. ABD-215 plus explicit owner consent is required.