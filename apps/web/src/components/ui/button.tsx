import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium',
    'transition-[color,background-color,border-color,box-shadow,transform] duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-card shadow-inner-highlight hover:bg-primary/90',
        secondary:
          'border border-input bg-surface text-foreground shadow-card hover:bg-subtle',
        soft: 'bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/70',
        ghost: 'text-muted-foreground hover:bg-subtle hover:text-foreground',
        danger:
          'bg-destructive text-destructive-foreground shadow-card shadow-inner-highlight hover:bg-destructive/90',
        success: 'bg-success text-white shadow-card shadow-inner-highlight hover:bg-success/90',
        link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs [&_svg]:size-3.5',
        md: 'h-9 px-4 text-sm [&_svg]:size-4',
        lg: 'h-10 px-5 text-sm [&_svg]:size-4',
        icon: 'h-9 w-9 [&_svg]:size-4',
        'icon-sm': 'h-8 w-8 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  icon?: React.ReactNode;
  /** Render as the child element (e.g. a Next <Link>) */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, icon, asChild, className, children, disabled, type = 'button', ...props },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={classes} {...props}>
      {loading ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </button>
  );
});
