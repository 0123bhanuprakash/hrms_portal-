'use client';

import React, { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export const inputClass = cn(
  'flex h-9 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground shadow-card transition-[border-color,box-shadow]',
  'placeholder:text-muted-foreground/70',
  'hover:border-foreground/20',
  'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20',
  'disabled:cursor-not-allowed disabled:opacity-60',
);

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  /** Optional element aligned right of the label (e.g. a counter or link) */
  aside?: React.ReactNode;
  children: React.ReactNode;
}

/** Label + control + hint/error, consistently spaced. */
export function Field({ label, htmlFor, error, hint, required, className, aside, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p role="alert" key={error} className="m-shake flex items-start gap-1 text-xs font-medium text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        inputClass,
        invalid && 'border-destructive hover:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20',
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputClass, 'h-auto min-h-[72px] resize-none py-2', className)} {...props} />;
  },
);

/** Hex color input paired with a native color picker. */
export function ColorInput({ value, onChange, id }: { value: string; onChange: (value: string) => void; id?: string }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="flex items-center gap-2">
      <label
        className="relative h-9 w-11 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input shadow-card"
        style={{ backgroundColor: valid ? value : 'transparent' }}
      >
        <span className="sr-only">Pick color</span>
        <input
          type="color"
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        maxLength={7}
        invalid={!valid}
        className="font-mono uppercase"
      />
    </div>
  );
}

/**
 * Form-level error (usually from the server). Shakes once and scrolls into
 * view so it is never missed at the top of a long form.
 */
export function FormError({ children, className }: { children?: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (children) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [children]);
  if (!children) return null;
  return (
    <div
      ref={ref}
      role="alert"
      key={typeof children === 'string' ? children : undefined}
      className={cn('m-shake flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive', className)}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}
