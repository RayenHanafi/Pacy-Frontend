"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";

const LOGIN_PATH = "/login";

/**
 * Live state the QueryClient's error handler reads at failure time.
 *
 * The client is built once, so it can't close over render values — they'd be
 * frozen at whatever they were on first render. Module scope rather than a ref
 * because the handler runs outside React's render cycle entirely, and there is
 * exactly one Providers per app. An effect below keeps it current.
 */
const guard: {
  pathname: string;
  navigate: (path: string) => void;
  signingOut: boolean;
} = {
  pathname: LOGIN_PATH,
  // Replaced by the effect below once a router exists; a no-op until then.
  navigate: () => {},
  /** True between deciding to sign out and arriving at the login screen. */
  signingOut: false,
};

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [queryClient] = useState(() => {
    /**
     * Central session handling: an expired Supabase JWT should sign the user
     * out once, here, rather than every screen inventing its own recovery.
     *
     * Gated on code === "UNAUTHORIZED", never status === 401 — the other 401
     * (INVALID_STATION_KEY) belongs to IoT stations and must never log a
     * pharmacist out mid-demo.
     */
    const onError = async (error: unknown) => {
      if (!(error instanceof ApiError && error.isSessionExpired)) return;

      // Already on the login screen: there's no session left to end, and
      // redirecting to where we already are is what turned a single 401 into
      // an endless navigation loop.
      if (guard.pathname === LOGIN_PATH) return;
      // One sign-out per expiry, not one per failed query — several queries
      // failing together would otherwise each fire a redirect.
      if (guard.signingOut) return;
      guard.signingOut = true;

      // Cancel before clearing. `clear()` drops cached data while observers
      // are still mounted, so they immediately refetch — with a dead session
      // that means another 401, which lands right back here.
      await client.cancelQueries();
      guard.navigate(LOGIN_PATH);
      await getSupabaseClient().auth.signOut();
      client.clear();
    };

    const client = new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: {
        queries: {
          // Prescription counts and QR tokens go stale fast; never serve
          // cached data as if it were current.
          staleTime: 0,
          refetchOnWindowFocus: true,
          retry: 1,
        },
      },
    });

    return client;
  });

  useEffect(() => {
    guard.pathname = pathname;
    guard.navigate = (path) => router.replace(path);
    // Landing on the login screen completes the sign-out; re-arm the guard so
    // the next expiry is handled.
    if (pathname === LOGIN_PATH) guard.signingOut = false;
  }, [pathname, router]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
