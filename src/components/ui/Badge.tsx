import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'primary' | 'cyan' | 'success' | 'warning';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  pulse?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  pulse = false,
  className = '',
}: BadgeProps) {
  const classes = [
    'ui-badge',
    `ui-badge--${variant}`,
    pulse ? 'ui-badge--pulse' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {pulse && <span aria-hidden="true" className="ui-badge__dot" />}
      {children}
    </span>
  );
}
