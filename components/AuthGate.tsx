"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase";

// Client-side session gate. The root layout must stay a server component
// (it exports `metadata`), so the session check + redirect lives here and
// wraps {children} instead of living directly in layout.tsx.
export default function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [supabase] = useState(() => createBrowserClient());
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const isPublicRoute =
    pathname === "/login" || pathname.startsWith("/interview/");

  useEffect(() => {
    if (checked && !session && !isPublicRoute) {
      router.push("/login");
    }
  }, [checked, session, isPublicRoute, router]);

  // /login and /interview/* are public — members reach /interview/[member_id]
  // via their private link and don't have a Wavelength account, so always
  // render these regardless of session state.
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Waiting on the session check, or about to redirect — render nothing.
  if (!checked || !session) {
    return null;
  }

  return <>{children}</>;
}
