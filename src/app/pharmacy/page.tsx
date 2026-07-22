"use client";

import { useCallback, useState } from "react";
import { DispenseList } from "@/components/pharmacy/dispense-list";
import { PatientContextBar } from "@/components/shared/patient-context-bar";
import { ScanPanel } from "@/components/shared/scan-panel";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries";
import type { ScanResult } from "@/lib/types";

export default function PharmacyHome() {
  const queryClient = useQueryClient();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const onScanned = useCallback((result: ScanResult) => setScan(result), []);

  function clearPatient() {
    queryClient.removeQueries({ queryKey: queryKeys.currentScan, exact: true });
    setScan(null);
  }

  if (!scan) {
    return <ScanPanel onScanned={onScanned} />;
  }

  return (
    <div className="space-y-4">
      <PatientContextBar scan={scan} onClear={clearPatient} />
      <DispenseList
        prescriptions={scan.prescriptions ?? []}
        recentlyCompleted={scan.recently_completed ?? []}
        patientName={scan.patient.full_name}
      />
    </div>
  );
}
