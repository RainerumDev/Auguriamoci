/**
 * Google OAuth 2.0 via Google Identity Services (token / implicit flow).
 *
 * Zero-backend constraints (PRD §3):
 * - Access token lives in localStorage, NEVER inside the exportable config.
 * - There is no refresh token client-side: when the token expires we attempt
 *   a silent re-issue (prompt: "") which succeeds while the browser still has
 *   an active Google session; otherwise the UI must ask the user to sign in.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
];

const TOKEN_KEY = "auguriamoci:oauth-token";
const GSI_SRC = "https://accounts.google.com/gsi/client";

export interface StoredToken {
  accessToken: string;
  /** Epoch ms after which the token must not be used (60s safety margin). */
  expiresAt: number;
  email?: string;
}

let gsiLoader: Promise<void> | null = null;

/** Inject the GIS script once. Rejects when offline. */
export function loadGsi(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gsiLoader) return gsiLoader;
  gsiLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiLoader = null;
      script.remove();
      reject(
        new Error(
          "Impossibile caricare Google Identity Services. Sei offline?",
        ),
      );
    };
    document.head.appendChild(script);
  });
  return gsiLoader;
}

export function getStoredToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw) as StoredToken;
    return typeof token.accessToken === "string" &&
      typeof token.expiresAt === "number"
      ? token
      : null;
  } catch {
    return null;
  }
}

export function isTokenValid(token: StoredToken | null): token is StoredToken {
  return token !== null && token.expiresAt > Date.now();
}

function saveToken(token: StoredToken): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface SignInOptions {
  /**
   * silent = true issues the request with prompt: "" and no visible UI when
   * the Google session is still alive; it fails fast otherwise.
   */
  silent?: boolean;
}

/**
 * Request a fresh access token. Resolves with the stored token or rejects
 * with an Error carrying a user-facing Italian message.
 */
export async function signIn(
  clientId: string,
  options: SignInOptions = {},
): Promise<StoredToken> {
  if (!clientId) {
    throw new Error("Configura prima il Client ID Google nelle impostazioni.");
  }
  await loadGsi();
  const oauth2 = window.google!.accounts.oauth2;

  return new Promise<StoredToken>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES.join(" "),
      callback: (response) => {
        if (response.error) {
          reject(
            new Error(
              response.error_description ??
                `Accesso Google negato (${response.error}).`,
            ),
          );
          return;
        }
        const token: StoredToken = {
          accessToken: response.access_token,
          expiresAt: Date.now() + Math.max(0, response.expires_in - 60) * 1000,
          email: getStoredToken()?.email,
        };
        saveToken(token);
        resolve(token);
        // Best-effort: attach the account email for the settings UI.
        void fetchUserEmail(token.accessToken).then((email) => {
          if (email) saveToken({ ...token, email });
        });
      },
      error_callback: (error) => {
        reject(
          new Error(
            error.type === "popup_closed"
              ? "Accesso annullato."
              : (error.message ?? `Errore di accesso Google (${error.type}).`),
          ),
        );
      },
    });
    // prompt "": Google shows consent only when needed; silent when the
    // browser session is active (PRD silent-login requirement).
    client.requestAccessToken({ prompt: options.silent ? "" : "select_account" });
  });
}

/** Try to renew an expired token without any UI. Returns null on failure. */
export async function trySilentRefresh(
  clientId: string,
): Promise<StoredToken | null> {
  try {
    return await signIn(clientId, { silent: true });
  } catch {
    return null;
  }
}

/** Revoke the current token (best effort) and forget it locally. */
export async function signOut(): Promise<void> {
  const token = getStoredToken();
  clearToken();
  if (token && navigator.onLine) {
    try {
      await loadGsi();
      window.google!.accounts.oauth2.revoke(token.accessToken, () => {});
    } catch {
      // Offline or GIS unavailable: local sign-out is enough.
    }
  }
}

async function fetchUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const info = (await res.json()) as { email?: string };
    return info.email ?? null;
  } catch {
    return null;
  }
}
