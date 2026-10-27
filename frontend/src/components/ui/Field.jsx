import React, { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";

// Shared look for text inputs, textareas and selects
export const controlClass = (invalid) =>
  cn(
    "w-full rounded-lg border bg-surface text-fg text-sm",
    "transition-colors duration-150 ease-out outline-none",
    "focus:border-accent focus:ring-3 focus:ring-accent/15",
    "disabled:bg-surface-2 disabled:text-fg-muted disabled:cursor-not-allowed",
    invalid ? "border-danger" : "border-line hover:border-line-strong"
  );

/**
 * Label + control + hint/error. The child control gets the id and aria
 * attributes through a render function: <Field>{(props) => <Input {...props} />}</Field>
 * Most callers use the `label` prop on Input/Textarea/Select instead.
 */
export function Field({ label, hint, error, required, id, className, children }) {
  const autoId = useId();
  const controlId = id || autoId;
  const hintId = `${controlId}-hint`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={controlId} className="text-caption font-medium text-fg">
          {label}
          {required && (
            <span className="text-danger-fg ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children({
        id: controlId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? hintId : undefined,
        required,
      })}
      {(error || hint) && (
        <p
          id={hintId}
          className={cn("text-xs", error ? "text-danger-fg" : "text-fg-muted")}
          role={error ? "alert" : undefined}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { label, hint, error, required, id, className, inputClassName, icon: Icon, suffix, ...props },
  ref
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} className={className}>
      {(fieldProps) => (
        <div className="relative">
          {Icon && (
            <Icon
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none"
              aria-hidden="true"
            />
          )}
          <input
            ref={ref}
            className={cn(
              controlClass(error),
              "h-9 px-3",
              Icon && "pl-9",
              suffix && "pr-10",
              inputClassName
            )}
            {...fieldProps}
            {...props}
          />
          {suffix && <div className="absolute right-1 top-1/2 -translate-y-1/2">{suffix}</div>}
        </div>
      )}
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, hint, error, required, id, className, rows = 3, ...props },
  ref
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} className={className}>
      {(fieldProps) => (
        <textarea
          ref={ref}
          rows={rows}
          className={cn(controlClass(error), "px-3 py-2 resize-y min-h-[72px]")}
          {...fieldProps}
          {...props}
        />
      )}
    </Field>
  );
});

export const Select = forwardRef(function Select(
  { label, hint, error, required, id, className, selectClassName, options, children, ...props },
  ref
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} className={className}>
      {(fieldProps) => (
        <div className="relative">
          <select
            ref={ref}
            className={cn(controlClass(error), "h-9 pl-3 pr-8 appearance-none", selectClassName)}
            {...fieldProps}
            {...props}
          >
            {options
              ? options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden="true"
          />
        </div>
      )}
    </Field>
  );
});
