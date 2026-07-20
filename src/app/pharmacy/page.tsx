"use client";

import { useCallback, useState } from "react";
import { DispenseList } from "@/components/pharmacy/dispense-list";
import { PatientContextBar } from "@/components/shared/patient-context-bar";
import { ScanPanel } from "@/components/shared/scan-panel";
import type { ScanResult } from "@/lib/types";

export default function PharmacyHome() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const onScanned = useCallback((result: ScanResult) => setScan(result), []);

  if (!scan) {
    return <ScanPanel onScanned={onScanned} />;
  }

  return (
    <div className="space-y-4">
      <PatientContextBar scan={scan} onClear={() => setScan(null)} />
      <DispenseList
        prescriptions={scan.prescriptions ?? []}
        recentlyCompleted={scan.recently_completed ?? []}
        patientName={scan.patient.full_name}
      />
    </div>
  );
}
