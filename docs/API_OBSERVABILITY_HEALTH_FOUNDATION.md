# M01 API, Observability, and Health Foundation

Status: implementation contract for ABD-263. This slice establishes provider-neutral API correlation and operational behavior; it does not activate a production telemetry vendor or exporter.

## Request correlation

Every HTTP request receives two server-side correlation identifiers:

- `requestId`: a bounded, log-safe request identifier. A syntactically safe incoming `x-request-id` may be preserved; unsafe or missing values are replaced with a server-generated UUID.
- `traceId`: a 32-hex trace identifier. A valid non-zero W3C `traceparent` trace ID is preserved; otherwise a cryptographically random trace ID is generated.

Both identifiers are returned in `x-request-id` and `x-trace-id` response headers. They are also attached to the in-process request context so later tenant/job/agent boundaries can correlate logs and traces without trusting provider claims or user-controlled free-form metadata.

This is deliberately compatible with a later OpenTelemetry implementation without claiming that an OpenTelemetry SDK, collector, backend, or exporter is active today.

## Stable public errors

HTTP errors return the canonical `ApiError` shape:

- `code`
- `message`
- `requestId`
- `traceId`

Framework-generated route details and arbitrary internal exception messages are not exposed. Explicit application errors are preserved only when they provide a reviewed uppercase error code and bounded public message. Unknown 5xx failures return `INTERNAL_ERROR` with a generic message.

Database connection strings, provider exceptions, stack traces, secrets, raw evidence, and unnecessary personal data must never be copied into public error bodies.

## Structured request logs

Completed API requests emit one structured JSON log record with:

- event name
- request ID
- trace ID
- HTTP method
- path without query string
- response status
- duration in milliseconds

Failure logs record correlation, status, and exception class only. Query strings are deliberately removed before request paths reach structured logs because URLs can contain tokens, emails, search terms, or other sensitive values.

This foundation does not log request/response bodies, authorization headers, cookies, raw user agents, database URLs, provider credentials, or raw source/evidence payloads.

## Health and readiness semantics

`GET /health` remains process health. It can succeed without a database and continues to expose only the stable Brovexa API health contract.

`GET /ready` remains dependency/schema readiness. It fails closed when PostgreSQL is not configured, unavailable, the required PostgreSQL major version is wrong, or the expected schema is absent.

Readiness failure bodies pass through the same stable correlated error boundary and therefore gain request/trace IDs without exposing raw database exceptions or credentials.

## Executable evidence

ABD-263 evidence must prove:

- valid request IDs can propagate while unsafe request IDs are regenerated;
- W3C trace IDs can propagate while an all-zero trace ID is rejected;
- response correlation headers match the request context;
- API errors require both correlation identifiers;
- arbitrary internal exception messages are redacted;
- reviewed readiness errors preserve their stable public codes/messages;
- query strings do not appear in structured request log paths;
- a live missing route returns a stable correlated `NOT_FOUND` error rather than framework route text;
- the existing API source-to-runtime reload loop still works;
- ABD-260 PostgreSQL, ABD-261 queue/Valkey, and ABD-262 identity/RBAC regression gates remain green.

## Explicit non-scope

This slice does not:

- choose or activate an observability SaaS/provider;
- install an OpenTelemetry SDK/exporter/collector;
- send telemetry off-host;
- add production secrets;
- activate production deployment;
- add request/response body logging;
- define customer-facing SLA/SLO guarantees;
- replace future metrics/tracing ADR work.
