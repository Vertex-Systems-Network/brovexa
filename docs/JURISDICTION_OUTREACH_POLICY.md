# Brovexa — Jurisdiction, Privacy & Outreach Decision Engine

Status: **Planning Only — compliance architecture, not legal advice or send authorization**

## Core principle
Finding a contact route is not permission to contact it. Outreach eligibility is a separate canonical decision.

Decision inputs:
`JurisdictionProfile + RecipientClass + Channel + Purpose + Relationship + ConsentEvidence + DNC/Suppression + SourceProvenance + WorkspacePolicy + SectorOverlay + TimeWindow`.

Decision outputs:
- `ALLOW`
- `ALLOW_WITH_CONDITIONS`
- `CONSENT_REQUIRED`
- `DNC_SCREEN_REQUIRED`
- `HUMAN_REVIEW_REQUIRED`
- `BLOCK`

Every decision stores policy version/effective date, sources, conditions, disclosure requirements, opt-out rules, evidence required and next review date.

## Recipient classes
Corporate legal entity; employee/business contact at a corporate entity; sole trader/individual business owner; partnership/unincorporated entity; individual professional; existing/former customer; inbound requester; partner/vendor; unknown.

Unknown classification defaults to the stricter applicable path.

## Channels
Email; SMS/text; live phone; automated/prerecorded phone; social/direct message; postal; in-product; future provider-specific channels.

## Purposes
Cold commercial outreach; requested/inbound response; relationship marketing; transactional/service notice; research/survey; recruitment; partner/vendor; regulatory/legal.

## Global defaults
1. Global suppression/opt-out overrides AI and automation.
2. Unmapped/expired rules fail closed.
3. Public contact data is not equivalent to unrestricted marketing permission.
4. Personal-data law can apply even where a B2B channel rule does not require prior consent.
5. AI cannot override consent/DNC/suppression/time/channel rules.
6. Launch remains human-approval-first for material outbound automation.

## Initial engineering profiles
These are planning baselines based on current official guidance and require production legal/compliance review.

### EU/EEA — `EU_EEA`
- GDPR applies to relevant personal-data processing.
- Recital 47 states direct marketing may be a legitimate interest, but Brovexa must require a real necessity/balancing assessment rather than blanket legitimate-interest marking.
- Article 21 provides an unconditional right to object to processing for direct marketing; after objection, processing for that purpose must stop.
- Electronic-communications rules vary through ePrivacy/national implementation, so there is no blanket `EU email allowed` rule.
- Default unsolicited electronic-outreach state until country/channel profile exists: `HUMAN_REVIEW_REQUIRED`.

Official references:
- https://eur-lex.europa.eu/eli/reg/2016/679/art_21/oj
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679

### United Kingdom — `GB`
- PECR distinguishes corporate vs individual subscribers.
- Unsolicited electronic mail to corporate subscribers generally does not require PECR consent, but sender identity and a valid opt-out address are required.
- Sole traders and some partnerships are individual subscribers and generally need consent or a valid soft opt-in.
- UK GDPR still applies when personal data is processed for B2B marketing.
- Live calls require applicable TPS/CTPS + internal suppression screening.
- Unknown subscriber class follows the stricter individual path.

Official reference:
- https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/

### United States — `US`
- CAN-SPAM applies to commercial email, including B2B email.
- General prior opt-in is not a CAN-SPAM prerequisite, but truthful headers, non-deceptive subjects, advertising identification where required, valid postal address and clear opt-out are mandatory.
- Opt-out mechanism must remain available for at least 30 days and requests must be honored within 10 business days.
- Email harvesting/dictionary attacks are outside Brovexa's allowed acquisition model.
- Phone/SMS and state/sector privacy rules require separate overlays.

Official reference:
- https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business

### Canada — `CA`
- CASL can apply to commercial electronic messages sent to recipients in Canada from other countries.
- Baseline: express or valid implied consent, identification/contact information and working unsubscribe.
- Public availability alone is not consent evidence.
- Cold commercial electronic messages with no applicable consent evidence default to `CONSENT_REQUIRED`.

Official reference:
- https://crtc.gc.ca/eng/internet/anti/reg.htm

### Australia — `AU`
- Commercial electronic messages generally require express or valid inferred consent.
- Sender identification/contact information and functioning unsubscribe are required.
- Unsubscribe requests must be actioned within 5 working days.
- Third-party lists/senders do not remove sender responsibility.
- No consent evidence → `CONSENT_REQUIRED` for cold email/SMS.

Official reference:
- https://www.acma.gov.au/avoid-sending-spam

### Singapore — `SG`
- PDPA DNC provisions apply to specified marketing messages to Singapore telephone numbers where applicable.
- Current PDPC guidance identifies genuine B2B-targeted messages as outside DNC provisions, but recipient/business classification remains required.
- Personal-data obligations are evaluated separately.
- Dictionary/address-harvesting behavior remains prohibited/out of scope.

Official reference:
- https://www.pdpc.gov.sg/overview-of-pdpa/do-not-call-registry/business-owner/do-not-call-registry-and-your-business

### Türkiye — `TR`
- Commercial electronic communications operate under Law No. 6563, implementing regulation and İYS.
- Current official guidance states prior approval is not mandatory for recipients classified as `tacir` or `esnaf`, but after rejection/opt-out further commercial communication cannot continue without approval.
- Merchant/tradesperson recipient state must be represented and İYS-aware before production sending.
- Unknown recipient class defaults to consent/review.

Official references:
- https://ticaret.gov.tr/ic-ticaret/ticari-elektronik-iletiler/genel-bilgiler
- https://www.ticaret.gov.tr/ic-ticaret/bilgi-sistemleri/ticari-elektronik-ileti-yonetim-sistemi-iys

### United Arab Emirates — `AE`
- Cabinet Resolution No. 56 of 2024 creates specific telemarketing-call controls.
- Current official guidance includes prior company approval for telemarketing activity, DNCR controls, registered local numbers, identity/purpose disclosure, 09:00–18:00 calling hours and re-contact limits.
- Brovexa must not treat phone outreach as a generic global dialer.
- Email/SMS and sector-specific rules remain separate profiles and default to review until mapped.

Official references:
- https://u.ae/en/information-and-services/infrastructure/telecommunications
- https://www.moet.gov.ae/en/-/ministry-of-economy-and-telecommunications-and-digital-government-regulatory-authority-review-regulatory-legislations-in-organizing-operational-mechanisms-for-telemarketing-companies-in-the-uae-and-enhancing-consumer-protection-in-line-with-best-practices

### Global unmapped — `GLOBAL_UNMAPPED`
Research/discovery may proceed only under approved source/data policy. Automated commercial outreach is `HUMAN_REVIEW_REQUIRED` or `BLOCK` until a versioned jurisdiction/channel profile exists.

## `JurisdictionProfile` contract
- id/version/effective dates
- country/territory/subdivision scope
- regulator/legal-source references
- recipient classes
- channel rules
- purpose/relationship rules
- lawful-basis/consent requirements
- DNC/TPS/IYS/registry checks
- send-time restrictions
- sender identity/disclosure requirements
- postal/business-address requirements
- unsubscribe method + response SLA
- frequency/re-contact limits
- proof/evidence fields
- retention requirements
- sector overlays
- legal-review state + next-review date

## `ContactEligibility` contract
- contact/channel
- jurisdiction + recipient class
- contact provenance
- generic/business vs personal classification
- consent evidence
- suppression/DNC result
- applied profile version
- decision + conditions
- evaluatedAt/expiresAt

## Suppression
Suppression is global and monotonic by default. Workspace/org/contact/address/number/domain/account/channel suppressions may coexist. Later source discovery, re-enrichment or AI recommendation cannot silently reactivate a suppressed route.

## Production enablement gate
A jurisdiction/channel may be enabled only when official/current sources are recorded, a compliance owner approves the profile, automated boundary tests exist, suppression propagation is proven, contact provenance exists and an effective/review date is set. Unknown or expired profiles fail closed.