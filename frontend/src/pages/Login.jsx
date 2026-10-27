import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/auth/AuthLayout";
import { PasswordInput } from "../components/auth/PasswordInput";
import TwoFactorStep from "../components/auth/TwoFactorStep";
import { Alert, Button, Input } from "../components/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { login, isAuthenticated, isAdmin } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [challengeToken, setChallengeToken] = useState(null);

  const destination = (admin) =>
    admin ? "/admin/dashboard" : location.state?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (isAuthenticated) navigate(destination(isAdmin), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFieldErrors({ ...fieldErrors, [e.target.name]: undefined });
    setError("");
  };

  const validate = () => {
    const errors = {};
    if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Enter a valid email address";
    if (!form.password) errors.password = "Enter your password";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError("");
    try {
      const response = await login(form.email.trim(), form.password);
      if (response.data.twoFactorRequired) {
        setChallengeToken(response.data.challengeToken);
        setLoading(false);
        return;
      }
      navigate(destination(response.data.user?.role === "admin"), { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      description="Log in to your ChatShop workspace."
      footer={
        <>
          New to ChatShop?{" "}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {challengeToken ? (
        <TwoFactorStep
          challengeToken={challengeToken}
          onDone={(user) => navigate(destination(user?.role === "admin"), { replace: true })}
          onCancel={() => setChallengeToken(null)}
        />
      ) : (
      <>
      {params.get("expired") && !error && (
        <Alert tone="info" className="mb-5">
          Your session ended. Please log in again.
        </Alert>
      )}
      {params.get("reset") && !error && (
        <Alert tone="success" className="mb-5">
          Password updated. Log in with your new password.
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          icon={Mail}
          placeholder="you@business.com"
          value={form.email}
          onChange={onChange}
          error={fieldErrors.email}
          autoFocus
        />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-caption font-medium text-fg">
              Password
            </label>
            <Link to="/forgot-password" className="text-caption font-medium text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            value={form.password}
            onChange={onChange}
            error={fieldErrors.password}
          />
        </div>

        {error && <Alert tone="danger">{error}</Alert>}

        <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>
      </>
      )}
    </AuthLayout>
  );
};

export default Login;
