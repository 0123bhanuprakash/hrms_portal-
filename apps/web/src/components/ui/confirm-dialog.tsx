'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Modal } from './modal';
import { Button } from './button';
import { Field, Input } from './field';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  /** Require typing this exact text before confirming (high-impact actions) */
  confirmPhrase?: string;
  children?: React.ReactNode;
}

/** Confirmation dialog; destructive variant can require a typed phrase. */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  isLoading = false,
  confirmPhrase,
  children,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (isOpen) setTyped('');
  }, [isOpen]);

  const blocked = Boolean(confirmPhrase) && typed.trim() !== confirmPhrase;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      busy={isLoading}
      title={title}
      description={description}
      icon={isDanger ? <AlertTriangle className="text-destructive" /> : <Info className="text-primary" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button variant={isDanger ? 'danger' : 'primary'} onClick={onConfirm} loading={isLoading} disabled={blocked}>
            {confirmText}
          </Button>
        </>
      }
    >
      {(children || confirmPhrase) && (
        <div className="space-y-4">
          {children}
          {confirmPhrase && (
            <Field
              label={`Type “${confirmPhrase}” to confirm`}
              htmlFor="confirm-phrase"
            >
              <Input
                id="confirm-phrase"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="font-mono"
              />
            </Field>
          )}
        </div>
      )}
    </Modal>
  );
}
