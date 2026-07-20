/**
 * Env access in one place, so a missing variable fails loudly at first use
 * instead of surfacing as an undefined-in-a-URL bug three screens later.
 *
 * All three are NEXT_PUBLIC_ by design: auth and data fetching happen in the
 * browser. The anon key is a public client key; the backend is the enforcement
 * point. The service-role key must never appear in this repo.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
  },
  get supabaseAnonKey() {
    return required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
  get backendUrl() {
    return required(
      "NEXT_PUBLIC_BACKEND_URL",
      process.env.NEXT_PUBLIC_BACKEND_URL,
    ).replace(/\/$/, "");
  },
};
