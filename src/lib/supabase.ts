import { createBrowserClient } from "@supabase/ssr";
import { env } from "./env";

/**
 * Browser Supabase client, created once per tab.
 *
 * Auth only — we never read application data through Supabase. Prescriptions,
 * roles and scans all come from the backend API, which is the single authority.
 */
let client: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseClient() {
  client ??= createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
