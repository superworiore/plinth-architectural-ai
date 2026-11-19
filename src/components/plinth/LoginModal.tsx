import { useState } from "react";
import { auth, setToken } from "@/lib/api";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        const res = await auth.signup(email, password, fullName || "Architect");
        setToken(res.access_token);
      } else {
        const res = await auth.login(email, password);
        setToken(res.access_token);
      }
      onClose();
      window.location.href = "/app";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      if (msg.includes("401") || msg.includes("Invalid")) {
        setError("Invalid email or password");
      } else if (msg.includes("409")) {
        setError("Email is already registered. Please sign in.");
      } else {
        setError("Sign in failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 transition-all animate-in fade-in">
      <div className="relative w-full max-w-md border border-border bg-card p-6 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-sm font-mono"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center border border-foreground">
            <span className="text-[10px] font-medium tracking-[0.2em]">P</span>
          </div>
          <h2 className="text-xl font-light tracking-[-0.01em]">
            {isSignup ? "Create PLINTH Account" : "Sign in to PLINTH"}
          </h2>
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

        {/* Form */}
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
            {loading ? "Processing..." : isSignup ? "Create Account & Launch" : "Sign in to Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
