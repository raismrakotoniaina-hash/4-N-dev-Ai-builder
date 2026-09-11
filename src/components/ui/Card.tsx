import type { HTMLAttributes, ReactNode } from "react";

export type CardVariant = "default" | "glass" | "outlined" | "elevated";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
}

export function Card({
  children,
  variant = "default",
  padding = "md",
  className = "",
  ...props
}: CardProps) {
  const classes = [
    "ui-card",
    `ui-card--${variant}`,
    `ui-card--padding-${padding}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export default Card;
