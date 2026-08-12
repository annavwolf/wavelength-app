import { createClient } from "@supabase/supabase-js";
import {
  createBrowserClient as createSSRBrowserClient,
  createServerClient as createSSRServerClient,
} from "@supabase/ssr";
import type { Database } from "@/types/database";

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Falls back to an inert placeholder so the app can build and render before
// real Supabase credentials are set in .env.local — calls will simply fail
// at request time instead of crashing the whole page during render/build.
const isValidUrl = !!envUrl && /^https?:\/\//.test(envUrl);

const supabaseUrl = isValidUrl ? envUrl! : "https://placeholder.supabase.co";
const supabaseAnonKey = envAnonKey || "placeholder-anon-key";

// Basic client for server-side / non-session-bound use.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Service-role client — bypasses RLS entirely. Only used in server API routes
// that legitimately need access to restricted tables (member_identity, audit log).
// Never expose this key to the browser.
// Never fall back to the browser key here. After the beta RLS migration, a
// missing service key must fail closed instead of silently using a broad client.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "missing-service-role-key";
export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// Session-aware client for use inside "use client" components — reads/writes
// the Supabase auth session via cookies so requests carry the signed-in
// consultant's identity (needed for auth.uid() checks like consultant_id).
// Required (instead of the plain client above) for the new sb_publishable_...
// key format, which @supabase/auth-helpers-nextjs doesn't support.
export function createBrowserClient() {
  return createSSRBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

// Session-aware server client for route handlers. Route handlers deliberately
// pass request cookies in and do not mutate them here: these short-lived API
// calls only need to verify the current consultant identity. Keeping this
// helper here avoids accidental service-role use for an authentication check.
export function createServerAuthClient(
  getAll: () => { name: string; value: string }[]
) {
  return createSSRServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll,
      setAll() {
        // Auth refreshes are handled by the normal browser session flow.
      },
    },
  });
}
