# Development Guide

## Day-by-Day Build Plan (Reference)

| Days | Focus |
|------|-------|
| 1–2  | Project scaffold, auth, org model, Docker local setup ✅ |
| 3–4  | Keywords, sources, signal schema, ingestion adapters ✅ |
| 5–6  | Classification pipeline, scoring, persistence, dashboard API ✅ |
| 7–8  | Opportunity feed UI, filters, signal detail UI ✅ |
| 9    | Alerts, bookmarks, ignore/saved actions ✅ |
| 10   | Dashboard polish, seeded demo data, quality pass ✅ |
| 11–12 | Tests, hardening, docs, Docker, zip export ✅ |

---

## Adding a New Source Adapter

1. Add a value to `SourceType` enum in `prisma/schema.prisma`
2. Run `yarn db:migrate` to apply schema change
3. Add a `fetchXxx()` method in `apps/api/src/ingestion/ingestion.service.ts`
4. Register it in the `fetchSource()` dispatch block
5. Add source type config fields in `apps/web/src/app/(dashboard)/sources/page.tsx`

Example Reddit-style adapter pattern:

```typescript
private async fetchMySource(config: { apiKey: string; channel: string }) {
  const response = await fetch(`https://api.mysource.io/posts?channel=${config.channel}`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });
  const data = await response.json();
  return data.posts.map((p: any) => ({
    externalId: p.id,
    title: p.title,
    text: p.body,
    url: p.url,
    author: p.author,
    publishedAt: new Date(p.created_at),
  }));
}
```

---

## Adding a New RBAC Role

1. Add to `UserRole` enum in `prisma/schema.prisma`
2. Update `OrgMemberGuard` to check role if needed
3. Add role-specific UI gating in the frontend

---

## Environment Variables Reference

See `.env.example` for the full list with descriptions.

Key variables for first-time setup:

```bash
DATABASE_URL          # Postgres connection string
REDIS_URL             # Redis connection string  
SESSION_SECRET        # Random secret ≥32 chars (use openssl rand -hex 32)
AI_API_KEY            # OpenAI-compatible API key
REDDIT_CLIENT_ID      # Reddit app client ID
REDDIT_CLIENT_SECRET  # Reddit app client secret
FRONTEND_URL          # Full URL of the frontend (for CORS + email links)
SMTP_HOST             # SMTP server host
```

---

## Useful Scripts

```bash
# Reset everything and re-seed
yarn docker:reset && yarn db:migrate && yarn db:seed

# View DB in browser
yarn db:studio

# Check API health
curl http://localhost:3001/api/v1/auth/me

# View queued jobs
# Install Bull Board: https://github.com/felixmosh/bull-board
```

---

## Code Style

- All backend files use NestJS decorators and DI patterns
- All services are injectable and have clear public method contracts
- All routes require `AuthGuard` + `OrgMemberGuard` except auth endpoints
- All list endpoints return `{ data, meta }` paginated responses
- All mutations create an `AuditLog` entry for sensitive actions
- Frontend uses React Query for all server state — no local state for fetched data
- Tailwind classes only — no inline styles except dynamic values (e.g. chart widths)
