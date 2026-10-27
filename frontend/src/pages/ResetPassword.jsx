import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, LinkIcon } from "lucide-react";
import authService from "../services/auth.service";
import AuthLayout from "../components/auth/AuthLayout";
import { PasswordInput, PasswordStrength } from "../components/auth/PasswordInput";
import { Alert, Button, PageLoader } from "../components/ui";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking"); // checking | valid | expired
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check the link first, so a used or expired one says so up front
  useEffect(() => {
    authService
      .validateResetToken(token)
      .then((res) => {
        setEmail(res.data?.email || "");
        setStatus("valid");
      })
      .catch(() => setStatus("expired"));
  }, [token]);

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFieldErrors({ ...fieldErrors, [e.target.name]: undefined });
    setError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (form.password.length < 8) errors.password = "Use at least 8 characters";
    if (form.confirmPassword !== form.password) errors.confirmPassword = "Passwords don't match";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setLoading(true);
    try {
      await authService.resetPassword(token, form.password);
      navigate("/login?reset=1", { replace: true });
    } catch (err) {
      if (/expired|already used/i.test(err.message || "")) {
        setStatus("expired");
      } else {
        setError(err.message || "Could not reset the password. Please try again.");
      }
      setLoading(false);
    }
  };

  if (status === "checking") {
    return (
      <AuthLayout title="Reset your password">
        <PageLoader className="min-h-[120px]" />
      </AuthLayout>
    );
  }

  if (status === "expired") {
    return (
      <AuthLayout
        title="This link has expired"
        footer={
          <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to log in
          </Link>
        }
      >
        <div className="flex flex-col items-start gap-4">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-warning-soft">
            <LinkIcon className="h-5 w-5 text-warning-fg" aria-hidden="true" />
          </span>
          <p className="text-sm text-fg-muted">
            Reset links work once and expire after 60 minutes. Request a new one and use the latest email we send.
          </p>
          <Button as={Link} to="/forgot-password">
            Request a new link
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      description={email ? `For ${email}. You'll be logged out everywhere else.` : undefined}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <PasswordInput
            label="New password"
            name="password"
            autoComplete="new-password"
            value={form.password}
            onChange={onChange}
            error={fieldErrors.password}
            autoFocus
          />
          <PasswordStrength password={form.password} />
        </div>
        <PasswordInput
          label="Confirm new password"
          name="confirmPassword"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={onChange}
          error={fieldErrors.confirmPassword}
        />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? "Saving…" : "Reset password"}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;
