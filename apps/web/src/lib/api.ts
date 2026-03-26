const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${res.status}`);
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
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; name: string; organizationName?: string; invitationToken?: string }) =>
    api.post('/auth/register', data),
  logout: () => api.post('/auth/logout', {}),
  me: () => api.get<{ user: User; memberships: Membership[] }>('/auth/me'),
  updateMe: (data: { name: string }) => api.patch<User>('/auth/me', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) => api.patch('/auth/password', data),
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
  update: (orgId: string, data: { name?: string; logoUrl?: string }) => api.patch<Organization>(`/orgs/${orgId}`, data),
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
export interface User { id: string; email: string; name: string | null; avatarUrl: string | null; }
export interface Membership { id: string; role: string; organization: Organization; joinedAt?: string; }
export interface Organization { id: string; name: string; slug: string; plan: string; }
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
  source?: { id: string; name: string; type: string };
  assignee?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> | null;
  keywords?: Array<{ keyword: Keyword }>;
  annotations?: Annotation[];
  _count?: { annotations: number };
}
export interface Keyword { id: string; phrase: string; description: string | null; isActive: boolean; _count?: { signalKeywords: number }; }
export interface Source { id: string; name: string; type: string; status: string; config: any; lastFetchedAt: string | null; errorMessage: string | null; _count?: { signals: number }; }
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
