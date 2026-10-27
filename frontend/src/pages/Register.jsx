import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/auth/AuthLayout";
import { PasswordInput, PasswordStrength } from "../components/auth/PasswordInput";
import { Alert, Button, Input } from "../components/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Register = () => {
  const navigate = useNavigate();
  const { register, login, isAuthenticated } = useAuth();
  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFieldErrors({ ...fieldErrors, [e.target.name]: undefined });
    setError("");
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = "Enter your name";
    if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Enter a valid email address";
    if (!form.phone.trim()) errors.phone = "Enter a phone number";
    if (form.password.length < 6) errors.password = "Use at least 6 characters";
    if (form.confirmPassword !== form.password) errors.confirmPassword = "Passwords don't match";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        businessName: form.businessName.trim(),
        password: form.password,
      });
      // Sign straight in; the 14-day trial starts now
      await login(form.email.trim(), form.password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your workspace"
      description="Start a free 14-day trial. No card needed."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Your name" name="name" autoComplete="name" value={form.name} onChange={onChange} error={fieldErrors.name} autoFocus />
          <Input label="Business name" name="businessName" autoComplete="organization" value={form.businessName} onChange={onChange} hint="Optional" />
        </div>
        <Input
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@business.com"
          value={form.email}
          onChange={onChange}
          error={fieldErrors.email}
        />
        <Input
          label="Phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          value={form.phone}
          onChange={onChange}
          error={fieldErrors.phone}
        />
        <div>
          <PasswordInput
            label="Password"
            name="password"
            autoComplete="new-password"
            value={form.password}
            onChange={onChange}
            error={fieldErrors.password}
          />
          <PasswordStrength password={form.password} />
        </div>
        <PasswordInput
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={onChange}
          error={fieldErrors.confirmPassword}
        />

        {error && <Alert tone="danger">{error}</Alert>}

        <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
          {loading ? "Creating workspace…" : "Create account"}
        </Button>
        <p className="text-center text-xs text-fg-muted">
          By continuing you agree to the Terms of Service and Privacy Policy.
        </p>
      </form>
    </AuthLayout>
  );
};

export default Register;
