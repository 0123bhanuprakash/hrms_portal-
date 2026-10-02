'use client';

import React from 'react';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { Card, CardHeader, Skeleton } from '@/components/ui/feedback';
import { usePreferences, useUpdatePreferences } from '@/lib/company/queries';
import { getApiErrorMessage } from '@/lib/errors';

/** Email notifications on/off (the in-app inbox always keeps a copy). Saves instantly. */
export function NotificationSettingsCard() {
  const prefs = usePreferences();
  const update = useUpdatePreferences();
  const on = prefs.data?.emailNotifications ?? true;

  const toggle = async (value: boolean) => {
    try {
      await update.mutateAsync({ emailNotifications: value });
      toast.success(value ? 'Notification emails turned on' : 'Notification emails turned off');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };

  return (
    <Card>
      <CardHeader icon={<Mail />} title="Notifications" description="Leave and attendance requests, decisions and reminders." />
      <div className="px-5 pb-5">
        {prefs.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
              checked={on}
              disabled={update.isPending}
              onChange={(e) => void toggle(e.target.checked)}
            />
            <span>
              <span className="font-medium">Also send them to my email</span>
              <span className="block text-xs text-muted-foreground">Everything still appears under the bell in the portal.</span>
            </span>
          </label>
        )}
      </div>
    </Card>
  );
}
