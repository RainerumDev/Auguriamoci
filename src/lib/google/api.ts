/** Shared fetch helper for the Google REST APIs. */

/**
 * OAuth access token (private sources) or bare API key (public sources:
 * sheets/calendars/files shared with "anyone with the link").
 */
export type GoogleAuth = { accessToken: string } | { apiKey: string };

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }

  /** True when the credential was rejected (expired/revoked/not public). */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

/** Bearer header for tokens; `key=` query parameter for API keys. */
export function applyAuth(
  url: string,
  auth: GoogleAuth,
): { url: string; headers: Record<string, string> } {
  if ("accessToken" in auth) {
    return { url, headers: { Authorization: `Bearer ${auth.accessToken}` } };
  }
  const withKey = new URL(url);
  withKey.searchParams.set("key", auth.apiKey);
  return { url: withKey.toString(), headers: {} };
}

export async function googleGet<T>(url: string, auth: GoogleAuth): Promise<T> {
  const req = applyAuth(url, auth);
  const res = await fetch(req.url, { headers: req.headers });
  if (!res.ok) {
    throw new GoogleApiError(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as T;
}

export async function googleGetBlob(
  url: string,
  auth: GoogleAuth,
): Promise<Blob> {
  const req = applyAuth(url, auth);
  const res = await fetch(req.url, { headers: req.headers });
  if (!res.ok) {
    throw new GoogleApiError(await readErrorMessage(res), res.status);
  }
  return res.blob();
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body.error?.message) return body.error.message;
  } catch {
    // Non-JSON error body.
  }
  return `Richiesta Google fallita (HTTP ${res.status}).`;
}
