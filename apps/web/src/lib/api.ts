const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export type OAuthProvider = 'google' | 'microsoft' | 'github';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(res.status, error.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Typed API helpers
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ success?: true; expiresAt?: string; authState: { emailVerified: boolean; onboardingCompleted: boolean }; mfaRequired?: boolean; challengeToken?: string }>(
      '/auth/login',
      { email, password },
    ),
  register: (data: { email: string; password: string; name: string; invitationToken?: string }) =>
    api.post('/auth/register', data),
  verifyEmail: (token: string) => api.post('/auth/verify-email', { token }),
  resendVerification: (email: string) => api.post('/auth/resend-verification', { email }),
  requestPasswordReset: (email: string) => api.post('/auth/request-password-reset', { email }),
  resetPassword: (data: { token: string; newPassword: string }) => api.post('/auth/reset-password', data),
  verifyMfaLogin: (data: { challengeToken: string; code: string }) => api.post<{ success: true; expiresAt: string; authState: { emailVerified: boolean; onboardingCompleted: boolean } }>('/auth/mfa/verify', data),
  completeOnboarding: (data: { accountType: 'FREELANCER' | 'BUSINESS'; workspaceName: string }) => api.post('/auth/onboarding', data),
  logout: () => api.post('/auth/logout', {}),
  me: () => api.get<{ user: User; memberships: Membership[]; authState: { emailVerified: boolean; onboardingCompleted: boolean } }>('/auth/me'),
  updateMe: (data: { name: string }) => api.patch<User>('/auth/me', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) => api.patch('/auth/password', data),
  setupMfa: () => api.post<{ secret: string; otpauthUri: string; issuer: string }>('/auth/mfa/setup', {}),
  enableMfa: (data: { code: string }) => api.post<{ success: true; backupCodes: string[] }>('/auth/mfa/enable', data),
  disableMfa: (data: { code: string }) => api.post<{ success: true }>('/auth/mfa/disable', data),
  sessions: () => api.get<{ sessions: AuthSession[] }>('/auth/sessions'),
  revokeSession: (sessionId: string) => api.post<{ success: true }>(`/auth/sessions/${sessionId}/revoke`, {}),
  revokeOtherSessions: () => api.post<{ success: true }>('/auth/sessions/revoke-others', {}),
  getOAuthStartUrl: (provider: OAuthProvider, invitationToken?: string) => {
    const params = new URLSearchParams();
    if (invitationToken) params.set('invitationToken', invitationToken);
    return `${API_BASE}/api/v1/auth/oauth/${provider}/start${params.toString() ? `?${params.toString()}` : ''}`;
  },
};

export const signalsApi = {
  list: (orgId: string, params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();
    return api.get<PaginatedResponse<Signal>>(`/orgs/${orgId}/signals${qs ? `?${qs}` : ''}`);
  },
  get: (orgId: string, id: string) => api.get<Signal>(`/orgs/${orgId}/signals/${id}`),
  updateStatus: (orgId: string, id: string, status: string) => api.patch(`/orgs/${orgId}/signals/${id}/status`, { status }),
  updateWorkflow: (orgId: string, id: string, data: { stage?: string; assigneeId?: string | null; nextStep?: string | null }) =>
    api.patch<Signal>(`/orgs/${orgId}/signals/${id}/workflow`, data),
  addAnnotation: (orgId: string, id: string, note: string) => api.post(`/orgs/${orgId}/signals/${id}/annotations`, { note }),
  stats: (orgId: string) => api.get<any>(`/orgs/${orgId}/signals/stats`),
};

export const dashboardApi = {
  summary: (orgId: string) => api.get<any>(`/orgs/${orgId}/dashboard/summary`),
};

export const keywordsApi = {
  list: (orgId: string) => api.get<Keyword[]>(`/orgs/${orgId}/keywords`),
  create: (orgId: string, data: { phrase: string; description?: string }) => api.post(`/orgs/${orgId}/keywords`, data),
  update: (orgId: string, id: string, data: any) => api.patch(`/orgs/${orgId}/keywords/${id}`, data),
  delete: (orgId: string, id: string) => api.delete(`/orgs/${orgId}/keywords/${id}`),
};

export const sourcesApi = {
  list: (orgId: string) => api.get<Source[]>(`/orgs/${orgId}/sources`),
  suggestions: (orgId: string) => api.get<{ source: 'cache' | 'similar-cache' | 'generated'; suggestions: SourceTemplateSuggestion[] }>(`/orgs/${orgId}/sources/suggestions`),
  templates: (orgId: string) => api.get<{ templates: SourceTemplateSuggestion[] }>(`/orgs/${orgId}/sources/templates`),
  createTemplate: (
    orgId: string,
    data: {
      name: string;
      description?: string;
      audience?: string;
      sourceIds: string[];
      includeKeywords?: boolean;
      includeNegativeKeywords?: boolean;
    },
  ) => api.post<SourceTemplateSuggestion>(`/orgs/${orgId}/sources/templates`, data),
  preview: (orgId: string, data: { type: string; config: any }) => api.post<SourcePreview>(`/orgs/${orgId}/sources/preview`, data),
  create: (orgId: string, data: any) => api.post(`/orgs/${orgId}/sources`, data),
  update: (orgId: string, id: string, data: any) => api.patch(`/orgs/${orgId}/sources/${id}`, data),
  delete: (orgId: string, id: string) => api.delete(`/orgs/${orgId}/sources/${id}`),
};

export const alertsApi = {
  list: (orgId: string) => api.get<AlertRule[]>(`/orgs/${orgId}/alerts`),
  create: (orgId: string, data: any) => api.post(`/orgs/${orgId}/alerts`, data),
  update: (orgId: string, id: string, data: any) => api.patch(`/orgs/${orgId}/alerts/${id}`, data),
  delete: (orgId: string, id: string) => api.delete(`/orgs/${orgId}/alerts/${id}`),
};

export const organizationsApi = {
  get: (orgId: string) => api.get<OrganizationDetail>(`/orgs/${orgId}`),
  update: (orgId: string, data: { name?: string; logoUrl?: string; businessFocus?: string; targetAudience?: string; negativeKeywords?: string[] }) => api.patch<Organization>(`/orgs/${orgId}`, data),
  members: (orgId: string) => api.get<{ members: OrganizationMember[]; invitations: Invitation[] }>(`/orgs/${orgId}/members`),
  inviteMember: (orgId: string, data: { email: string; role: string }) => api.post(`/orgs/${orgId}/members`, data),
  updateMember: (orgId: string, memberId: string, data: { role: string }) => api.patch(`/orgs/${orgId}/members/${memberId}`, data),
  removeMember: (orgId: string, memberId: string) => api.delete(`/orgs/${orgId}/members/${memberId}`),
  auditLog: (orgId: string, page = 1, limit = 20) =>
    api.get<PaginatedResponse<AuditLog>>(`/orgs/${orgId}/audit-log?page=${page}&limit=${limit}`),
};

export const publicApi = {
  landing: () => api.get<LandingData>('/public/landing'),
};

// Types
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified?: boolean;
  accountType?: 'FREELANCER' | 'BUSINESS' | null;
  onboardingCompletedAt?: string | null;
  mfaEnabled?: boolean;
  hasPassword?: boolean;
  authProviders?: Array<'google' | 'microsoft' | 'github'>;
}
export interface Membership { id: string; role: string; organization: Organization; joinedAt?: string; }
export interface AuthSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}
export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  businessFocus?: string | null;
  targetAudience?: string | null;
  negativeKeywords?: string[];
}
export interface OrganizationMember {
  id: string;
  role: string;
  joinedAt: string;
  userId: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> & { createdAt?: string };
}
export interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}
export interface OrganizationDetail extends Organization {
  logoUrl?: string | null;
  members: OrganizationMember[];
}
export interface Signal {
  id: string; organizationId: string; sourceId: string; externalId: string;
  sourceUrl: string; authorHandle: string | null; originalTitle: string | null;
  originalText: string; normalizedText: string | null; publishedAt: string | null;
  fetchedAt: string; category: string | null; confidenceScore: number | null;
  whyItMatters: string | null; suggestedOutreach: string | null; status: string;
  stage: string; assigneeId?: string | null; nextStep?: string | null; closedAt?: string | null;
  priorityScore?: number | null;
  rankingReasons?: string[];
  freshnessLabel?: string;
  postedAgo?: string;
  sourceLabel?: string;
  linkedDomain?: string | null;
  accountHint?: string | null;
  toolHints?: string[];
  painPoint?: string | null;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sentiment?: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' | 'MIXED';
  conversationType?: 'BUYER_REQUEST' | 'RECOMMENDATION' | 'PAIN_REPORT' | 'HIRING' | 'PARTNERSHIP' | 'TREND' | 'OTHER';
  suggestedReply?: string | null;
  sourceProfile?: {
    platformLabel: string;
    providerLabel: string;
    acquisitionMode: string;
    supportStatus: string;
    badgeLabel: string;
    complianceNotes: string;
  } | null;
  source?: { id: string; name: string; type: string };
  assignee?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> | null;
  keywords?: Array<{ keyword: Keyword }>;
  annotations?: Annotation[];
  _count?: { annotations: number };
}
export interface Keyword { id: string; phrase: string; description: string | null; isActive: boolean; _count?: { signalKeywords: number }; }
export interface Source {
  id: string;
  name: string;
  type: string;
  status: string;
  config: any;
  lastFetchedAt: string | null;
  errorMessage: string | null;
  sourceProfile?: {
    platformLabel: string;
    providerLabel: string;
    acquisitionMode: string;
    supportStatus: string;
    badgeLabel: string;
    complianceNotes: string;
  };
  _count?: { signals: number };
  health?: {
    score: number;
    label: string;
    last7dSignals: number;
    highConfidenceSignals: number;
    pipelineSignals: number;
    savedSignals: number;
  };
}
export interface SourceTemplateSuggestion {
  id: string;
  name: string;
  audience: string;
  description: string;
  recommendedKeywords: string[];
  recommendedNegativeKeywords: string[];
  generatedBy?: string | null;
  rank: number;
  createdAt: string;
  updatedAt: string;
  sources: Array<{
    name: string;
    type: string;
    config: Record<string, any>;
  }>;
}
export interface SourcePreview {
  totalFetched: number;
  matchingCount: number;
  previewItems: Array<{
    externalId: string;
    title: string;
    text: string;
    url: string;
    author: string | null;
    publishedAt: string | null;
    matchedKeywords: string[];
    excludedByWorkspace: boolean;
    excludedBySource: boolean;
    excludedByLowSignal: boolean;
    passesFilters: boolean;
    category: string | null;
    confidenceScore: number | null;
    painPoint: string | null;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
    sentiment: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' | 'MIXED' | null;
    conversationType: 'BUYER_REQUEST' | 'RECOMMENDATION' | 'PAIN_REPORT' | 'HIRING' | 'PARTNERSHIP' | 'TREND' | 'OTHER' | null;
    whyItMatters: string | null;
    suggestedReply: string | null;
    suggestedOutreach: string | null;
    sourceProfile: {
      platformLabel: string;
      providerLabel: string;
      acquisitionMode: string;
      supportStatus: string;
      badgeLabel: string;
      complianceNotes: string;
    };
  }>;
}
export interface AlertRule { id: string; name: string; isActive: boolean; minConfidence: number; categories: string[]; keywordIds: string[]; frequency: string; emailRecipients: string[]; lastTriggeredAt: string | null; }
export interface Annotation { id: string; note: string; createdAt: string; user: Pick<User, 'id' | 'name' | 'avatarUrl'>; }
export interface PaginatedResponse<T> { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number; }; }
export interface AuditLog {
  id: string;
  action: string;
  createdAt: string;
  metadata?: Record<string, any> | null;
  user?: Pick<User, 'id' | 'name' | 'email'> | null;
}
export interface LandingData {
  stats: {
    activeSources: number;
    trackedKeywords: number;
    highConfidenceSignals: number;
    activeAlerts: number;
  };
  signals: Array<{
    id: string;
    score: number;
    category: string;
    source: string;
    title: string;
    status: string;
  }>;
}
