'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, type User, type Membership } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export function useAuth() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    retry: false,
    staleTime: 60_000,
  });

  const qc = useQueryClient();
  const router = useRouter();
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('ios:selected-org-id');
    if (saved) setSelectedOrgIdState(saved);
  }, []);

  const memberships = data?.memberships || [];
  const currentMembership: Membership | undefined = useMemo(() => {
    if (!memberships.length) return undefined;
    return memberships.find((membership) => membership.organization.id === selectedOrgId) || memberships[0];
  }, [memberships, selectedOrgId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextOrgId = currentMembership?.organization?.id;
    if (!nextOrgId) return;
    window.localStorage.setItem('ios:selected-org-id', nextOrgId);
    if (selectedOrgId !== nextOrgId) setSelectedOrgIdState(nextOrgId);
  }, [currentMembership, selectedOrgId]);

  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      if (typeof window !== 'undefined') window.localStorage.removeItem('ios:selected-org-id');
      qc.clear();
      router.push('/login');
    },
  });

  return {
    user: data?.user as User | undefined,
    memberships,
    currentOrg: currentMembership?.organization,
    currentOrgId: currentMembership?.organization?.id,
    role: currentMembership?.role,
    setCurrentOrgId: setSelectedOrgIdState,
    isLoading,
    isAuthenticated: !!data?.user,
    logout: logout.mutate,
    error,
  };
}

export function useRequireAuth() {
  const router = useRouter();
  const auth = useAuth();

  if (!auth.isLoading && !auth.isAuthenticated) {
    router.push('/login');
  }

  return auth;
}
