"use client";

import { RequireRole } from "@/components/auth/require-role";
import { AppHeader } from "@/components/shared/app-header";

/** Mobile-first shell — this view lives on a phone held up to a scanner. */
export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireRole role="patient">
      {(me) => (
        <div className="flex min-h-full flex-col">
          <AppHeader me={me} />
          <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
            {children}
          </main>
        </div>
      )}
    </RequireRole>
  );
}
