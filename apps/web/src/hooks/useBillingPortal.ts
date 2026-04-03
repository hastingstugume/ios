'use client';

import { useState } from 'react';
import { billingApi } from '@/lib/api';

interface BillingPortalOptions {
  returnPath?: string;
}

export function useBillingPortal(currentOrgId?: string) {
  const [redirectingToPortal, setRedirectingToPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const startBillingPortal = async (options?: BillingPortalOptions) => {
    if (!currentOrgId) {
      setPortalError('Select a workspace before opening billing');
      return;
    }

    setPortalError(null);
    setRedirectingToPortal(true);

    try {
      const result = await billingApi.createPortalSession(currentOrgId, {
        returnPath: options?.returnPath || '/settings#plan-limits',
      });
      window.location.assign(result.portalUrl);
    } catch (error) {
      setPortalError((error as Error)?.message || 'Could not open billing portal');
      setRedirectingToPortal(false);
    }
  };

  return {
    redirectingToPortal,
    portalError,
    startBillingPortal,
    clearPortalError: () => setPortalError(null),
  };
}
