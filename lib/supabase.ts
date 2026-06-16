import { createClient } from "@supabase/supabase-js";
import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";
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

// Session-aware client for use inside "use client" components — reads/writes
// the Supabase auth session via cookies so requests carry the signed-in
// consultant's identity (needed for auth.uid() checks like consultant_id).
// Required (instead of the plain client above) for the new sb_publishable_...
// key format, which @supabase/auth-helpers-nextjs doesn't support.
export function createBrowserClient() {
  return createSSRBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
