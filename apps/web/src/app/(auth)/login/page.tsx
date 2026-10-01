'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { ArrowRight, Building2 } from 'lucide-react';
import { CompanyAuthShell } from '@/components/auth/auth-shells';
import { FormHeading, LoginForm } from '@/components/auth/auth-forms';
import { useWorkspaceSlug, workspaceHref } from '@/components/auth/company-auth-page';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/feedback';
import {
  normalizeSlug,
  rememberedWorkspace,
  rememberWorkspace,
  safeNext,
  useAuthHydrated,
  useWorkspace,
  withNext,
  workspaceName,
} from '@/lib/auth/portal';
import { useAuthStore } from '@/store/useAuthStore';

// ============================================================
// Company sign-in: /login?company=<slug>
// 1. Find your workspace (skipped when the link or this browser knows it)
// 2. Sign in, in the company's own theme. The API only admits members
//    of that company — Super Admins use /platform/login.
// ============================================================

function WorkspaceFinder({
  initial,
  error,
  checking,
  onSubmit,
}: {
  initial: string;
  error: string | null;
  checking: boolean;
  onSubmit: (slug: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = normalizeSlug(value);
    if (!slug) {
      setInvalid('Use lowercase letters, numbers and hyphens, e.g. acme-corp');
      return;
    }
    setInvalid(null);
    onSubmit(slug);
  };

  return (
    <>
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Building2 className="h-5 w-5" />
      </div>
      <FormHeading
        title="Find your workspace"
        description="Enter your company's workspace name. You'll find it in your welcome email."
      />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Workspace" htmlFor="workspace" error={invalid ?? error ?? undefined}>
          <Input
            id="workspace"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="acme"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            invalid={Boolean(invalid ?? error)}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={checking}>
          Continue <ArrowRight />
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Don&apos;t know your workspace? Ask your HR or company administrator.
      </p>
    </>
  );
}

function CompanyLogin() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const hydrated = useAuthHydrated();
  const { isAuthenticated, user } = useAuthStore();
  const { slug: initialSlug, ready } = useWorkspaceSlug();

  /** undefined = use the link / remembered workspace; null = pick a new one */
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const slug = chosen === undefined ? initialSlug : chosen;
  const workspace = useWorkspace(slug);

  // Already signed in → into the right portal
  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) return;
    router.replace(user.isSuperAdmin ? '/super-admin' : '/app');
  }, [hydrated, isAuthenticated, user, router]);

  // A remembered workspace that no longer exists is forgotten
  useEffect(() => {
    if (workspace.isError && slug && slug === rememberedWorkspace()) rememberWorkspace(null);
  }, [workspace.isError, slug]);

  const go = (target: string | null) => {
    setChosen(target);
    const path = target ? `/login?company=${target}` : '/login';
    router.replace(next ? withNext(path, next) : path);
  };

  const lookupError = workspace.isError
    ? isAxiosError(workspace.error) && workspace.error.response?.status === 404
      ? `We couldn't find an active workspace called “${slug}”.`
      : "Couldn't check that workspace. Please try again."
    : null;

  let body: React.ReactNode;
  if (!ready || (slug && workspace.isLoading)) {
    body = (
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="mt-6 h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  } else if (!slug || !workspace.data) {
    body = (
      <WorkspaceFinder
        key={slug ?? ''}
        initial={slug ?? ''}
        error={lookupError}
        checking={workspace.isFetching}
        onSubmit={go}
      />
    );
  } else {
    const name = workspaceName(workspace.data);
    const href = workspaceHref(slug);
    body = (
      <>
        <FormHeading title="Sign in" description={<>to <span className="font-medium text-foreground">{name}</span></>} />
        <LoginForm
          portal="company"
          companySlug={slug}
          forgotHref={href('/forgot-password')}
          onSuccess={(u) => {
            toast.success(`Welcome back, ${u.firstName}`);
            const target = safeNext(next, '/app');
            router.replace(target.startsWith('/app') ? target : '/app');
          }}
        />
        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          Not part of {name}?{' '}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => {
              rememberWorkspace(null);
              go(null);
            }}
          >
            Switch workspace
          </button>
        </p>
      </>
    );
  }

  return <CompanyAuthShell workspace={workspace.data}>{body}</CompanyAuthShell>;
}

export default function LoginPage() {
  return (
    <Suspense>
      <CompanyLogin />
    </Suspense>
  );
}
