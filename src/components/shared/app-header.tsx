"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
    <header className="border-b border-border-subtle bg-surface-raised">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        {/* Wordmark placeholder — swap for /logo.svg when it exists. */}
        <span className="font-display text-lg font-bold text-text-strong">
          Pacy
        </span>
        <Badge variant="secondary">{roleLabel[me.role]}</Badge>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-text-muted sm:inline">
            {me.full_name}
          </span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
