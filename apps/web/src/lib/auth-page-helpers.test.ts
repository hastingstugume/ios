import { getOnboardingWorkspaceSeed, getRegisterPageCopy, getVerifyEmailMode } from './auth-page-helpers';

describe('auth page helpers', () => {
  it('returns invitation-specific register copy when an invite token is present', () => {
    expect(getRegisterPageCopy('invite_123')).toEqual({
      eyebrow: 'Accept Invitation',
      title: 'Join your workspace',
      description: 'Finish setup and we’ll connect you to the invited workspace.',
      submitLabel: 'Join workspace',
      showInvitationNotice: true,
    });
  });

  it('returns standard register copy when there is no invite token', () => {
    expect(getRegisterPageCopy()).toEqual({
      eyebrow: 'Create Account',
      title: 'Create your account',
      description: 'Create your account first. Workspace setup comes next.',
      submitLabel: 'Continue',
      showInvitationNotice: false,
    });
  });

  it('chooses verify-email mode from the presence of a token', () => {
    expect(getVerifyEmailMode('verify_token')).toBe('verify');
    expect(getVerifyEmailMode('')).toBe('resend');
    expect(getVerifyEmailMode(undefined)).toBe('resend');
  });

  it('prefers the current org name when seeding onboarding workspace name', () => {
    expect(
      getOnboardingWorkspaceSeed({
        currentOrgName: 'Acme Growth Agency',
        accountType: 'FREELANCER',
        workspaceName: '',
        userName: 'Alice',
      }),
    ).toBe('Acme Growth Agency');
  });

  it('prefills freelancer workspace name from the user name when empty', () => {
    expect(
      getOnboardingWorkspaceSeed({
        currentOrgName: null,
        accountType: 'FREELANCER',
        workspaceName: '',
        userName: 'Alice Thornton',
      }),
    ).toBe('Alice Thornton');
  });

  it('keeps manual onboarding input for business accounts', () => {
    expect(
      getOnboardingWorkspaceSeed({
        currentOrgName: null,
        accountType: 'BUSINESS',
        workspaceName: 'Acme',
        userName: 'Alice Thornton',
      }),
    ).toBe('Acme');
  });
});
