import React, { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "../ui/Field";
import { cn } from "../ui/cn";

// Password field with a show/hide toggle
export const PasswordInput = forwardRef(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <Input
      ref={ref}
      type={visible ? "text" : "password"}
      suffix={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          <Icon className="h-4 w-4" />
        </button>
      }
      {...props}
    />
  );
});

// 0–4 score from length and character variety
export function scorePassword(password = "") {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 0.5;
  if (/[^A-Za-z0-9]/.test(password)) score += 0.5;
  return Math.min(4, Math.floor(score));
}

const LEVELS = [
  { label: "Too short", bar: "bg-danger", text: "text-danger-fg" },
  { label: "Weak", bar: "bg-danger", text: "text-danger-fg" },
  { label: "Fair", bar: "bg-warning", text: "text-warning-fg" },
  { label: "Good", bar: "bg-success", text: "text-success-fg" },
  { label: "Strong", bar: "bg-success", text: "text-success-fg" },
];

export function PasswordStrength({ password }) {
  if (!password) return null;
  const score = password.length < 8 ? 0 : Math.max(1, scorePassword(password));
  const level = LEVELS[score];

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn("h-1 flex-1 rounded-full transition-colors", step <= score ? level.bar : "bg-surface-3")}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-fg-muted">
        <span className={cn("font-medium", level.text)}>{level.label}</span>
        {score < 3 && " · Use 12+ characters with upper and lower case, numbers or symbols."}
      </p>
    </div>
  );
}
