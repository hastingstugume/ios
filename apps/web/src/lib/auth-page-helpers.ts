export function getRegisterPageCopy(invitationToken?: string) {
  if (invitationToken) {
    return {
      eyebrow: 'Accept Invitation',
      title: 'Join your workspace',
      description: 'Finish setup and we’ll connect you to the invited workspace.',
      submitLabel: 'Join workspace',
      showInvitationNotice: true,
    };
  }

  return {
    eyebrow: 'Create Account',
    title: 'Create your account',
    description: 'Create your account first. Workspace setup comes next.',
    submitLabel: 'Continue',
    showInvitationNotice: false,
  };
}

export function getVerifyEmailMode(token?: string | null) {
  return token?.trim() ? 'verify' : 'resend';
}

export function getOnboardingWorkspaceSeed(params: {
  currentOrgName?: string | null;
  accountType: 'FREELANCER' | 'BUSINESS';
  workspaceName: string;
  userName?: string | null;
}) {
  if (params.currentOrgName?.trim()) {
    return params.currentOrgName.trim();
  }

  if (params.accountType !== 'FREELANCER') {
    return params.workspaceName;
  }

  if (params.workspaceName.trim()) {
    return params.workspaceName;
  }

  return params.userName?.trim() || '';
}
