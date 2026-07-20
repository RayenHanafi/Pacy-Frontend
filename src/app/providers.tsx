"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Created in state so each browser session gets one client and hot reloads
  // don't discard the cache.
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
      if (error instanceof ApiError && error.isSessionExpired) {
        await getSupabaseClient().auth.signOut();
        queryClient.clear();
        router.replace("/login");
      }
    };

    const queryClient = new QueryClient({
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

    return queryClient;
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
