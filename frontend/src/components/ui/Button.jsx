import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

const VARIANTS = {
  primary:
    "bg-accent text-accent-fg hover:bg-accent-hover border border-transparent",
  secondary:
    "bg-surface text-fg border border-line hover:bg-surface-2 hover:border-line-strong",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-2 border border-transparent",
  danger: "bg-danger text-white hover:opacity-90 border border-transparent dark:text-canvas",
  "danger-ghost":
    "text-danger-fg hover:bg-danger-soft border border-transparent",
};

const SIZES = {
  sm: "h-8 px-3 text-caption gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-base gap-2",
  icon: "h-9 w-9 justify-center",
  "icon-sm": "h-8 w-8 justify-center",
};

const ICON_SIZES = { sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-4 h-4", icon: "w-4 h-4", "icon-sm": "w-4 h-4" };

/**
 * Button. Pass `as={Link}` (plus `to`) to render a router link that looks
 * like a button. `icon` renders a lucide icon before the label.
 */
const Button = forwardRef(function Button(
  {
    as: Component = "button",
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    icon: Icon,
    iconRight: IconRight,
    className,
    children,
    type,
    ...props
  },
  ref
) {
  const isButton = Component === "button";

  return (
    <Component
      ref={ref}
      type={isButton ? type || "button" : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-disabled={!isButton && (disabled || loading) ? true : undefined}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap select-none",
        "transition-colors duration-150 ease-out",
        "disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className={cn(ICON_SIZES[size], "animate-spin")} aria-hidden="true" />
      ) : (
        Icon && <Icon className={ICON_SIZES[size]} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight className={ICON_SIZES[size]} aria-hidden="true" />}
    </Component>
  );
});

export default Button;
