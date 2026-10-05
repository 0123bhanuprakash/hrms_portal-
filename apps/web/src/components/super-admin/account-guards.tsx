'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { setReauthHandler } from '@/lib/api';
import { confirmPassword } from '@/lib/account';
import { getApiErrorMessage } from '@/lib/errors';

type Result = { token: string; expiresAt: string } | null;

/**
 * "Confirm your password" — opens when the API asks for it before a risky
 * change (Profile & security → Ask for my password again). The change then
 * goes through by itself; the confirmation lasts 5 minutes.
 */
export function ReauthDialog() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<((r: Result) => void) | null>(null);

  useEffect(() => {
    setReauthHandler(
      () =>
        new Promise<Result>((resolve) => {
          pending.current = resolve;
          setPassword('');
          setError(null);
          setOpen(true);
        }),
    );
    return () => setReauthHandler(null);
  }, []);

  const finish = (r: Result) => {
    pending.current?.(r);
    pending.current = null;
    setOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      finish(await confirmPassword(password));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Password is incorrect'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => finish(null)}
      busy={busy}
      icon={<ShieldCheck />}
      title="Confirm it’s you"
      description="This change affects companies on the platform. Enter your password to continue — you won’t be asked again for 5 minutes."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Password" htmlFor="reauth-password" error={error ?? undefined}>
          <Input id="reauth-password" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} invalid={Boolean(error)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => finish(null)} disabled={busy}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!password}>Confirm</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Signs out after `minutes` without mouse, keyboard or touch (any open tab counts). */
export function useIdleSignOut(minutes: number | null | undefined, onSignOut: () => void) {
  const signOut = useRef(onSignOut);
  signOut.current = onSignOut;
  useEffect(() => {
    if (!minutes) return;
    const KEY = 'sa-last-activity';
    const limit = minutes * 60_000;
    let last = Date.now();
    const touch = () => {
      const now = Date.now();
      // Throttled: one write every 10 s is plenty
      if (now - last < 10_000) return;
      last = now;
      try {
        localStorage.setItem(KEY, String(now));
      } catch {
        /* storage unavailable */
      }
    };
    try {
      localStorage.setItem(KEY, String(last));
    } catch {
      /* storage unavailable */
    }
    const events = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(() => {
      let latest = last;
      try {
        latest = Math.max(last, Number(localStorage.getItem(KEY)) || 0);
      } catch {
        /* storage unavailable */
      }
      if (Date.now() - latest > limit) signOut.current();
    }, 15_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer);
    };
  }, [minutes]);
}
