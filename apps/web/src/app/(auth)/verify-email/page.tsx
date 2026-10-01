'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/errors';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorMsg('No verification token provided in URL.');
      return;
    }

    const verify = async () => {
      try {
        await api.post('/auth/verify-email', { token });
        setSuccess(true);
      } catch (err: any) {
        setErrorMsg(
          getApiErrorMessage(err, 'Verification link is invalid or expired.'),
        );
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  if (loading) {
    return (
      <div className="text-center py-6 space-y-4">
        <Loader2 className="mx-auto h-8 w-8 text-indigo-600 animate-spin" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Verifying your email...
        </h2>
        <p className="text-xs text-slate-500">Please wait a moment.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Email Verified!
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Your email address has been verified successfully. You can now access your HRMS portal account.
        </p>
        <div className="pt-2">
          <Link
            href="/login"
            className="inline-block py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-md"
          >
            Sign In Now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="mx-auto w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
        <XCircle className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
        Verification Failed
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">{errorMsg}</p>
      <div className="pt-2">
        <Link
          href="/login"
          className="inline-block py-2 px-4 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
        >
          Return to Login
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
