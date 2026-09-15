import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

/**
 * The server's Supabase client, authenticated by Clerk.
 *
 * Clerk's `auth()` reads the session from the request; `getToken()` mints the
 * JWT that Postgres validates against the Clerk JWKS. No cookie plumbing is
 * needed here any more — Clerk's middleware already did it — so this no longer
 * touches `next/headers` cookies at all.
 *
 * Every call builds a fresh client, because the token belongs to one request
 * and caching a client across requests would hand one user's session to the
 * next.
 */
export async function getSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  const { getToken } = await auth();

  return createClient(config.url, config.anonKey, {
    accessToken: async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    },
  });
}
