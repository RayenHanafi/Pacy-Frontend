"use client";

import { useCallback, useState } from "react";
import { PrescribeForm } from "@/components/doctor/prescribe-form";
import { PatientContextBar } from "@/components/shared/patient-context-bar";
import { ScanPanel } from "@/components/shared/scan-panel";
import type { ScanResult } from "@/lib/types";

export default function DoctorHome() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const onScanned = useCallback((result: ScanResult) => setScan(result), []);

  if (!scan) {
    return <ScanPanel onScanned={onScanned} />;
  }

  return (
    <div className="space-y-4">
      <PatientContextBar scan={scan} onClear={() => setScan(null)} />
      <PrescribeForm patient={scan.patient} onMinted={() => {}} />
    </div>
  );
}
