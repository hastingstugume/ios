# Product Gap Roadmap

## Purpose

This document is the source of truth for two things:

1. What the landing page and signed-in product can truthfully claim today.
2. The implementation roadmap used to close the remaining product gaps without placeholder UX, fake data, or frontend-only states.

## Hard Rules

- No dummy metrics on the landing page.
- No fake workspace states or decorative controls that do not perform a real action.
- No "coming soon" on primary signed-in routes unless the feature is intentionally hidden from marketing and does not block the core flow.
- Prefer removing an unshipped claim over inventing a thin implementation.
- Seed/demo data is acceptable only when it is real backend data served by the app.

## Capability Inventory

| Subsystem | Current State |
|---|---|
| Landing | Uses real backend-backed preview data through a public landing endpoint. Copy is aligned to shipped feed, alerts, workspace, and settings capabilities. |
| Auth | Session-based login, logout, register, invited-user registration, profile update, and password change are implemented. |
| Dashboard | Real summary metrics, trend chart, category breakdown, pipeline-stage breakdown, and recent high-confidence feed are implemented from backend data. |
| Feed | Real signal listing, filtering, pagination, status updates, stage filtering, owner filtering, and quick workflow stage updates are implemented. |
| Signals | Real detail view, annotations, why-it-matters, suggested outreach, stage updates, owner assignment, next-step tracking, and close-state tracking are implemented. |
| Keywords | Create, edit, pause/resume, delete, and search are implemented with backend persistence. |
| Sources | Create, edit, pause/resume, delete, validation, and search are implemented with backend persistence. |
| Alerts | Create, edit, pause/resume, delete, confidence/frequency rules, category targeting, keyword targeting, and last-trigger timestamps are implemented. |
| Settings | Real profile save, workspace save, password change, team admin, pending invites, and audit log UI are implemented. |
| Workspace Admin | Workspace switching, member listing, invite/add teammate, role updates, member removal, and audit log browsing are implemented. |
| Billing | Stripe Checkout self-serve upgrades are implemented for paid tiers, and webhook events sync workspace plan changes back into organization metadata. |

## Promise Matrix

| Landing claim | Current backend status | Current frontend status | Truthful now? | Required work |
|---|---|---|---|---|
| Live signal preview | Public landing endpoint returns real demo-safe signals and aggregates | Landing page renders real preview rows and stats | Yes | Maintain seed/demo org quality |
| Find buyer intent before competitors | Signal ingestion, classification, filtering, and ranking exist | Dashboard, feed, and signal detail support review/action | Yes | Continue improving source coverage |
| Confidence scoring | Signal model stores confidence score and dashboard/feed use it | Landing, feed, and details display real confidence | Yes | None |
| Alert rules | Alerts support confidence, categories, keywords, recipients, and trigger timestamps | Alerts UI supports create/edit/toggle/delete with targeting | Yes | Add digest delivery UX later if needed |
| Team workspaces | Organization members, invitations, membership roles, audit log, org switching exist | Sidebar switcher and settings admin UI are real | Yes | Invitation acceptance UX can be expanded further later |
| Save and act on signals | Saved/bookmarked/ignored, pipeline stages, assignment, next steps, and close-state tracking are implemented | Feed/detail UI supports real workflow updates backed by the API | Yes | Continue hardening with tests and QA |
| Pricing and plans | Organization has a stored plan field and Stripe checkout mapping for paid tiers | Signed-in pricing and upgrade CTAs trigger checkout session creation | Yes (with env config) | Keep plan/price mapping aligned with Stripe dashboard |
| Self-serve billing | Stripe Checkout + webhook-driven plan sync are available | Signed-in upgrade controls route to secure checkout instead of email requests | Yes (Starter/Growth; Scale if configured) | Add billing portal and invoice history UX next |

## Acceptance Criteria By Subsystem

### Landing

- Landing preview and stats are sourced from `/api/v1/public/landing`.
- No hardcoded fake operational metrics remain.
- CTA language is reduced to `Get started` and `Sign in`.
- Pricing and upgrade controls must match configured Stripe prices and active plan entitlements.

### Auth

- Users can update profile name without leaving the session.
- Users can change password with current-password validation.
- Invited users can register into an existing workspace with an invitation token.

### Workspace Admin

- Owners/admins can add teammates by email.
- Existing users are added directly as members.
- New users receive a real invitation record with a shareable invite link.
- Owners/admins can change member roles and remove non-owner members.
- Users with multiple memberships can switch workspace context from the sidebar.

### Settings

- No inert save buttons remain.
- Workspace details, team access, audit log, and password actions are all backed by real endpoints.
- Non-admins cannot perform restricted workspace mutations.

### Keywords and Sources

- Users can edit existing records.
- Duplicate names/phrases are rejected by the backend.
- Invalid source config is rejected with a clear error message.

### Alerts

- Rules persist and display categories, keywords, recipients, frequency, and confidence thresholds.
- Immediate alert evaluation respects both category and keyword targeting.
- `lastTriggeredAt` remains visible in the UI when rules fire.

### Signals and Workflow

- Signals support `TO_REVIEW`, `IN_PROGRESS`, `OUTREACH`, `QUALIFIED`, `WON`, `LOST`, and `ARCHIVED`.
- Signals can be assigned only to real members of the current workspace.
- Signal detail supports a persisted next-step field.
- Closed stages set close-state metadata and are reflected in dashboard metrics.

### Deferred

- Billing portal and invoice history UX
- Invite email delivery hardening beyond the current SendGrid integration
- Additional workflow automation such as reminders, SLAs, or stage-change notifications

## Commit Roadmap

### Commit 1

- Add this document as the product source of truth.

### Commit 2

- Align landing page copy and visuals to real capabilities.
- Add public landing endpoint for real demo-safe preview data.

### Commit 3

- Finish settings persistence with profile, password, and workspace mutations.

### Commit 4

- Deliver workspace switching, team admin, pending invites, and audit log UI.

### Commit 5

- Complete keyword/source edit flows and backend validation.

### Commit 6

- Expose full alert targeting UX and fix keyword-aware immediate alert matching.

### Commit 7

- Deliver advanced signal workflow with stages, ownership, next steps, and dashboard alignment.

### Commit 8

- Implement Stripe checkout upgrade flow and webhook plan synchronization.

### Commit 9

- Add customer billing portal and complete billing lifecycle UX.

## Verification Checklist

- Profile update persists after refresh.
- Password change rejects invalid current password.
- Workspace name update persists after refresh.
- Sidebar workspace switch reloads org-scoped data.
- Team invite creates a real member or invitation record.
- Role changes and removals are enforced by backend permissions.
- Keyword and source edits persist and validate correctly.
- Alert rules store categories and keywordIds and match against real signal data.
- Landing page renders backend-sourced preview data and billing copy matches shipped checkout behavior.
- After schema changes, `yarn db:migrate` and `yarn db:generate` are run before TypeScript verification so Prisma types stay in sync with the code.
