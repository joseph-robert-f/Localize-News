"use client";

/**
 * Client-side admin authentication context.
 *
 * Stores the ADMIN_SECRET in sessionStorage (cleared when the tab closes).
 * The actual secret validation happens server-side on every API call —
 * this just avoids re-entering it on every action.
 *
 * Usage:
 *   <AdminAuthProvider>
 *     <YourAdminUI />   // can call useAdminSecret() to get the secret
 *   </AdminAuthProvider>
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/Button";

const SESSION_KEY = "ln_admin_secret";

interface AdminAuthContextValue {
  secret: string | null;
  clear: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  secret: null,
  clear: () => {},
});

export function useAdminSecret() {
  return useContext(AdminAuthContext);
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  // Read from sessionStorage via lazy initialiser — runs only once, client-side only.
  // We can't use sessionStorage during SSR so we default to null; the `hydrated`
  // flag prevents a flash of the login form on first render.
  const [secret, setSecret] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // This runs once after mount, safe to read sessionStorage here
    const init = () => {
      const stored = sessionStorage.getItem(SESSION_KEY);
      setSecret(stored);
      setHydrated(true);
    };
    init();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) {
      setError("Please enter the admin secret.");
      return;
    }
    sessionStorage.setItem(SESSION_KEY, input.trim());
    setSecret(input.trim());
    setError("");
  }

  function clear() {
    sessionStorage.removeItem(SESSION_KEY);
    setSecret(null);
    setInput("");
  }

  // Avoid flash of login form on first render
  if (!hydrated) return null;

  if (!secret) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">Admin access</h1>
          <p className="mb-6 text-sm text-zinc-500">Enter the admin secret to continue.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              placeholder="Admin secret"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button type="submit">Enter</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AdminAuthContext.Provider value={{ secret, clear }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
