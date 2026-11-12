import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import authService from "../services/auth.service";
import AuthLayout from "../components/auth/AuthLayout";
import { useAuth } from "../context/AuthContext";
import { Alert, Button, Input, PageLoader } from "../components/ui";

export default function VerifyEmail() {
  const { token } = useParams();
  const { isAuthenticated, user, updateUser } = useAuth();
  const [status, setStatus] = useState(token ? "checking" : "ready");
  const [error, setError] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState("");
  const requestRef = useRef({ token: null, promise: null });

  useEffect(() => {
    if (!token) {
      setStatus("ready");
      return undefined;
    }
    if (requestRef.current.token !== token) {
      requestRef.current = { token, promise: authService.verifyEmail(token) };
      setStatus("checking");
    }
    let active = true;
    requestRef.current.promise
      .then(() => {
        if (active) {
          setStatus("verified");
          if (isAuthenticated) updateUser({ isVerified: true });
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "This verification link is invalid or expired.");
          setStatus("failed");
        }
      });
    return () => {
      active = false;
    };
  }, [token, isAuthenticated, updateUser]);

  const verifyCode = async (event) => {
    event.preventDefault();
    setCodeBusy(true);
    setCodeError("");
    try {
      await authService.verifyEmailCode(email.trim(), code);
      setStatus("verified");
      setError("");
      if (isAuthenticated) updateUser({ isVerified: true });
    } catch (err) {
      setCodeError(err.message || "This code is invalid or expired.");
    } finally {
      setCodeBusy(false);
    }
  };

  if (status === "checking") {
    return (
      <AuthLayout title="Verifying your email">
        <PageLoader className="min-h-[120px]" />
      </AuthLayout>
    );
  }

  const verified = status === "verified";
  return (
    <AuthLayout
      title={verified ? "Email verified" : status === "failed" ? "Email verification" : "Verify your email"}
      description={verified ? "Your email address is now verified." : "Use the link in your email, or enter its 6-digit code below."}
      footer={
        <Link to={isAuthenticated ? "/dashboard" : "/login"} className="font-medium text-accent hover:underline">
          {isAuthenticated ? "Continue to your workspace" : "Go to log in"}
        </Link>
      }
    >
      {verified ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <BadgeCheck className="h-12 w-12 text-success" aria-hidden="true" />
          <p className="text-sm text-fg-muted">You can now see the Email Verified badge in your profile.</p>
          <Button as={Link} to={isAuthenticated ? "/dashboard" : "/login"} className="w-full">
            {isAuthenticated ? "Open workspace" : "Log in"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {status === "failed" && <Alert tone="danger">{error}</Alert>}
          <form onSubmit={verifyCode} className="flex flex-col gap-4">
            <Input
              label="Account email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              label="6-digit email code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
            {codeError && <Alert tone="danger">{codeError}</Alert>}
            <Button type="submit" className="w-full" disabled={code.length !== 6 || !email.trim()} loading={codeBusy}>
              Verify with code
            </Button>
          </form>
          <p className="text-center text-sm text-fg-muted">
            The code expires after 5 minutes. If it expires, sign in and resend the verification email from Settings → Profile.
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
