"use client";

import { RequireRole } from "@/components/auth/require-role";
import { AppHeader } from "@/components/shared/app-header";

/** Desktop shell — pharmacy counter workstation. */
export default function PharmacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireRole role="pharmacy">
      {(me) => (
        <div className="flex min-h-full flex-col">
          <AppHeader me={me} />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            {children}
          </main>
        </div>
      )}
    </RequireRole>
  );
}
