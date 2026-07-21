"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/roles";
import { getSupabaseClient } from "@/lib/supabase";
import type { Me } from "@/lib/types";

export function AppHeader({ me }: { me: Me }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function signOut() {
    await getSupabaseClient().auth.signOut();
    // Clear before navigating — a stale `me` in cache would let the next
    // visitor briefly see the previous user's view.
    queryClient.clear();
    router.replace("/login");
  }

  return (
    // Gradient bar: white text only. Its lightest stop (seagrass) is 3.4:1,
    // so dark text on the right-hand end would fail contrast.
    <header className="brand-gradient text-white">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        {/* Wordmark placeholder — swap for /logo.svg when it exists. */}
        <span className="font-display text-lg font-bold text-white">Pacy</span>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
          {roleLabel[me.role]}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-white/85 sm:inline">
            {me.full_name}
          </span>
          <Button
            size="sm"
            onClick={signOut}
            className="border border-white/40 bg-white/10 text-white hover:bg-white/20"
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
