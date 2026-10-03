'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CompanyAuthShell } from '@/components/auth/auth-shells';
import { normalizeSlug, rememberedWorkspace, useWorkspace } from '@/lib/auth/portal';

export interface CompanyAuthContext {
  slug: string | null;
  /** Keeps ?company= on links so every page stays branded */
  href: (path: string) => string;
}

/** Workspace from ?company=, else the one remembered on this browser. */
export function useWorkspaceSlug(): { slug: string | null; ready: boolean } {
  const fromUrl = normalizeSlug(useSearchParams().get('company'));
  const [remembered, setRemembered] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setRemembered(rememberedWorkspace());
    setReady(true);
  }, []);
  return { slug: fromUrl ?? remembered, ready };
}

export function workspaceHref(slug: string | null) {
  return (path: string) => (slug ? `${path}?company=${slug}` : path);
}

function Branded({ children }: { children: (ctx: CompanyAuthContext) => React.ReactNode }) {
  const { slug } = useWorkspaceSlug();
  const workspace = useWorkspace(slug);
  return (
    <CompanyAuthShell workspace={workspace.data}>
      {children({ slug: workspace.data ? slug : null, href: workspaceHref(workspace.data ? slug : null) })}
    </CompanyAuthShell>
  );
}

/** Forgot / reset / verify pages in the company's own look. */
export function CompanyAuthPage({ children }: { children: (ctx: CompanyAuthContext) => React.ReactNode }) {
  return (
    <Suspense>
      <Branded>{children}</Branded>
    </Suspense>
  );
}
