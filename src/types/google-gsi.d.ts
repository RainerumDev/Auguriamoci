/**
 * Minimal ambient types for Google Identity Services (token flow only).
 * The script is loaded at runtime from https://accounts.google.com/gsi/client.
 */

interface GsiTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface GsiTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GsiTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GsiTokenResponse) => void;
  error_callback?: (error: { type: string; message?: string }) => void;
}

interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient(config: GsiTokenClientConfig): GsiTokenClient;
        revoke(accessToken: string, done?: () => void): void;
      };
    };
  };
}
