import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { auth, setToken } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — PLINTH" },
      { name: "description", content: "Sign in to PLINTH — Architectural AI Platform" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    try {
      if (isSignup) {
        const res = await auth.signup(cleanEmail, cleanPassword, fullName.trim() || "Architect");
        setToken(res.access_token);
      } else {
        const res = await auth.login(cleanEmail, cleanPassword);
        setToken(res.access_token);
      }
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await navigate({ to: "/app" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      if (msg.includes("401") || msg.includes("Invalid")) {
        setError("Invalid email or password. Demo credentials: architect@plinth.ai / demo1234");
      } else if (msg.includes("409")) {
        setError("Email is already registered. Please sign in.");
      } else {
        setError(msg || "Sign in failed. Please check your backend connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError("");
    setLoading(true);
    try {
      const res = await auth.login("architect@plinth.ai", "demo1234");
      setToken(res.access_token);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await navigate({ to: "/app" });
    } catch {
      setError("Demo authentication failed. Please ensure backend server is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 border border-border bg-card p-8 shadow-2xl">
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-block">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center border border-foreground">
              <span className="text-[10px] font-medium tracking-[0.2em]">P</span>
            </div>
          </Link>
          <h1 className="text-xl font-light tracking-[-0.01em]">
            {isSignup ? "Create PLINTH Account" : "Sign in to PLINTH"}
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">Architectural Intelligence Platform</p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 border border-border text-center text-[12px]">
          <button
            type="button"
            onClick={() => { setIsSignup(false); setError(""); }}
            className={`py-2 transition-colors ${!isSignup ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignup(true); setError(""); }}
            className={`py-2 transition-colors ${isSignup ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            Create Account
          </button>
        </div>

        {/* Quick Demo Access Button */}
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={loading}
          className="flex h-10 w-full items-center justify-center border border-border bg-muted/40 text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          ⚡ Instant Demo Access (No Password Required)
        </button>

        <div className="relative py-0 text-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <span className="relative bg-card px-2 text-[10px] uppercase text-muted-foreground">Or sign in manually</span>
        </div>

        {/* Form */}
        {!isSignup && (
          <div className="flex items-center justify-between border border-border/70 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
            <div>
              <span className="text-[10px] uppercase text-muted-foreground block font-mono">Demo Credentials</span>
              <span className="font-mono text-foreground font-medium">architect@plinth.ai</span> / <span className="font-mono text-foreground font-medium">demo1234</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail("architect@plinth.ai");
                setPassword("demo1234");
                setError("");
              }}
              className="border border-border bg-background px-2 py-1 text-[10px] font-mono font-medium text-foreground hover:bg-muted"
            >
              Auto-fill
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="border border-accent/30 bg-accent/5 px-3 py-2 text-[12px] text-accent">
              {error}
            </div>
          )}

          {isSignup && (
            <div>
              <label className="label-tech mb-1.5 block">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Sneha Iyer"
                required
                className="h-10 w-full border border-border bg-background px-3 text-[13px] outline-none transition-colors focus:border-foreground/50"
              />
            </div>
          )}

          <div>
            <label className="label-tech mb-1.5 block">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="h-10 w-full border border-border bg-background px-3 text-[13px] outline-none transition-colors focus:border-foreground/50"
            />
          </div>

          <div>
            <label className="label-tech mb-1.5 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="h-10 w-full border border-border bg-background px-3 text-[13px] outline-none transition-colors focus:border-foreground/50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-10 w-full items-center justify-center border border-foreground bg-foreground text-[12px] tracking-[0.05em] text-background uppercase transition-colors hover:bg-transparent hover:text-foreground disabled:opacity-50"
          >
            {loading ? "Processing..." : isSignup ? "Create Account & Launch" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-[12px] text-muted-foreground pt-2">
          <Link to="/" className="border-b border-foreground/30 text-foreground hover:border-foreground">
            ← Back to main site
          </Link>
        </p>
      </div>
    </div>
  );
}
