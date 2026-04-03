'use client';

import { useState } from 'react';
import { billingApi } from '@/lib/api';
import { WorkspacePlan } from '@/lib/plans';

interface CheckoutOptions {
  successPath?: string;
  cancelPath?: string;
}

export function useUpgradeCheckout(currentOrgId?: string) {
  const [redirectingPlan, setRedirectingPlan] = useState<WorkspacePlan | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const startUpgradeCheckout = async (targetPlan: WorkspacePlan, options?: CheckoutOptions) => {
    if (!currentOrgId) {
      setCheckoutError('Select a workspace before starting checkout');
      return;
    }

    if (targetPlan === 'free') {
      setCheckoutError('Free plan does not require checkout');
      return;
    }

    setCheckoutError(null);
    setRedirectingPlan(targetPlan);

    try {
      const result = await billingApi.createCheckoutSession(currentOrgId, {
        targetPlan,
        successPath: options?.successPath || '/pricing?checkout=success',
        cancelPath: options?.cancelPath || '/pricing?checkout=cancelled',
      });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setCheckoutError((error as Error)?.message || 'Could not start checkout');
      setRedirectingPlan(null);
    }
  };

  return {
    redirectingPlan,
    checkoutError,
    startUpgradeCheckout,
    clearCheckoutError: () => setCheckoutError(null),
  };
}
