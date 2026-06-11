import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

import { cx } from "../cx";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

// Follows the brand's own usage (see quote email): navy surfaces carry white
// text; yellow is a highlight colour and always carries dark text.
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand-900 text-white hover:bg-brand-800 active:bg-brand-950",
  secondary: "bg-accent-300 text-brand-950 hover:bg-accent-200 active:bg-accent-400",
  outline:
    "border-2 border-brand-900 text-brand-900 hover:bg-brand-50 active:bg-brand-100",
  ghost: "text-brand-900 hover:bg-brand-50 active:bg-brand-100",
};

// min-h keeps touch targets >= 44px on md/lg — most customers are on phones.
const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-5 text-base",
  lg: "min-h-12 px-7 text-lg",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold no-underline transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
    "disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

interface StyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export type ButtonProps = StyleProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant, size, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...rest} />;
}

export type ButtonLinkProps = StyleProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** A link styled as a button — for navigation, tel:, mailto:. */
export function ButtonLink({ variant, size, className, ...rest }: ButtonLinkProps) {
  return <a className={buttonClasses(variant, size, className)} {...rest} />;
}
