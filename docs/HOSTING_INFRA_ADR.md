# Brovexa — Launch Hosting, Infrastructure & Cost Control ADR v1.0

Status: **Planning Only — provider shortlist/topology; no infrastructure provisioned**

## Preferred launch validation candidate — Render

Validate Render first for Wave A/B because it provides Web Services, Private Services, Background Workers, managed PostgreSQL, Redis-compatible Key Value/Valkey, private networking, Docker/Blueprints and a relatively small operational surface.

Render explicitly documents BullMQ as a Node.js background-worker framework. Paid Key Value supports disk-backed persistence and recommends `noeviction` for queues; use journal+snapshot persistence. PostgreSQL paid instances support PITR, with recovery window dependent on workspace plan, and qualifying PostgreSQL plans can enable HA.

## Proposed launch topology

- `web`: Next.js public/operator Web
- `api`: NestJS canonical API
- `worker-research`: BullMQ research/source work
- `worker-agent`: AI/eval work
- `worker-integration`: CRM/webhook/reconciliation work
- small scheduler/reconciler where needed; canonical schedule remains DB state
- paid Render PostgreSQL
- paid Render Key Value, same region, `noeviction` + `journal-snapshot`

Start with fewer physical worker services if load is low; split by resource/fault-isolation needs rather than architecture theater.

Initial region is a Human/ADR decision based on customer concentration, residency/contracts, source/model/payment/identity provider constraints and latency—not the operator's local timezone.

## Object storage

Use S3-compatible abstraction. Preferred launch validation candidate: **Cloudflare R2 Standard**, subject to SourcePolicy/data-residency rules.

Current public pricing: $0.015/GB-month Standard storage, Class A $4.50/million, Class B $0.36/million and no Internet egress fee. R2 provides an S3-compatible API, but application code uses only a tested portable subset.

AWS S3 remains the enterprise/portability alternative.

## AWS scale path

Documented scale/enterprise fallback:
- ECS + Fargate
- RDS PostgreSQL
- ElastiCache/Valkey/Redis OSS
- S3
- AWS networking/secrets/observability services as justified

Use AWS when broader region/account/network isolation, enterprise procurement, HA/DR or scale justifies increased operational complexity. Do not pretend AWS has one fixed monthly price; Fargate, RDS, ElastiCache, storage and transfer are independently metered by region/workload.

## Neon alternative

Neon is a specialized PostgreSQL/preview alternative. Its current Launch plan is usage-based with 7-day restore/time travel; Scale extends restore/telemetry/network capabilities. Reevaluate if serverless/branching/independent DB lifecycle has measurable benefit. Do not add another provider merely for fashion.

## Infrastructure-as-code

Render deployment uses Blueprint/render.yaml where suitable. Encode service topology, runtime/Docker config, health checks and Key Value `noeviction`/persistence; keep secrets platform-managed.

Provider-neutral container/environment docs preserve a path to AWS migration.

## Environments

- local: PostgreSQL + Redis/Valkey-compatible queue + safe object-storage fixture/emulator
- CI: ephemeral DB/queue, synthetic data
- staging: separate Render services/DB/queue/bucket/credentials
- production: dedicated DB/queue/credentials/bucket

Never share production data/secrets into staging by default.

## Cost control

Track infrastructure separately from Research Credit COGS:
- Web/API/worker instance hours
- DB compute/storage/backups/HA
- queue memory
- object bytes/operations
- data transfer
- logs/traces/metrics
- CI/build/deploy

Alert on worker scale anomalies, DB storage/connections/query growth, Key Value memory, object/log retention and transfer spikes.

Fixed/base platform costs belong primarily in subscription margin; variable external research cost feeds the Research Credit model.

## Production recovery gates

Before launch:
- verify selected Render PITR window
- restore DB into isolated instance and validate
- test queue loss/rebuild/reconciliation from PostgreSQL
- test worker crash/rolling deployment/provider outage
- decide/accept PostgreSQL HA state
- prove RPO/RTO against real infrastructure
- test R2/S3 delete/lifecycle/presigned access
- document platform/region outage runbook

## Decisions

- Render integrated topology: **preferred launch validation candidate**
- Cloudflare R2: **preferred evidence object-storage validation candidate**
- AWS managed stack: **scale/enterprise fallback/migration target**
- Neon: **specialized/preview alternative**
- Kubernetes: deferred
- self-managed production Postgres/Redis on arbitrary VPS: rejected as default launch topology

No provider resources are provisioned by this document.