'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, type User, type Membership } from '@/lib/api';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    retry: false,
    staleTime: 60_000,
  });

  const qc = useQueryClient();
  const router = useRouter();

  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => { qc.clear(); router.push('/login'); },
  });

  const currentMembership: Membership | undefined = data?.memberships?.[0];

  return {
    user: data?.user as User | undefined,
    memberships: data?.memberships || [],
    currentOrg: currentMembership?.organization,
    currentOrgId: currentMembership?.organization?.id,
    role: currentMembership?.role,
    isLoading,
    isAuthenticated: !!data?.user,
    logout: logout.mutate,
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
