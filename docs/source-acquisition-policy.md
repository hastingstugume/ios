# Source Acquisition Policy

This document is the source of truth for which source types are considered production-ready, limited, legacy, or partner-gated in the intent-intelligence product.

## Policy Goals

- Prefer official APIs, publisher-provided feeds, or approved commercial providers.
- Avoid presenting brittle or legally weak acquisition paths as first-class production features.
- Expose provenance and support status in-product so operators understand where signals come from.

## Source Matrix

| Source Type | Platform | Provider | Acquisition Mode | Support Status | Policy |
|---|---|---|---|---|---|
| `REDDIT` | Reddit | Reddit Data API | `official_api` | `production_ready` | Allowed |
| `REDDIT_SEARCH` | Reddit | Reddit Data API | `official_api` | `production_ready` | Allowed |
| `RSS` | Publisher feeds | RSS / Atom | `rss` | `production_ready` | Allowed |
| `STACKOVERFLOW_SEARCH` | Stack Overflow | Stack Exchange API | `official_api` | `production_ready` | Allowed with attribution |
| `GITHUB_SEARCH` | GitHub | GitHub Search API | `official_api` | `production_ready` | Allowed with rate-limit handling |
| `HN_SEARCH` | Hacker News | Public search/feed provider | `provider_api` | `limited` | Allowed as limited-support pending fuller lawful feed migration |
| `WEB_SEARCH` | Web search | Legacy search adapter | `legacy` | `legacy` | Do not expand; replace with approved provider before wider rollout |
| `MANUAL` | Manual import | User-supplied | `manual_only` | `production_ready` | Allowed |
| `TWITTER` | X | Partner integration required | `partner_required` | `planned` | Do not expose until lawful provider access exists |

## Planned Platform Coverage

- Forums and communities: only when the platform exposes feeds, APIs, or operator-added manual sources with clear terms.
- LinkedIn: only through an explicitly approved partner/provider route.
- Facebook: only through an explicitly approved partner/provider route.
- X: only through an explicitly approved partner/provider route.

## Product Rules

- Every source surfaced in the UI should carry provider and support metadata.
- Legacy source paths must be visually identifiable and should not be the default recommendation.
- AI may assist with query generation, prioritization, summarization, and action drafting, but not justify unauthorized crawling.
