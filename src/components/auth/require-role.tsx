"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/lib/queries";
import { roleHome } from "@/lib/roles";
import type { Me, Role } from "@/lib/types";

/**
 * Route gating for UX, not security — the backend enforces role on every
 * endpoint. This only stops someone landing on a screen that will 403 anyway.
 */
export function RequireRole({
  role,
  children,
}: {
  role: Role;
  children: (me: Me) => React.ReactNode;
}) {
  const router = useRouter();
  const { data: me, isPending, isError } = useMe();

  useEffect(() => {
    if (isError) {
      // A 401 is already handled centrally in Providers (sign out → /login).
      // Anything else here means we couldn't establish identity at all.
      router.replace("/login");
      return;
    }
    if (me && me.role !== role) {
      router.replace(roleHome[me.role]);
    }
  }, [me, isError, role, router]);

  if (isPending || isError || !me || me.role !== role) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return <>{children(me)}</>;
}
