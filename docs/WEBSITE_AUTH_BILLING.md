# Brovexa Website, Authentication & Monetization Plan v1.0

Status: **Planning Only — no implementation authorized**

## Public product surface
Brovexa's public website is a conversion and education surface, not a static brochure. It must explain the product visually, prove how intelligence is grounded in evidence, support self-serve signup, and route larger buyers to sales.

### Primary routes
- `/` Home
- `/product`
- Feature pages for Business Discovery, Contact Enrichment, Website Intelligence, Demand Signals, BPO Opportunities, Lead Scoring, Evidence, Browser Extension, Desktop, and Market Intelligence
- `/pricing`
- `/integrations`
- `/security`
- `/about`
- `/blog`
- `/docs`
- `/contact-sales`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/verify-email`
- legal/privacy routes

## Homepage plan and image matrix
1. **Hero** — product promise plus Start Free and Watch Demo/Book Demo CTAs. Visual: real-product animation showing geography+niche discovery → Business 360 → opportunity score.
2. **Trust/evidence strip** — explainable AI, provenance, source policy, compliance-first research. No invented customer logos or unsupported claims.
3. **Discovery** — screenshot/video of country/city/niche search and job progress.
4. **Business 360** — screenshot of company facts, website status, contacts, freshness and source evidence.
5. **Signals** — visual timeline of hiring, expansion, tender/RFP, support pain and other approved signals.
6. **Opportunity Reasoning** — raw signals → recommended BPO service → explainable reasons.
7. **Evidence Inspector** — URL, timestamp, confidence, fact/inference state.
8. **Lead Queue** — score, Why Now, opportunity, contactability, evidence confidence, compliance status.
9. **Desktop + Browser Extension** — device/browser composition showing shared workflow.
10. **Continuous Market Intelligence** — Add/Experiment/Watch/Reject research proposals.
11. **Workflow** — Discover → Verify → Understand → Prioritize → Approach.
12. **Integrations/API** — show only shipped integrations; planned items must be labeled planned.
13. **Security & compliance** — provenance, source-policy enforcement, audit trails, least privilege, suppression.
14. **Pricing preview** — monthly/annual toggle and Research Credits.
15. **FAQ** — sources, accuracy, credits, extensions, exports, cancellation, trials and compliance.
16. **Final CTA** — Start Free / Book Demo.

### Visual policy
Prefer real Brovexa UI screenshots, short product videos, diagrams and purpose-built product illustrations over stock photography. Demo fixtures use synthetic data unless customer permission exists. Every visual gets meaningful alt text and reduced-motion behavior.

## Authentication
### Login
- Email/password
- Google and Microsoft OAuth candidates
- MFA/passkey-ready architecture
- secure session/device controls
- rate limiting and credential-stuffing protection
- audit events

### Registration
- Minimal name/work-email/password or approved OAuth
- Terms/privacy acceptance with policy version
- Email verification
- Create workspace or accept invitation
- Optional role/use-case selection
- Free plan or eligible paid trial

### Forgot/reset password
- Account-enumeration-safe response
- Single-use expiring token
- Rate limits
- optional session revocation after reset
- security audit event

### First-run onboarding
1. Verify email
2. Create workspace
3. Select BPO/agency, sales, analyst/research or enterprise use case
4. Select target geographies/niches
5. Configure initial service taxonomy
6. Explain Research Credits and cost estimation
7. Run a guided demo/sample discovery
8. Invite team optionally
9. Install browser extension/Desktop optionally

## Packages
Brovexa should use **subscription + included Research Credits + optional top-ups**. Normal UI navigation, saved views and ordinary CRM actions should not burn credits. Credits cover cost-bearing external research/enrichment/AI work.

### Free — $0
- 1 seat
- small monthly Research Credit allowance
- small discovery runs
- Business 360 and website status
- limited signal/opportunity previews
- basic Chrome/Firefox lookup/capture
- limited/no exports/API

### Launch — proposed $49/month
- 1 seat
- larger Research Credit allowance
- full discovery/enrichment/signals/opportunity scoring
- browser extensions + Desktop
- saved segments
- standard exports
- basic outreach drafting/review

### Pro — proposed $149/month
- 3 seats included
- higher pooled Research Credits
- advanced filters and signal monitoring
- scheduled research jobs
- CRM/pipeline workflows
- evidence exports
- starter integrations/webhooks
- team roles

### Growth — proposed $399/month
- 10 seats included
- large pooled Research Credits
- continuous signal monitoring
- API/webhooks
- supported CRM syncs
- advanced scoring configuration
- market-intelligence views
- advanced audit/compliance controls

### Enterprise — custom
- negotiated seats and usage
- SSO/SAML/OIDC where approved
- advanced RBAC
- custom retention/data controls
- dedicated quotas/concurrency
- private/approved custom connectors
- SLA/support/onboarding
- contract/invoiced billing where available

Prices above are hypotheses for unit-economics and market validation, not final launch prices.

### Commercial rules
- Monthly + annual billing; evaluate 15–20% annual discount.
- Top-ups for Research Credits.
- Hard spend/budget limits and pre-run estimator.
- Do not charge credits for arbitrary UI actions.
- Entitlements live in Brovexa; payment provider IDs never become application authorization logic.
- Existing subscription price/version history is preserved.

## Billing domain
Canonical entities: `Plan`, `PlanVersion`, `Entitlement`, `Meter`, `UsageEvent`, `CreditLedger`, `Subscription`, `BillingCustomer`, `CheckoutSession`, `InvoiceReference`, `PaymentReference`, `Discount`, `Trial`, `BillingEvent`, `RefundReference`, `ProviderMapping`.

Payment provider is the financial transaction/subscription source. Brovexa's entitlement service is the application-access source. Webhook processing is signed, idempotent, replayable and auditable.

## Payment gateway strategy
Implement a provider abstraction and select launch provider by ADR after confirming the actual operating entity, supported markets, fees, payout model, tax obligations and commercial requirements.

### Paddle — strong global SaaS launch candidate
Merchant-of-record approach can reduce operational burden for global payments, tax, subscription lifecycle and fraud/chargeback handling. Supports checkout, subscriptions and localized pricing.

### Stripe — strong direct-processor candidate
Stripe Checkout/Billing supports recurring subscriptions, hosted checkout, customer portal, invoices and tax tooling. Best when Brovexa has a supported operating entity and wants greater direct billing control.

### Lemon Squeezy — evaluated MoR alternative
Supports subscriptions, usage-based billing, free trials, discounts, customer portal and SaaS billing workflows. Evaluate merchant eligibility, pricing, payout and feature fit before selection.

### Gateway rules
- Never store raw card data.
- Prefer hosted/embedded provider checkout initially.
- Verify webhook signatures and idempotency keys/event IDs.
- Never provision entitlements solely from browser redirect success.
- Provider outages do not erase entitlement history.
- Provider migration requires mapping/transition ADR and tested reconciliation.

## Checkout lifecycle
Pricing → Select plan → Login/Register if required → Hosted/embedded checkout → Server-side verification → Entitlement provisioning → Success → Product onboarding.

Plan for monthly/annual selection, trials if justified, coupon codes, tax/business identity fields, upgrade/downgrade previews, proration policy, cancellation, reactivation, payment-method update, invoices/receipts, retries/dunning and explicit grace/read-only states for failed renewals.

## Billing settings UX
- Current plan/status
- Seats
- Research Credit balance and usage
- Upcoming reset/renewal
- Upgrade/downgrade
- Buy top-up
- Payment method/provider portal
- Billing/tax details
- Invoice/receipt history
- Discounts
- Cancel/reactivate

## SEO and conversion
- Server-render/index public routes; authenticated app routes are noindex where appropriate.
- Metadata, Open Graph, sitemap, canonical URLs and robots policy.
- Substantive feature/use-case pages rather than thin programmatic pages.
- Dated, evidence-backed comparison pages only.
- Analytics taxonomy for CTA → pricing → registration → checkout → activation → first research job → extension/Desktop install.
- Jurisdiction-aware analytics/cookie consent.

## Pre-development gates
Before implementation:
- IA and positioning approved
- Visual/screenshot asset matrix approved
- Auth threat model/account lifecycle approved
- Plan entitlements and Research Credit accounting approved
- Unit economics simulated
- Payment-provider ADR approved for actual operating entity
- Tax/invoice/refund/cancellation responsibilities documented
- Webhook + entitlement state machine documented
- legal page/process ownership identified
- ABD-215 approved and explicit owner development consent received
