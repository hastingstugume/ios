'use client';

import { authApi, type OAuthProvider } from '@/lib/api';
import { Github, Laptop } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.6 14.5 2.7 12 2.7 6.9 2.7 2.8 6.9 2.8 12s4.1 9.3 9.2 9.3c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1.1-.2-1.5H12Z"
      />
      <path
        fill="#34A853"
        d="M2.8 7.3l3.2 2.3C6.9 7.8 9.2 6 12 6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.6 14.5 2.7 12 2.7 8.5 2.7 5.4 4.7 3.9 7.7l-1.1-.4Z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.3c2.4 0 4.5-.8 6-2.3l-2.8-2.2c-.8.6-1.9 1.1-3.2 1.1-3.8 0-5.1-2.6-5.4-3.8l-3.1 2.4c1.5 2.9 4.5 4.8 8.5 4.8Z"
      />
      <path
        fill="#4285F4"
        d="M3.4 16.5l3.1-2.4c-.2-.6-.3-1.3-.3-2.1s.1-1.4.3-2.1L3.4 7.5C2.9 8.8 2.8 10 2.8 12c0 1.8.3 3 .6 4.5Z"
      />
    </svg>
  );
}

const PROVIDERS: Array<{
  id: OAuthProvider;
  label: string;
  icon: typeof Github | typeof Laptop | typeof GoogleIcon;
}> = [
  { id: 'google', label: 'Google', icon: GoogleIcon },
  { id: 'microsoft', label: 'Microsoft', icon: Laptop },
  { id: 'github', label: 'GitHub', icon: Github },
];

export function OAuthButtons({ invitationToken }: { invitationToken?: string }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Continue with
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
      {PROVIDERS.map((provider) => {
        const Icon = provider.icon;
        return (
          <button
            key={provider.id}
            type="button"
            onClick={() => {
              window.location.href = authApi.getOAuthStartUrl(provider.id, invitationToken);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Icon className="h-4 w-4" />
            {provider.label}
          </button>
        );
      })}
      </div>
    </div>
  );
}
