'use client';

import React, { useRef } from 'react';
import { toast } from 'sonner';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useRemoveAvatar, useUploadAvatar } from '@/lib/company/profile';
import { getApiErrorMessage } from '@/lib/errors';

const MAX_BYTES = 2 * 1024 * 1024;

/** Large avatar with a camera button to upload / remove the photo. */
export function AvatarEditor({
  employeeId,
  person,
  canEdit,
  avatarClassName,
}: {
  employeeId: string;
  person: { firstName: string; lastName: string; avatarUrl: string | null };
  canEdit: boolean;
  /** Size / shape override for the photo */
  avatarClassName?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadAvatar(employeeId);
  const remove = useRemoveAvatar(employeeId);
  const busy = upload.isPending || remove.isPending;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Choose a JPG, PNG or WebP image');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Photo must be 2 MB or smaller');
      return;
    }
    try {
      await upload.mutateAsync(file);
      toast.success('Photo updated');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not upload the photo'));
    }
  };

  const onRemove = async () => {
    try {
      await remove.mutateAsync();
      toast.success('Photo removed');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not remove the photo'));
    }
  };

  const button = (
    <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-card transition-colors hover:bg-subtle">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
    </span>
  );

  return (
    <div className="relative shrink-0">
      <PersonAvatar person={person} size="xl" className={avatarClassName} />
      {canEdit && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {person.avatarUrl ? (
            <DropdownMenu
              label="Change photo"
              align="left"
              trigger={() => (
                <button type="button" aria-label="Change photo" disabled={busy}>
                  {button}
                </button>
              )}
              items={[
                { label: 'Upload new photo', icon: <Camera />, onSelect: () => input.current?.click() },
                { label: 'Remove photo', icon: <Trash2 />, danger: true, onSelect: () => void onRemove() },
              ]}
            />
          ) : (
            <button type="button" aria-label="Upload photo" disabled={busy} onClick={() => input.current?.click()}>
              {button}
            </button>
          )}
        </>
      )}
    </div>
  );
}
