import { useCallback, useEffect, useState } from "react";
import {
  getStoredToken,
  isTokenValid,
  signIn as gisSignIn,
  signOut as gisSignOut,
  trySilentRefresh,
  type StoredToken,
} from "../lib/google/auth";

export type AuthStatus =
  | "no-client-id"
  | "signed-out"
  | "signed-in"
  | "expired";

export interface AuthState {
  status: AuthStatus;
  token: StoredToken | null;
  email: string | null;
  error: string | null;
  busy: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Central auth state. Attempts one silent refresh when an expired token is
 * found at startup (works while the browser's Google session is alive).
 */
export function useAuth(clientId: string): AuthState {
  const [token, setToken] = useState<StoredToken | null>(getStoredToken);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    const current = getStoredToken();
    if (current && !isTokenValid(current) && navigator.onLine) {
      void trySilentRefresh(clientId).then((renewed) => {
        if (renewed) setToken(renewed);
      });
    }
  }, [clientId]);

  // Renew ~5 minutes BEFORE expiry: the silent flow succeeds far more often
  // while the previous grant is still warm than hours after it lapsed.
  useEffect(() => {
    if (!clientId || !isTokenValid(token)) return;
    const delay = Math.max(30_000, token.expiresAt - Date.now() - 5 * 60_000);
    const timer = window.setTimeout(() => {
      if (!navigator.onLine) return;
      void trySilentRefresh(clientId).then((renewed) => {
        if (renewed) setToken(renewed);
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [clientId, token]);

  const signIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setToken(await gisSignIn(clientId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Accesso non riuscito.");
    } finally {
      setBusy(false);
    }
  }, [clientId]);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await gisSignOut();
      setToken(null);
      setError(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const status: AuthStatus = !clientId
    ? "no-client-id"
    : token === null
      ? "signed-out"
      : isTokenValid(token)
        ? "signed-in"
        : "expired";

  return {
    status,
    token,
    email: token?.email ?? null,
    error,
    busy,
    signIn,
    signOut,
  };
}
