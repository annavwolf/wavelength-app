// Canonical public URL for links that leave the application (email and copied
// participant invites). Keep this server-only: browser-controlled request
// origins must never become the production source of an emailed capability.
import "server-only";

const MARKETING_HOSTS = new Set(["wavelength.team", "www.wavelength.team"]);

export const OTIS_APP_URL_CONFIGURATION_ERROR =
  "Email links are not configured. Set OTIS_APP_URL in Vercel to the deployed Otis app URL (not https://wavelength.team or https://www.wavelength.team), then redeploy.";

export class OtisAppUrlConfigurationError extends Error {
  constructor() {
    super(OTIS_APP_URL_CONFIGURATION_ERROR);
    this.name = "OtisAppUrlConfigurationError";
  }
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function normalizeUrl(value: string, allowHttp: boolean): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new OtisAppUrlConfigurationError();
  }

  if (
    (parsed.protocol !== "https:" && !(allowHttp && parsed.protocol === "http:")) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new OtisAppUrlConfigurationError();
  }

  if (isProduction() && MARKETING_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new OtisAppUrlConfigurationError();
  }

  return parsed.origin;
}

/**
 * Return the canonical Otis application URL for links sent outside the app.
 * OTIS_APP_URL is the server-only production setting. NEXT_PUBLIC_APP_URL is
 * accepted only as a transitional fallback. Production deliberately never
 * derives an email URL from the request host.
 */
export function resolveOtisAppUrl(requestOrigin?: string): string {
  const configured = process.env.OTIS_APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return normalizeUrl(configured, !isProduction());

  if (isProduction()) throw new OtisAppUrlConfigurationError();

  // Local development remains usable without deployment configuration. A
  // supplied Next request origin is normalized before use; otherwise use the
  // standard local Next development address.
  return normalizeUrl(requestOrigin ?? "http://localhost:3000", true);
}
