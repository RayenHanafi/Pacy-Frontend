"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, useSession } from "@/lib/queries";
import { roleHome } from "@/lib/roles";

/**
 * Entry point: send everyone to their role's home. Nobody stays here.
 */
export default function Home() {
  const router = useRouter();
  const session = useSession();
  const { data: me, isError } = useMe();

  // Signed out is an ordinary state, not a failure — go to login without
  // asking the backend a question it can only answer with a 401.
  const signedOut = session.isSuccess && session.data === null;

  useEffect(() => {
    if (signedOut || isError) router.replace("/login");
    else if (me) router.replace(roleHome[me.role]);
  }, [me, isError, signedOut, router]);

  return (
    <main className="mx-auto w-full max-w-sm space-y-4 px-6 py-24">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-48" />
      <span className="sr-only">Loading your account…</span>
    </main>
  );
}
