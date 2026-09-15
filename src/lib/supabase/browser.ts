"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

/**
 * Clerk's default session token carries neither `role` nor `email`, and the
 * instance API silently ignores attempts to add them. This named template does
 * carry both: `role: authenticated` is what stops Postgres treating every
 * request as anonymous, and `email` is what invitations are matched against.
 */
const SUPABASE_TEMPLATE = "supabase";

declare global {
  interface Window {
    Clerk?: {
      session?: { getToken: (options?: { template?: string }) => Promise<string | null> } | null;
    };
  }
}

let browserClient: SupabaseClient | null = null;

/**
 * The browser's Supabase client, authenticated by Clerk.
 *
 * Supabase Auth is no longer in the picture: Clerk owns the session, and
 * Postgres accepts its JWT because the Clerk instance is registered as a
 * third-party auth provider on the project. Every request asks Clerk for a
 * fresh token, so an expired one is replaced without the caller knowing.
 *
 * This is `createClient`, not `createBrowserClient` from @supabase/ssr — the
 * ssr helper exists to sync Supabase's own auth cookies, and there are none to
 * sync any more. Clerk's middleware handles the cookie side.
 *
 * Returning null when the token is missing matters: Postgres then sees an
 * anonymous request and every row-level policy fails closed, rather than the
 * client silently falling back to the publishable key as a bearer token.
 */
export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const config = getSupabaseConfig();
  if (!config) return null;

  browserClient = createClient(config.url, config.anonKey, {
    accessToken: async () => {
      if (typeof window === "undefined") return null;
      try {
        return (await window.Clerk?.session?.getToken({ template: SUPABASE_TEMPLATE })) ?? null;
      } catch {
        return null;
      }
    },
  });

  return browserClient;
}
