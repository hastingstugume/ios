'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { billingApi } from '@/lib/api';
import { WorkspacePlan } from '@/lib/plans';

interface CheckoutOptions {
  successPath?: string;
  cancelPath?: string;
  sourceContext?: string;
  experimentVariant?: string;
}

export function useUpgradeCheckout(currentOrgId?: string) {
  const pathname = usePathname();
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
      const sourceContext = options?.sourceContext || (pathname ? `page:${pathname}` : 'page:unknown');
      const experimentVariant = options?.experimentVariant || getUpgradeExperimentVariant();
      const result = await billingApi.createCheckoutSession(currentOrgId, {
        targetPlan,
        successPath: options?.successPath || '/pricing?checkout=success',
        cancelPath: options?.cancelPath || '/pricing?checkout=cancelled',
        sourceContext,
        experimentVariant,
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

function getUpgradeExperimentVariant() {
  if (typeof window === 'undefined') return 'control';
  const storageKey = 'ios_upgrade_cta_variant_v1';
  const existing = window.localStorage.getItem(storageKey);
  if (existing === 'a' || existing === 'b') return existing;
  const assigned = Math.random() < 0.5 ? 'a' : 'b';
  window.localStorage.setItem(storageKey, assigned);
  return assigned;
}
