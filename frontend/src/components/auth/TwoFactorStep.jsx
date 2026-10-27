import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Alert, Button, Input } from "../ui";

/**
 * Second login step for accounts with two-factor login: a 6-digit code
 * from the authenticator app. onDone(user) runs after a good code.
 */
export default function TwoFactorStep({ challengeToken, onDone, onCancel }) {
  const { loginWithCode } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (code.replace(/\s/g, "").length !== 6) return setError("Enter the 6-digit code");
    setLoading(true);
    setError("");
    try {
      const response = await loginWithCode(challengeToken, code);
      onDone(response.data.user);
    } catch (err) {
      setError(err.message || "That code isn't right");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 p-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
        <p className="text-caption text-fg-muted">
          Two-factor login is on for this account. Open your authenticator app and enter the 6-digit code for ChatShop.
        </p>
      </div>
      <Input
        label="Authentication code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        placeholder="123456"
        inputClassName="font-mono tracking-[0.3em] text-base"
        value={code}
        onChange={(e) => {
          setCode(e.target.value.replace(/[^\d\s]/g, ""));
          setError("");
        }}
        autoFocus
      />
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" size="lg" loading={loading} className="w-full">
        {loading ? "Checking…" : "Verify and log in"}
      </Button>
      <button type="button" onClick={onCancel} className="text-caption font-medium text-fg-muted hover:text-fg">
        Use a different account
      </button>
    </form>
  );
}
