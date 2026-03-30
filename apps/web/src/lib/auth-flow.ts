export type AuthState = {
  emailVerified: boolean;
  onboardingCompleted: boolean;
};

export function getPostAuthRedirect(authState: AuthState) {
  if (!authState.emailVerified) return '/verify-email';
  if (!authState.onboardingCompleted) return '/onboarding';
  return '/dashboard';
}

export function isMfaChallengeActive(challengeToken: string | null | undefined) {
  return Boolean(challengeToken && challengeToken.trim().length > 0);
}
