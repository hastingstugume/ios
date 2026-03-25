# Architecture Decision Records

## ADR-001: NestJS for the API layer

**Decision:** Use NestJS + TypeScript for the backend API and worker.

**Rationale:** NestJS provides built-in support for dependency injection, decorators, modules, guards, interceptors, and pipes — everything needed for a secure, testable multi-tenant SaaS API. It integrates cleanly with BullMQ (`@nestjs/bull`), scheduling (`@nestjs/schedule`), configuration (`@nestjs/config`), and Swagger (`@nestjs/swagger`).

**Alternatives considered:** Express + Fastify (too much manual wiring), Hono (great for edge but less ecosystem for background jobs).

---

## ADR-002: PostgreSQL + Prisma ORM

**Decision:** Use PostgreSQL as the primary database with Prisma as the ORM.

**Rationale:** Prisma provides type-safe database access, auto-generated migrations, and a strong query builder. PostgreSQL is sufficient for all v1 workloads and provides excellent indexing, `jsonb` support for `config` and `classificationRaw` fields, and a clear scaling path.

**Note:** Tenant isolation is enforced at the query level — every query involving tenant-owned data includes an `organizationId` filter. This is enforced by the `OrgMemberGuard` and consistent service patterns.

---

## ADR-003: BullMQ + Redis for async jobs

**Decision:** Use Bull/BullMQ with Redis for ingestion and alert jobs.

**Rationale:** The ingestion pipeline (fetch → normalize → classify → persist) is slow (multiple HTTP calls + AI API). Running it synchronously would block the request cycle. BullMQ provides reliable queuing, retries with exponential backoff, and job tracking — all essential for a production ingestion pipeline.

**Queue:** `ingestion`
- `fetch-source` — triggered by cron every 30 minutes per active source
- `check-alerts` — triggered after each signal is created to match IMMEDIATE alert rules

---

## ADR-004: OpenAI-compatible AI abstraction

**Decision:** Abstract the AI layer behind an OpenAI-compatible interface, configurable via `AI_PROVIDER_BASE_URL`.

**Rationale:** This allows the platform to work with OpenAI, Groq, Together AI, Mistral, or any local Ollama model without code changes. The classification prompt always returns structured JSON, making it provider-agnostic. A keyword-based fallback ensures the system degrades gracefully when the AI provider is unavailable.

---

## ADR-005: Session-cookie auth (not JWT)

**Decision:** Use server-side sessions stored in PostgreSQL with `httpOnly` cookie transport.

**Rationale:** JWTs cannot be server-side invalidated (logout doesn't truly expire the token). For a B2B SaaS with sensitive business data, session cookies with server-side invalidation are more appropriate. Sessions are stored in the `Session` table and validated on every request.

**Security properties:**
- `httpOnly: true` — prevents XSS token theft
- `secure: true` (production) — HTTPS only
- `sameSite: lax` — CSRF protection
- Server-side expiry with DB-backed invalidation

---

## ADR-006: Monorepo with Yarn Workspaces

**Decision:** Use a Yarn workspace monorepo with apps (`web`, `api`, `worker`) and packages (`types`, `config`, `ui`).

**Rationale:** Shared types and utilities avoid duplication. Single repo makes cross-cutting changes (e.g. adding a new signal category) atomic. Packages can be published independently if needed.

---

## Scaling Path

When v1 outgrows a single server:

1. **Database:** Add read replicas for the feed queries. Partition the `Signal` table by `organizationId` at scale.
2. **Redis:** Move to Redis Cluster or Upstash for horizontal scaling of job queues.
3. **Workers:** Extract the `IngestionProcessor` into a separate NestJS microservice process — it's already modular.
4. **Frontend:** Next.js deploys to Vercel with zero config. Edge caching for the dashboard summary.
5. **AI:** Add a queue for AI classification to decouple it from ingestion latency.
