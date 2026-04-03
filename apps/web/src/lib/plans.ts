export type WorkspacePlan = 'free' | 'starter' | 'growth' | 'scale';

export interface WorkspacePlanDefinition {
  key: WorkspacePlan;
  label: string;
  price: string;
  priceNote: string;
  summary: string;
  featured?: boolean;
  maxSeats: number | null;
  maxSources: number | null;
  maxKeywords: number | null;
  maxAlerts: number | null;
  features: string[];
}

const PLAN_ALIASES: Record<string, WorkspacePlan> = {
  free: 'free',
  starter: 'starter',
  pro: 'growth',
  growth: 'growth',
  team: 'growth',
  scale: 'scale',
  enterprise: 'scale',
};

export const WORKSPACE_PLAN_ORDER: WorkspacePlan[] = ['free', 'starter', 'growth', 'scale'];

export const WORKSPACE_PLANS: WorkspacePlanDefinition[] = [
  {
    key: 'free',
    label: 'Free',
    price: '$0',
    priceNote: 'per workspace / month',
    summary: 'For solo validation and initial setup.',
    maxSeats: 1,
    maxSources: 1,
    maxKeywords: 10,
    maxAlerts: 1,
    features: ['1 source', '10 tracked keywords', '1 alert rule', 'Core feed and workflow'],
  },
  {
    key: 'starter',
    label: 'Starter',
    price: '$29',
    priceNote: 'per workspace / month',
    summary: 'For solo operators validating demand and testing source coverage.',
    maxSeats: 1,
    maxSources: 3,
    maxKeywords: 25,
    maxAlerts: 3,
    features: ['3 sources', '25 tracked keywords', '3 alert rules', 'Fetch now'],
  },
  {
    key: 'growth',
    label: 'Growth',
    price: '$99',
    priceNote: 'per workspace / month',
    summary: 'For teams running a repeatable demand-capture motion.',
    featured: true,
    maxSeats: 5,
    maxSources: 15,
    maxKeywords: null,
    maxAlerts: null,
    features: ['15 sources', 'Up to 5 seats', 'Unlimited keywords', 'Unlimited alerts'],
  },
  {
    key: 'scale',
    label: 'Scale',
    price: 'Custom',
    priceNote: 'for larger teams',
    summary: 'For larger teams needing broader coverage and tailored rollout.',
    maxSeats: null,
    maxSources: null,
    maxKeywords: null,
    maxAlerts: null,
    features: ['Unlimited sources', 'Unlimited seats', 'Priority onboarding', 'Dedicated support'],
  },
];

export const WORKSPACE_PLAN_MAP: Record<WorkspacePlan, WorkspacePlanDefinition> = WORKSPACE_PLANS.reduce(
  (acc, plan) => ({ ...acc, [plan.key]: plan }),
  {} as Record<WorkspacePlan, WorkspacePlanDefinition>,
);

export function normalizeWorkspacePlan(plan?: string | null): WorkspacePlan {
  if (!plan) return 'free';
  return PLAN_ALIASES[plan.trim().toLowerCase()] ?? 'free';
}

export function getPlanLabel(plan?: string | null): string {
  return WORKSPACE_PLAN_MAP[normalizeWorkspacePlan(plan)].label;
}

export function getNextPlan(plan?: string | null): WorkspacePlan | null {
  const normalized = normalizeWorkspacePlan(plan);
  const idx = WORKSPACE_PLAN_ORDER.indexOf(normalized);
  if (idx < 0 || idx === WORKSPACE_PLAN_ORDER.length - 1) return null;
  return WORKSPACE_PLAN_ORDER[idx + 1];
}
