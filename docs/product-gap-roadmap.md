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
| Dashboard | Real summary metrics, trend chart, category breakdown, and recent high-confidence feed are implemented from backend data. |
| Feed | Real signal listing, filtering, pagination, and status updates are implemented. |
| Signals | Real detail view, annotations, why-it-matters, suggested outreach, and status actions are implemented. |
| Keywords | Create, edit, pause/resume, delete, and search are implemented with backend persistence. |
| Sources | Create, edit, pause/resume, delete, validation, and search are implemented with backend persistence. |
| Alerts | Create, edit, pause/resume, delete, confidence/frequency rules, category targeting, keyword targeting, and last-trigger timestamps are implemented. |
| Settings | Real profile save, workspace save, password change, team admin, pending invites, and audit log UI are implemented. |
| Workspace Admin | Workspace switching, member listing, invite/add teammate, role updates, member removal, and audit log browsing are implemented. |
| Billing | Deferred. Plan is visible as organization metadata only. No self-serve billing or payment processing is implemented. |

## Promise Matrix

| Landing claim | Current backend status | Current frontend status | Truthful now? | Required work |
|---|---|---|---|---|
| Live signal preview | Public landing endpoint returns real demo-safe signals and aggregates | Landing page renders real preview rows and stats | Yes | Maintain seed/demo org quality |
| Find buyer intent before competitors | Signal ingestion, classification, filtering, and ranking exist | Dashboard, feed, and signal detail support review/action | Yes | Continue improving source coverage |
| Confidence scoring | Signal model stores confidence score and dashboard/feed use it | Landing, feed, and details display real confidence | Yes | None |
| Alert rules | Alerts support confidence, categories, keywords, recipients, and trigger timestamps | Alerts UI supports create/edit/toggle/delete with targeting | Yes | Add digest delivery UX later if needed |
| Team workspaces | Organization members, invitations, membership roles, audit log, org switching exist | Sidebar switcher and settings admin UI are real | Yes | Invitation acceptance UX can be expanded further later |
| Save and act on signals | Saved/bookmarked/ignored plus notes are implemented | Feed/detail UI supports these actions | Yes | Workflow stages remain intentionally deferred |
| Pricing and plans | Organization has a stored plan field, but no payment flow exists | Landing pricing is informational only; settings show active plan metadata | Partially | Keep pricing non-transactional until billing project starts |
| Self-serve billing | No payment processor, subscription lifecycle, or invoice handling exists | No billing controls remain in signed-in UX | No claim made | Separate billing project required |

## Acceptance Criteria By Subsystem

### Landing

- Landing preview and stats are sourced from `/api/v1/public/landing`.
- No hardcoded fake operational metrics remain.
- CTA language is reduced to `Get started` and `Sign in`.
- Pricing remains informational and does not imply working self-serve billing.

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

### Deferred

- Billing and subscription automation
- Rich pipeline stages beyond saved/bookmarked/ignored plus annotations
- Invite email delivery and polished invitation acceptance flows beyond token-based registration

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

- Defer advanced pipeline stages and keep landing/signed-in messaging aligned to current saved/bookmarked/ignored workflow.

### Commit 8

- Remove non-functional billing controls and keep plan display informational only.

### Commit 9

- Run truth pass and verification across landing plus signed-in flows.

## Verification Checklist

- Profile update persists after refresh.
- Password change rejects invalid current password.
- Workspace name update persists after refresh.
- Sidebar workspace switch reloads org-scoped data.
- Team invite creates a real member or invitation record.
- Role changes and removals are enforced by backend permissions.
- Keyword and source edits persist and validate correctly.
- Alert rules store categories and keywordIds and match against real signal data.
- Landing page renders backend-sourced preview data and does not over-claim billing or advanced pipeline stages.
