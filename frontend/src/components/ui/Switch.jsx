import React, { useId } from "react";
import { Check } from "lucide-react";
import { cn } from "./cn";

// Accessible on/off switch (role="switch")
export function Switch({ checked, onCheckedChange, label, description, disabled, id, className }) {
  const autoId = useId();
  const switchId = id || autoId;

  const control = (
    <button
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full border border-transparent",
        "transition-colors duration-150 ease-out disabled:opacity-50",
        checked ? "bg-accent" : "bg-surface-3"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm",
          "transition-transform duration-150 ease-out",
          checked && "translate-x-4"
        )}
      />
    </button>
  );

  if (!label) return control;

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <label htmlFor={switchId} className="flex flex-col gap-0.5 cursor-pointer">
        <span className="text-sm font-medium text-fg">{label}</span>
        {description && <span className="text-caption text-fg-muted">{description}</span>}
      </label>
      {control}
    </div>
  );
}

// Checkbox with an optional inline label
export function Checkbox({ checked, onCheckedChange, label, disabled, id, className, ...props }) {
  const autoId = useId();
  const boxId = id || autoId;
  const indeterminate = checked === "indeterminate";

  return (
    <label
      htmlFor={boxId}
      className={cn("inline-flex items-center gap-2 cursor-pointer select-none", disabled && "opacity-50", className)}
    >
      <span className="relative inline-flex">
        <input
          id={boxId}
          type="checkbox"
          checked={checked === true}
          ref={(el) => el && (el.indeterminate = indeterminate)}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className={cn(
            "peer h-4 w-4 appearance-none rounded border border-line-strong bg-surface",
            "checked:bg-accent checked:border-accent indeterminate:bg-accent indeterminate:border-accent",
            "transition-colors duration-150"
          )}
          {...props}
        />
        <Check
          className="absolute inset-0 m-auto h-3 w-3 text-accent-fg opacity-0 peer-checked:opacity-100 pointer-events-none"
          strokeWidth={3}
          aria-hidden="true"
        />
        {indeterminate && (
          <span className="absolute inset-0 m-auto h-0.5 w-2 bg-accent-fg rounded pointer-events-none" aria-hidden="true" />
        )}
      </span>
      {label && <span className="text-sm text-fg">{label}</span>}
    </label>
  );
}
