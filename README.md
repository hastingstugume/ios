# Internet Opportunity Scanner

A production-ready B2B SaaS platform that continuously discovers, classifies, and surfaces public internet demand signals — posts where people are actively asking for AI automation, DevOps consulting, software implementation, and B2B technical services.

---

## What It Does

- **Ingests** public posts from Reddit subreddits and RSS/Atom feeds on a 30-minute schedule
- **Classifies** each post with AI (OpenAI-compatible) to detect buying intent, recommendation requests, hiring signals, pain complaints, and more
- **Scores** each signal with a 0–100 confidence score
- **Surfaces** signals in a filterable, paginated opportunity feed
- **Alerts** your team via email when high-confidence signals appear
- **Tracks** your pipeline with save/bookmark/ignore/annotate actions

---

## Demo Credentials

After seeding, log in with:

```
Email:    alice@acmegrowth.io
Password: demo1234!
```

---

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌──────────┐
│  Next.js 14     │────▶│  NestJS API (3001)   │────▶│ Postgres │
│  Frontend (3000)│     │  REST + Swagger       │     └──────────┘
└─────────────────┘     │  BullMQ Workers       │     ┌──────────┐
                        │  Cron Scheduler       │────▶│  Redis   │
                        └──────────────────────┘     └──────────┘
                                   │
                        ┌──────────┴──────────┐
                        │  OpenAI-compatible  │
                        │  AI Classification  │
                        └─────────────────────┘
```

**Monorepo layout:**

```
apps/
  web/      → Next.js 14, App Router, TypeScript, Tailwind, shadcn-style
  api/      → NestJS, TypeScript, Prisma, BullMQ, Nodemailer
  worker/   → Standalone worker monitor (main processing in api)
packages/
  ui/       → Shared components (extend as needed)
  config/   → Shared config schemas
  types/    → Shared TypeScript types
prisma/
  schema.prisma  → Full data model
  seed.ts        → Demo data seeder
docker-compose.yml
.env.example
```

---

## Prerequisites

- **Node.js** ≥ 20
- **Yarn** ≥ 1.22 (classic)
- **Docker** + Docker Compose (for local services)

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo>
cd internet-opportunity-scanner
cp .env.example .env
yarn install
```

### 2. Start local services

```bash
yarn docker:up
# Starts: PostgreSQL (5433 on host), Redis (6379), MailHog (1025/8025)
```

### 3. Set up the database

```bash
# Apply migrations
yarn db:migrate

# Generate Prisma client
yarn db:generate

# Seed with demo data
yarn db:seed
```

### 4. Start the apps

```bash
# All three in parallel (API + Web + Worker monitor)
yarn dev

# Or individually:
yarn workspace @ios/api dev      # http://localhost:3001
yarn workspace @ios/web dev      # http://localhost:3000
```

### 5. Open the app

- **Frontend:** http://localhost:3000
- **API docs (Swagger):** http://localhost:3001/api/docs
- **MailHog (email preview):** http://localhost:8025

---

## Configuration

Edit `.env` (copied from `.env.example`):

### Required for real ingestion

```env
# Reddit API (create app at https://reddit.com/prefs/apps)
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret

# AI Classification (OpenAI or compatible)
AI_API_KEY=sk-your-key
AI_MODEL=gpt-4o-mini
```

Without Reddit credentials, the demo seed data is used. Without an AI key, a keyword-based fallback classifier runs automatically.

### Optional

```env
# S3-compatible storage for exports
STORAGE_ENDPOINT=...
STORAGE_ACCESS_KEY=...

# Custom SMTP (default: MailHog in dev)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-key
```

---

## Database

```bash
yarn db:migrate       # Run pending migrations (dev)
yarn db:deploy        # Deploy migrations (production)
yarn db:seed          # Seed demo data
yarn db:studio        # Open Prisma Studio GUI
yarn db:generate      # Regenerate Prisma client after schema changes
```

### Key models

| Model | Purpose |
|-------|---------|
| `Organization` | Multi-tenant workspace |
| `User` + `OrganizationMember` | Auth + RBAC (OWNER/ADMIN/ANALYST/VIEWER) |
| `Keyword` | Phrases to monitor |
| `Source` | Reddit subreddits or RSS feeds |
| `Signal` | Discovered + classified opportunities |
| `AlertRule` | Notification rules |
| `AuditLog` | Security audit trail |

---

## API Reference

Full Swagger docs at http://localhost:3001/api/docs

### Auth

```
POST /api/v1/auth/register    → create account + org
POST /api/v1/auth/login       → set session cookie
POST /api/v1/auth/logout      → clear session
GET  /api/v1/auth/me          → current user + memberships
```

### Signals

```
GET    /api/v1/orgs/:orgId/signals          → list with filters
GET    /api/v1/orgs/:orgId/signals/stats    → aggregated stats
GET    /api/v1/orgs/:orgId/signals/:id      → detail
PATCH  /api/v1/orgs/:orgId/signals/:id/status  → save/ignore/bookmark
POST   /api/v1/orgs/:orgId/signals/:id/annotations → add note
```

**Filter params:** `status`, `category`, `minConfidence`, `sourceId`, `keywordId`, `search`, `dateFrom`, `dateTo`, `page`, `limit`

### Keywords, Sources, Alerts, Dashboard

All under `/api/v1/orgs/:orgId/` — full CRUD with org-scoped tenant isolation.

---

## AI Classification

Each ingested post is classified by an LLM with this output schema:

```json
{
  "isOpportunity": true,
  "category": "BUYING_INTENT",
  "confidenceScore": 91,
  "whyItMatters": "...",
  "suggestedOutreach": "..."
}
```

**Categories:** `BUYING_INTENT` | `RECOMMENDATION_REQUEST` | `PAIN_COMPLAINT` | `HIRING_SIGNAL` | `PARTNERSHIP_INQUIRY` | `MARKET_TREND` | `OTHER`

If `AI_API_KEY` is not configured or unavailable, a keyword-count fallback classifier runs automatically — no hard failure.

---

## Ingestion Pipeline

1. **Cron** fires every 30 minutes (`@nestjs/schedule`)
2. All `ACTIVE` sources are queued via **BullMQ**
3. **Reddit adapter** fetches new posts from configured subreddits
4. **RSS adapter** fetches from any Atom/RSS feed URL
5. Posts are matched against org keywords — non-matching posts are discarded
6. Matched posts are **classified** by AI + **scored**
7. `Signal` records are created in Postgres
8. `IMMEDIATE` alert rules are checked and emails dispatched via SMTP

---

## Security

- Session tokens in `httpOnly` + `secure` cookies
- All tenant data queries are org-scoped — no cross-tenant data leakage
- RBAC via `OrgMemberGuard` on all org routes
- Rate limiting via `@nestjs/throttler` (configurable via env)
- Helmet for secure HTTP headers
- Input validation via `class-validator` on all DTOs
- Audit logging for sensitive actions (login, alerts, sources, member changes)
- No secrets hardcoded — `.env.example` only

---

## Testing

```bash
# Run all tests
yarn test

# API tests only
yarn workspace @ios/api test

# E2E tests
yarn workspace @ios/api test:e2e
```

---

## Deployment

### Environment setup

```bash
# 1. Set production env vars
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SESSION_SECRET=<random-64-char-string>
FRONTEND_URL=https://your-domain.com
AI_API_KEY=sk-...

# 2. Deploy DB migrations
yarn db:deploy

# 3. Build all apps
yarn build

# 4. Start API
yarn workspace @ios/api start

# 5. Start frontend (or deploy to Vercel/Netlify)
yarn workspace @ios/web start
```

### Recommended production stack

| Layer | Recommendation |
|-------|---------------|
| API | Railway, Render, Fly.io, or ECS |
| Frontend | Vercel (zero config for Next.js) |
| DB | Supabase, Neon, or RDS |
| Redis | Upstash or ElastiCache |
| Email | SendGrid, Resend, or AWS SES |
| AI | OpenAI API or Groq (faster/cheaper) |

The Docker Compose setup is development-only. For Kubernetes migration, each service (api, web, worker) can be containerized independently — the architecture was designed for this.

---

## Extending

### Add a new source type

1. Add enum value to `SourceType` in `prisma/schema.prisma`
2. Add a fetch method in `apps/api/src/ingestion/ingestion.service.ts`
3. Add UI config fields in `apps/web/src/app/(dashboard)/sources/page.tsx`

### Add a new signal category

1. Add to `SignalCategory` enum in schema
2. Add to `CATEGORY_META` in `apps/web/src/lib/utils.ts`
3. Update AI classification prompt in `classification.service.ts`

### Change the AI provider

Set `AI_PROVIDER_BASE_URL` to any OpenAI-compatible endpoint:
- Groq: `https://api.groq.com/openai/v1`
- Together AI: `https://api.together.xyz/v1`
- Ollama (local): `http://localhost:11434/v1`

---

## Roadmap (Post-MVP)

- [ ] X/Twitter source adapter
- [ ] LinkedIn post monitoring
- [ ] Slack notifications
- [ ] CRM export (HubSpot, Salesforce)
- [ ] Team invite + multi-member RBAC UI
- [ ] Weekly digest emails
- [ ] Signal deduplication across sources
- [ ] Webhook triggers
- [ ] Public API for external integrations

---

## License

MIT
