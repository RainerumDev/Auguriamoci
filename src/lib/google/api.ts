/** Shared fetch helper for the Google REST APIs. */

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }

  /** True when the access token was rejected (expired/revoked). */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export async function googleGet<T>(
  url: string,
  accessToken: string,
): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new GoogleApiError(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as T;
}

export async function googleGetBlob(
  url: string,
  accessToken: string,
): Promise<Blob> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
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
