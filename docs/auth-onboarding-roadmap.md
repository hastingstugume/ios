# Auth, Onboarding, Verification, and MFA Roadmap

## Purpose

This document is the implementation tracker for the next-generation auth and onboarding flow.

It is the source of truth for:

1. The target user journey from landing page to dashboard.
2. The backend and frontend work needed to support email/password, provider login, verification, onboarding, and future MFA.
3. The commit-by-commit implementation order so work can be delivered in testable slices.

---

## Product Goals

- Reduce friction on login and registration.
- Support trusted provider-based sign-in for faster adoption.
- Move organization/workspace setup to a guided onboarding flow after authentication.
- Require email verification for password-based signups.
- Preserve invitation-based workspace joining.
- Design the auth stack so MFA can be added later without a major rewrite.

---

## Target User Flows

### 1. Email/Password Signup

1. User opens `Register`
2. User enters name, email, password
3. System creates account with `emailVerified = false`
4. System sends verification email
5. User lands on a verify-email state/page
6. User verifies email
7. User signs in or is auto-signed in
8. User completes onboarding:
   - choose `Freelancer` or `Business`
   - enter appropriate name/details
   - create workspace
9. User lands on dashboard

### 2. Provider Signup / Login

1. User clicks `Continue with Google`, `Microsoft`, or `GitHub`
2. Provider authenticates user
3. System creates or links local identity
4. If first-time user:
   - send them to onboarding
5. If returning onboarded user:
   - send them to dashboard

### 3. Invitation Flow

1. User opens invite link
2. User registers via email/password or provider
3. If provider email matches invite email, or email/password registration uses invite token:
   - account joins invited workspace
4. User completes any missing profile/onboarding fields
5. User lands in the invited workspace

### 4. Returning User

- Verified + onboarded: `/dashboard`
- Verified + not onboarded: `/onboarding`
- Unverified password user: `/verify-email`
- Logged out: landing page at `/`

---

## UX Requirements

### Login Page

- Add cleaner visual hierarchy and stronger CTA structure
- Add provider buttons:
  - Google
  - Microsoft
  - GitHub
- Keep email/password login as a secondary path
- Keep `Back to home`
- Add clear path to register

### Register Page

- Make account creation separate from organization creation
- For non-invite flow:
  - collect only name, email, password
- After signup:
  - show verification state instead of sending user straight to dashboard
- Keep invitation-specific messaging for invite-token flows
- Keep `Back to home`

### Onboarding Flow

- Add dedicated onboarding route
- Ask:
  - `Are you a freelancer or a business?`
- If freelancer:
  - collect solo business / personal brand name
  - optional website
- If business:
  - collect organization/business name
  - optional website
- Create workspace after onboarding, not during initial registration

### Verification UX

- Add verify-email page
- Add resend-verification action
- Add clear blocked-state messaging when password user has not verified email

---

## Backend Requirements

### Required Data Model Changes

#### User

Keep:
- `email`
- `passwordHash`
- `emailVerified`

Add:
- `accountType` (`FREELANCER`, `BUSINESS`) when onboarding begins
- `onboardingCompletedAt`
- optional onboarding metadata like `websiteUrl`

#### New Model: `UserIdentity`

Purpose:
- store provider-linked identities

Fields:
- `id`
- `userId`
- `provider`
- `providerUserId`
- `email`
- `createdAt`

Constraints:
- unique on `(provider, providerUserId)`
- unique on provider identity binding

#### New Model: `EmailVerificationToken`

Fields:
- `id`
- `userId`
- `token`
- `expiresAt`
- `usedAt`
- `createdAt`

Rules:
- one or more tokens allowed historically
- only unexpired + unused token is valid

#### MFA Prep

Do not fully implement yet, but reserve design for:
- `MfaMethod`
- `MfaRecoveryCode`
- `MfaChallenge`

---

## API / Auth Flow Changes

### Existing Flows To Refactor

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### New or Updated Endpoints

#### Email/Password

- `POST /auth/register`
  - create user only
  - do not create organization unless invite flow explicitly requires joining an existing workspace
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/login`
  - reject unverified password user with clear message

#### Provider Auth

- `GET /auth/oauth/:provider/start`
- `GET /auth/oauth/:provider/callback`

Supported providers in v1:
- Google
- Microsoft
- GitHub

#### Onboarding

- `POST /auth/onboarding`
  - accepts `accountType`
  - accepts workspace / business / freelancer naming details
  - creates workspace if needed
  - completes onboarding

#### Session/Identity

- `GET /auth/me`
  - should return:
    - user
    - memberships
    - verification state
    - onboarding state

---

## Security / Rules

### Email Verification

- Required for email/password users before app access
- Not required for provider identities when provider email is trusted and verified
- Verification tokens should expire, e.g. after 24 hours
- Resend should be rate limited

### Account Linking

- If provider email matches an existing verified account, link carefully
- Do not silently merge untrusted or mismatched accounts
- Do not create duplicate users for same provider/email combination

### Invitations

- Invitation flow must remain compatible with both password and provider signup
- Invite token should still govern workspace joining

### MFA Future Rule

- MFA comes after:
  - email verification
  - onboarding completion
- Preferred future rollout:
  - TOTP
  - backup codes
  - optional email OTP fallback

---

## Routing Rules

### Middleware / Guard Expectations

- Logged out user:
  - `/` -> landing
  - `/login` and `/register` -> allowed

- Authenticated but unverified password user:
  - redirect to `/verify-email`

- Authenticated and verified but not onboarded:
  - redirect to `/onboarding`

- Authenticated, verified, onboarded:
  - `/` -> `/dashboard`
  - `/login` -> `/dashboard`
  - `/register` -> `/dashboard`

---

## Commit Tracker

### Commit 1

`feat(auth): add verification and identity models`

Checklist:
- [x] Add `UserIdentity`
- [x] Add `EmailVerificationToken`
- [x] Add onboarding state fields to `User`
- [x] Add enums for account type if needed
- [x] Add Prisma migration
- [x] Regenerate Prisma client

### Commit 2

`feat(auth): require email verification for password signups`

Checklist:
- [x] Refactor register flow to create user without org creation
- [x] Generate verification token
- [x] Add verify-email endpoint
- [x] Add resend-verification endpoint
- [x] Block password login for unverified users
- [x] Add backend tests

### Commit 3

`feat(auth): add oauth provider login`

Checklist:
- [x] Add provider start/callback routes
- [x] Add Google auth
- [x] Add Microsoft auth
- [x] Add GitHub auth
- [x] Add user identity linking logic
- [x] Add provider-based session creation
- [ ] Add backend tests

### Commit 4

`feat(web): redesign login and register screens`

Checklist:
- [x] Refresh login layout
- [x] Add provider buttons
- [x] Improve error states
- [x] Refresh register layout
- [x] Remove org creation from initial register step
- [x] Add verify-email state/page

### Commit 5

`feat(onboarding): add freelancer and business setup flow`

Checklist:
- [x] Add onboarding route and UI
- [x] Add freelancer/business selection
- [x] Add workspace creation step
- [x] Handle invitation-aware onboarding
- [ ] Add frontend tests if applicable

### Commit 6

`fix(auth): route users by verification and onboarding state`

Checklist:
- [x] Update middleware
- [x] Update auth guards/hooks
- [x] Redirect authenticated users correctly
- [x] Ensure returning users land in correct place

### Commit 7

`docs(auth): document provider, verification, and future mfa flow`

Checklist:
- [x] Update this roadmap with implementation status
- [x] Document provider env vars
- [x] Document verification flow
- [x] Document future MFA rollout path

---

## Provider And Env Setup

### Required Env Vars

- `API_BASE_URL`
- `FRONTEND_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- optional: `MFA_ISSUER` to override the authenticator app label

### Local OAuth Callback URLs

- Google: `http://localhost:3001/api/v1/auth/oauth/google/callback`
- Microsoft: `http://localhost:3001/api/v1/auth/oauth/microsoft/callback`
- GitHub: `http://localhost:3001/api/v1/auth/oauth/github/callback`

### Frontend / API Assumptions

- OAuth callbacks terminate on the API, not the Next.js frontend
- `FRONTEND_URL` is where the API redirects after callback completion
- `API_BASE_URL` must match the callback URI registered with each provider exactly

## Verification Flow

- Email/password registration creates an unverified user
- A verification email is sent immediately with `/verify-email?token=...`
- Unverified users cannot complete login into the app
- Users can resend verification from the login and verify-email screens
- Successful verification creates a session and routes the user into onboarding

## MFA Rollout Path

- Current implementation uses authenticator-app TOTP
- Users enable MFA from Settings
- Setup flow:
  - generate a pending secret
  - add it to an authenticator app
  - verify one code
  - receive one-time backup codes
- Login flow:
  - password or OAuth completes primary authentication
  - if MFA is enabled, sign-in pauses on a challenge step
  - user must enter a TOTP code or backup code to finish session creation
- Future hardening still recommended:
  - admin-enforced MFA
  - recovery UX improvements
  - device/session visibility
  - optional passkeys

---

## Test Plan

### Backend

- [x] Register creates unverified user
- [x] Register creates verification token
- [x] Verify-email marks user verified
- [ ] Resend-verification rotates or reissues token safely
- [x] Password login rejects unverified user
- [x] Provider login creates identity
- [x] Provider login links existing verified user safely
- [x] Invitation + provider login works
- [x] Onboarding creates freelancer workspace correctly
- [x] Onboarding creates business workspace correctly
- [x] MFA setup prepares a pending secret
- [x] MFA enable verifies a TOTP code
- [x] MFA login challenge completes with a valid code

### Frontend

- [x] Login page renders provider buttons
- [x] Register page leads into verification state
- [x] Verify-email page handles success/failure/resend
- [x] Onboarding branches correctly by account type
- [x] Authenticated users route to dashboard/onboarding/verify-email correctly
- [x] Frontend auth-flow helpers are covered by unit tests

### Acceptance

- [x] New email/password user cannot access app before verification
- [x] New provider user can onboard without password flow
- [x] Returning onboarded user lands on dashboard
- [ ] Invite flow still works end to end

---

## Open Future Work

### MFA

Implemented now:
- TOTP enrollment
- backup codes
- MFA challenge during login
- settings management UI

Still later:
- recovery flow hardening
- admin-enforced MFA
- passkeys / stronger step-up options

### Nice-to-have Later

- passkeys
- organization templates during onboarding
- admin-enforced MFA
- session management UI

---

## Status Notes

Use this section to track implementation notes as work progresses.

- Implemented:
  - email/password signup now creates unverified users and sends verification email
  - verify-email and resend-verification flows are implemented
  - provider auth is implemented for Google, Microsoft, and GitHub
  - invitation-aware signup works for password and provider flows
  - onboarding route is live with freelancer vs business setup
  - workspace creation now happens during onboarding instead of initial registration
  - users are routed by auth state:
    - logged out -> `/`
    - unverified -> `/verify-email`
    - verified but not onboarded -> `/onboarding`
    - verified and onboarded -> `/dashboard`
  - stale sessions are cleared and redirected back to landing
  - auth pages have been redesigned and provider buttons added
  - auth pages are pinned to a consistent dark theme regardless of app theme
  - provider-only accounts no longer show local password change UI
  - password reset request and reset completion are implemented
  - MFA is implemented with authenticator-app setup, backup codes, login challenge, and settings management
  - provider and callback env requirements are now documented in this roadmap
  - frontend auth-flow helper logic has unit test coverage

- Still left:
  - add resend-verification rotation coverage
  - expand frontend auth testing beyond helper-level coverage
  - add MFA recovery flow hardening
  - add session/device management UI
