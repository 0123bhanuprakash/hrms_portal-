'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ChangePasswordSchema,
  ForgotPasswordSchema,
  LoginSchema,
  ResetPasswordSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
} from '@hrms/types';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, MailCheck, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/errors';
import { clearPendingTemporaryPassword, getPendingTemporaryPassword, signIn, type Portal } from '@/lib/auth/portal';
import { useAuthStore, type AuthUser } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { cn } from '@/lib/cn';

// ============================================================
// Auth forms shared by both portals. They only use theme tokens,
// so they pick up the platform look or the company's theme from
// whichever shell they're rendered in.
// ============================================================

export function FormHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-6 space-y-1.5">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive animate-in fade-in-0">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// forwardRef: react-hook-form's register() reads the value through the ref
const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<typeof Input>>(function PasswordInput(
  props,
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-9', props.className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

function StatusPanel({
  tone,
  title,
  children,
  action,
}: {
  tone: 'success' | 'error' | 'info';
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? XCircle : MailCheck;
  return (
    <div className="space-y-4 text-center animate-in fade-in-0">
      <div
        className={cn(
          'mx-auto flex h-12 w-12 items-center justify-center rounded-full',
          tone === 'success' && 'bg-success/10 text-success',
          tone === 'error' && 'bg-destructive/10 text-destructive',
          tone === 'info' && 'bg-primary/10 text-primary',
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function BackLink({ href, children = 'Back to sign in' }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}

// ─── Sign in ────────────────────────────────────────────────

export function LoginForm({
  portal,
  companySlug,
  forgotHref,
  onSuccess,
  emailPlaceholder = 'you@company.com',
}: {
  portal: Portal;
  companySlug?: string | null;
  forgotHref: string;
  onSuccess: (user: AuthUser) => void;
  emailPlaceholder?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginInput) => {
    setError(null);
    try {
      const user = await signIn({ ...data, portal, companySlug });
      onSuccess(user);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid email or password.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormError message={error} />
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          placeholder={emailPlaceholder}
          invalid={Boolean(errors.email)}
          {...register('email')}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={errors.password?.message}
        aside={
          <Link href={forgotHref} className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        }
      >
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          invalid={Boolean(errors.password)}
          {...register('password')}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}

// ─── Forgot password ────────────────────────────────────────

export function ForgotPasswordForm({ loginHref }: { loginHref: string }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setError(null);
    try {
      await api.post('/auth/forgot-password', data);
      setSentTo(data.email);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send the reset link. Please try again.'));
    }
  };

  if (sentTo) {
    return (
      <StatusPanel tone="info" title="Check your email" action={<BackLink href={loginHref} />}>
        If an account exists for <strong className="font-medium text-foreground">{sentTo}</strong>, a reset link is on its
        way. It expires in 15 minutes.
      </StatusPanel>
    );
  }

  return (
    <>
      <FormHeading title="Reset your password" description="Enter your work email and we'll send you a reset link." />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus invalid={Boolean(errors.email)} {...register('email')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Send reset link
        </Button>
      </form>
      <div className="mt-6 text-center">
        <BackLink href={loginHref} />
      </div>
    </>
  );
}

// ─── Reset password ─────────────────────────────────────────

export function ResetPasswordForm({ token, loginHref, forgotHref }: { token: string; loginHref: string; forgotHref: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <StatusPanel
        tone="error"
        title="Invalid reset link"
        action={
          <Button asChild>
            <Link href={forgotHref}>Request a new link</Link>
          </Button>
        }
      >
        This link is incomplete or has already been used.
      </StatusPanel>
    );
  }

  if (done) {
    return (
      <StatusPanel
        tone="success"
        title="Password updated"
        action={
          <Button asChild className="w-full" size="lg">
            <Link href={loginHref}>Sign in</Link>
          </Button>
        }
      >
        You can now sign in with your new password. Other devices have been signed out.
      </StatusPanel>
    );
  }

  const onSubmit = async (data: ResetPasswordInput) => {
    setError(null);
    try {
      // confirmPassword is checked here only; the API accepts { token, password }
      await api.post('/auth/reset-password', { token, password: data.password });
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not reset your password. The link may have expired.'));
    }
  };

  return (
    <>
      <FormHeading title="Choose a new password" description="At least 8 characters, with upper and lower case letters, a number and a symbol." />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="New password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" autoFocus invalid={Boolean(errors.password)} {...register('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Update password
        </Button>
      </form>
      <div className="mt-6 text-center">
        <BackLink href={loginHref} />
      </div>
    </>
  );
}

// ─── Verify email ───────────────────────────────────────────

export function VerifyEmailStatus({ token, loginHref }: { token: string; loginHref: string }) {
  const [state, setState] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This verification link is incomplete.');
  const started = useRef(false);

  useEffect(() => {
    // Tokens are single-use: never post twice (React strict mode runs effects twice)
    if (!token || started.current) return;
    started.current = true;
    api
      .post('/auth/verify-email', { token })
      .then(() => setState('success'))
      .catch((err) => {
        setMessage(getApiErrorMessage(err, 'This verification link is invalid or has expired.'));
        setState('error');
      });
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="space-y-3 py-6 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verifying your email…</p>
      </div>
    );
  }

  const signInButton = (
    <Button asChild className="w-full" size="lg" variant={state === 'success' ? 'primary' : 'secondary'}>
      <Link href={loginHref}>Go to sign in</Link>
    </Button>
  );

  return state === 'success' ? (
    <StatusPanel tone="success" title="Email verified" action={signInButton}>
      Thanks — your email address is confirmed.
    </StatusPanel>
  ) : (
    <StatusPanel tone="error" title="Verification failed" action={signInButton}>
      {message}
    </StatusPanel>
  );
}

// ─── Choose a new password (after signing in with a temporary one) ──

export function ChangeTemporaryPasswordForm({ onDone, onSignOut }: { onDone: () => void; onSignOut: () => void }) {
  // The temporary password just typed on the sign-in page, if still in memory
  const [known] = useState(() => getPendingTemporaryPassword());
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const setAuthUser = useAuthStore.setState;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { currentPassword: known ?? '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ChangePasswordInput) => {
    setError(null);
    try {
      await api.post('/auth/change-password', { current_password: data.currentPassword, new_password: data.newPassword });
      clearPendingTemporaryPassword();
      if (user) setAuthUser({ user: { ...user, mustChangePassword: false } });
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update your password. Please try again.'));
    }
  };

  return (
    <>
      <FormHeading
        title="Choose your own password"
        description={
          <>
            {user ? <>Welcome, <span className="font-medium text-foreground">{user.firstName}</span>. </> : null}
            You signed in with a temporary password. Set a new one to continue.
          </>
        }
      />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormError message={error} />
        {!known && (
          <Field label="Temporary password" htmlFor="currentPassword" error={errors.currentPassword?.message} hint="The one from your welcome email.">
            <PasswordInput id="currentPassword" autoComplete="current-password" autoFocus invalid={Boolean(errors.currentPassword)} {...register('currentPassword')} />
          </Field>
        )}
        <Field
          label="New password"
          htmlFor="newPassword"
          error={errors.newPassword?.message}
          hint="At least 8 characters, with upper and lower case letters, a number and a symbol."
        >
          <PasswordInput id="newPassword" autoComplete="new-password" autoFocus={Boolean(known)} invalid={Boolean(errors.newPassword)} {...register('newPassword')} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <PasswordInput id="confirmPassword" autoComplete="new-password" invalid={Boolean(errors.confirmPassword)} {...register('confirmPassword')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Save and continue
        </Button>
      </form>
      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        Not now?{' '}
        <button type="button" onClick={onSignOut} className="font-medium text-primary hover:underline">
          Sign out
        </button>
      </p>
    </>
  );
}
