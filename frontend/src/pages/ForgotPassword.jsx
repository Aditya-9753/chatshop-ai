import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import authService from "../services/auth.service";
import AuthLayout from "../components/auth/AuthLayout";
import { Alert, Button, Input } from "../components/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BackToLogin = () => (
  <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
    <ArrowLeft className="h-4 w-4" /> Back to log in
  </Link>
);

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) {
      setFieldError("Enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await authService.forgotPassword(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      setError(err.message || "Could not send the reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" footer={<BackToLogin />}>
        <div className="flex flex-col items-start gap-4">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-success-soft">
            <MailCheck className="h-5 w-5 text-success-fg" aria-hidden="true" />
          </span>
          <p className="text-sm text-fg-muted">
            If an account exists for <span className="font-medium text-fg">{sentTo}</span>, we've sent a link to reset
            the password. It works once and expires in 60 minutes.
          </p>
          <p className="text-caption text-fg-muted">Didn't get it? Check spam, or</p>
          <Button variant="secondary" onClick={() => setSentTo("")}>
            Try another email
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter the email you log in with and we'll send you a reset link."
      footer={<BackToLogin />}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          icon={Mail}
          placeholder="you@business.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFieldError("");
          }}
          error={fieldError}
          autoFocus
        />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;
