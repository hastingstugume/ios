import { getPostAuthRedirect, isMfaChallengeActive } from './auth-flow';

describe('auth flow helpers', () => {
  it('routes unverified users to verify-email', () => {
    expect(getPostAuthRedirect({ emailVerified: false, onboardingCompleted: false })).toBe('/verify-email');
  });

  it('routes verified but not onboarded users to onboarding', () => {
    expect(getPostAuthRedirect({ emailVerified: true, onboardingCompleted: false })).toBe('/onboarding');
  });

  it('routes fully ready users to the dashboard', () => {
    expect(getPostAuthRedirect({ emailVerified: true, onboardingCompleted: true })).toBe('/dashboard');
  });

  it('detects whether an MFA challenge token is active', () => {
    expect(isMfaChallengeActive('mfa_123')).toBe(true);
    expect(isMfaChallengeActive('')).toBe(false);
    expect(isMfaChallengeActive(undefined)).toBe(false);
  });
});
