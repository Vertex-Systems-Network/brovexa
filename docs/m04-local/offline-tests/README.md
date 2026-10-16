# M04 offline regression harness

Execute from `working`: `node --experimental-strip-types --test offline-tests/*.test.mjs`.

Current baseline: 233/233 passing checks including nested subtests; Node 22.16, offline injected fixtures, NO PostgreSQL, NO native Zod, NO pnpm workspace, NO live network.

Coverage: scope/provenance, fixture digest/status/media/byte attestation, test-only transport, bounded partial capability findings, negatives-vs-unknown, HTML false positives, expiry/clock/TOCTOU, tenant-scoped DB handoff, full offline authorization/extraction/persistence seam.

A passing offline suite cannot substitute for native PostgreSQL migration rollback, real Zod contract tests, Valkey, full SSRF/transport verification or CI gate.

WEB-012/013/014 additionally cover raw-text/CDATA tag spoofing and 20,000-token HTML tag-count resource bounds.