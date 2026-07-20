"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/lib/queries";
import { roleHome } from "@/lib/roles";

/**
 * Entry point: send everyone to their role's home. Nobody stays here.
 */
export default function Home() {
  const router = useRouter();
  const { data: me, isPending, isError } = useMe();

  useEffect(() => {
    if (isError) router.replace("/login");
    else if (me) router.replace(roleHome[me.role]);
  }, [me, isError, router]);

  return (
    <main className="mx-auto w-full max-w-sm space-y-4 px-6 py-24">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-48" />
      <span className="sr-only">
        {isPending ? "Loading your account…" : "Redirecting…"}
      </span>
    </main>
  );
}
