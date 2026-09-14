# Brovexa — Public Website, Packages & Commercial Lifecycle Specification v1.0

Status: **Planning Only — no website/payment implementation activated**

## Public product objective

The website must explain Brovexa visually, prove evidence-backed AI, convert self-serve users to first useful ResearchJob and support Enterprise/Contact Sales.

## Route architecture

Primary: `/`, `/product`, `/pricing`, `/integrations`, `/security`, `/contact-sales`, `/about`.

Feature routes: global discovery, Research Jobs, Business 360, website intelligence, signals, opportunities, Lead Intelligence, evidence, AI agents, durable memory, browser extension, desktop, market intelligence and compliance.

Resources: blog, guides, docs, changelog. Identity/legal routes include login/register/forgot/reset/verify/invite/onboarding and applicable privacy/terms/cookie/security/DPA pages.

## Homepage story

Hero promise direction: **Find the right businesses. Understand why they need you. Know what to do next.**

Hero visual uses real/synthetic Brovexa UI: choose geography+niche → select signals → ResearchJob → Business 360 → evidence-backed signals → service opportunity → Lead score/Why Now.

Feature visual matrix covers Discovery, Background Research, Business 360, Signals, Evidence, Opportunity AI, Lead OS, Buying Committee, AI Agent Run Trace, Memory, Chrome/Firefox, Desktop, Market Scout and Compliance. Use deterministic synthetic demo data unless customer permission exists.

## Visual production

Build seeded demo workspace/fixtures first, then capture real product screenshots/videos, responsive crops, extension/Desktop states, alt text/transcripts and reduced-motion frames. Version marketing visuals with product releases.

## Signup/activation funnel

`Landing → Product/Pricing → Register → Verify → Workspace → Use Case → Service Catalog → Target Geography/Niche → Research Credits/Budget → Guided ResearchJob → First Business 360 → First Opportunity → optional Lead → optional Extension/Desktop → Invite Team`

Activation is first evidence-backed useful result, not account creation.

## Package architecture

Use Subscription + Included Research Credits + optional top-ups. Seats/entitlements control access; Research Credits meter external-cost-bearing work. Ordinary navigation, notes, filters and standard Lead operations do not consume credits.

Provisional packages:

- Free $0 — 1 seat, small credits, basic discovery/Business 360/signal preview/browser capture.
- Launch proposed $49/mo — 1 seat, standard discovery/enrichment/signals/opportunities, Lead Inbox, exports, browser extensions, Desktop.
- Pro proposed $149/mo — 3 seats, pooled credits, deeper/scheduled research, advanced signals, team routing, starter integrations/webhooks.
- Growth proposed $399/mo — 10 seats, larger credits/concurrency, continuous monitors, API/webhooks, supported CRM sync, advanced scoring/audit/compliance.
- Enterprise custom — negotiated seats/credits, SSO/SCIM when shipped, advanced RBAC/data controls/custom approved connectors/SLA/invoicing where available.

Prices/credit allowances remain hypotheses until representative unit economics are measured.

## Entitlements

Machine-readable entitlements such as seats/workspaces, concurrent jobs, max research depth, continuous monitoring, exports, API/webhooks, CRM sync, extension/Desktop, Agent Trace/Memory Inspector, audit retention, SSO and custom connectors. PlanVersion preserves grandfathering/migration history.

## Research Credits

Research Credit is a customer-facing usage abstraction backed by versioned MeterRate rules. Preflight shows low/expected/high estimate. Usage settles through an idempotent ledger. System retries/restore/replay must not double-charge. Hard workspace budgets are server-authoritative.

## Payment ADR

Preferred validation candidate: **Paddle** for global SaaS/Merchant-of-Record simplicity if the actual Brovexa operating entity passes onboarding/commercial review.

Comparison: Stripe for greater direct billing control where entity/tax responsibilities are intentionally owned; Lemon Squeezy as MoR alternative.

Final decision compares entity eligibility, product terms, payout country/currency, total fees/FX/refunds/chargebacks, payment methods, subscriptions/proration/trials/coupons, top-ups/metering, customer portal, tax/MoR responsibility, B2B invoices/VAT IDs, API/webhooks, migration/export, account-hold risk and Enterprise invoicing.

## Canonical billing objects

`Plan`, `PlanVersion`, `EntitlementDefinition`, `Subscription`, `BillingCustomer`, `ProviderMapping`, `CheckoutAttempt`, `BillingEvent`, `InvoiceReference`, `PaymentReference`, `RefundReference`, `DisputeReference`, `CreditLedger`, `UsageEvent`, `TopUp`, `Discount`, `Trial`.

Provider events are inputs; Brovexa reconciles canonical entitlement state.

## Checkout

`Plan → identity/workspace → checkout → provider pending → confirmed → server reconciliation → subscription active → entitlements → onboarding`.

Handle abandoned/expired, decline, redirect-before-webhook, webhook-before-redirect, duplicate/out-of-order events, reconcile failure, wrong workspace/account, changed plan, coupon/tax-identity correction. Never provision durable paid access from browser redirect success alone.

## Subscription lifecycle

Canonical states include Trialing, Active, Past Due, Grace, Pause where supported, Cancel-at-period-end, Cancelled, Expired and Dispute/Review as needed.

Upgrade/downgrade previews price/effective date/limits. Downgrades do not immediately delete excess data; use over-limit/read-only remediation states.

Failed renewals preserve data and billing access while restricting expensive/new operations according to policy.

Refund/dispute history does not rewrite Usage/Credit history destructively.

## Billing portal

Plan/status/interval, seats, credits, renewal/reset, upgrade/downgrade, top-up, provider payment portal, invoices/receipts, billing identity/tax info, cancellation/reactivation and support.

## SEO/analytics

Index useful public content only; private app routes noindex as appropriate. Use canonical URLs, sitemap, metadata/OG, robots, semantically valid structured data, localized/hreflang only when real localized content exists, performance monitoring and accessible HTML.

Avoid thin city×niche programmatic pages.

Analytics taxonomy includes marketing CTA/demo/pricing/plan, register/verify/workspace, checkout, first ResearchJob/verified business/opportunity/Lead, extension/Desktop install and team invite. Sensitive research/evidence is not sent to third-party analytics by default. Consent is jurisdiction-aware.

## Remaining launch decisions

Actual operating entity; Paddle onboarding/fees/terms + comparison; final prices/annual discount; monthly credit allowances; gross-margin target; free-tier abuse limits; refund/business terms; trial decision; payout/income tax/accounting review; analytics provider/consent implementation.

ABD-215 + explicit owner consent remain mandatory before implementation.