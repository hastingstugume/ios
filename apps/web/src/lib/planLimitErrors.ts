import { WorkspacePlan, getNextPlan } from '@/lib/plans';

export interface PlanLimitUpgradeHint {
  message: string;
  nextPlan: WorkspacePlan | null;
}

const PLAN_LIMIT_PATTERNS = [
  /plan allows up to/i,
  /upgrade to continue/i,
  /delete an existing/i,
  /upgrade to run sources on demand/i,
  /starter and above/i,
  /remove a pending invite or upgrade/i,
];

function getErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return null;
}

export function getPlanLimitUpgradeHint(error: unknown, currentPlan?: string | null): PlanLimitUpgradeHint | null {
  const message = getErrorMessage(error);
  if (!message) return null;

  const isPlanLimitMessage = PLAN_LIMIT_PATTERNS.some((pattern) => pattern.test(message));
  if (!isPlanLimitMessage) return null;

  return {
    message,
    nextPlan: getNextPlan(currentPlan),
  };
}
