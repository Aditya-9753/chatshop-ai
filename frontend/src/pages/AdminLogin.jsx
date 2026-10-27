import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { LogoMark } from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import { PasswordInput } from "../components/auth/PasswordInput";
import TwoFactorStep from "../components/auth/TwoFactorStep";
import { Alert, Badge, Button, Card, Input } from "../components/ui";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { login, logout, isAuthenticated, isAdmin } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [challengeToken, setChallengeToken] = useState(null);

  useEffect(() => {
    if (isAuthenticated && isAdmin) navigate("/admin/dashboard", { replace: true });
  }, [isAuthenticated, isAdmin, navigate]);

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return setError("Enter your email and password");
    setLoading(true);
    try {
      const response = await login(form.email.trim(), form.password);
      if (response.data.twoFactorRequired) {
        setChallengeToken(response.data.challengeToken);
        setLoading(false);
        return;
      }
      if (response.data.user?.role !== "admin") {
        logout();
        setError("This account doesn't have admin access.");
        setLoading(false);
        return;
      }
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas px-4 py-6">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2.5">
            <LogoMark />
            <span className="text-sm font-semibold text-fg">ChatShop</span>
            <Badge tone="accent">
              <ShieldCheck className="h-3 w-3" /> Admin
            </Badge>
          </div>
          <Card className="p-6">
            <h1 className="text-xl font-semibold tracking-tight text-fg">Admin sign in</h1>
            <p className="mt-1 text-sm text-fg-muted">Restricted to platform administrators.</p>
            {challengeToken ? (
              <div className="mt-6">
                <TwoFactorStep
                  challengeToken={challengeToken}
                  onDone={(user) => {
                    if (user?.role !== "admin") {
                      logout();
                      setChallengeToken(null);
                      setError("This account doesn't have admin access.");
                      return;
                    }
                    navigate("/admin/dashboard", { replace: true });
                  }}
                  onCancel={() => setChallengeToken(null)}
                />
              </div>
            ) : (
            <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
              <Input label="Email" name="email" type="email" icon={Mail} autoComplete="email" value={form.email} onChange={onChange} autoFocus />
              <PasswordInput label="Password" name="password" autoComplete="current-password" value={form.password} onChange={onChange} />
              {error && <Alert tone="danger">{error}</Alert>}
              <Button type="submit" size="lg" loading={loading} className="w-full">
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminLogin;
