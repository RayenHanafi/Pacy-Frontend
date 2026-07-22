"use client";

import { Button } from "@/components/ui/button";
import type { ScanResult } from "@/lib/types";

/**
 * Who you're working on. Sits above every post-scan screen, because acting on
 * the wrong patient is the worst failure this app can have.
 */
export function PatientContextBar({
  scan,
  onClear,
}: {
  scan: ScanResult;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand/40 bg-brand-surface px-4 py-3">
      <div>
        <p className="text-xs text-text-muted">Patient</p>
        <p className="font-medium text-text-strong">{scan.patient.full_name}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        onClick={onClear}
      >
        Done — next patient
      </Button>
    </div>
  );
}
