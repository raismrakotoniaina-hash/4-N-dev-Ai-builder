import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  variant?: 'default' | 'glass' | 'highlight';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  ...props
}: CardProps) {
  const classes = [
    'ui-card',
    `ui-card--${variant}`,
    `ui-card--padding-${padding}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section {...props} className={classes}>
      {children}
    </section>
  );
}
