"use client";

import { useCallback, useState } from "react";
import { DoctorPrescriptionList } from "@/components/doctor/doctor-prescription-list";
import { MintedPanel } from "@/components/doctor/minted-panel";
import { PrescribeForm } from "@/components/doctor/prescribe-form";
import { PatientContextBar } from "@/components/shared/patient-context-bar";
import { ScanPanel } from "@/components/shared/scan-panel";
import type { Prescription, ScanResult } from "@/lib/types";

export default function DoctorHome() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [minted, setMinted] = useState<Prescription | null>(null);
  const onScanned = useCallback((result: ScanResult) => setScan(result), []);

  // No patient in hand: scan for one, and meanwhile show what this doctor has
  // already written — that list is where revoke lives.
  if (!scan) {
    return (
      <div className="space-y-4">
        <ScanPanel onScanned={onScanned} />
        <DoctorPrescriptionList />
      </div>
    );
  }

  function clearPatient() {
    setScan(null);
    setMinted(null);
  }

  return (
    <div className="space-y-4">
      <PatientContextBar scan={scan} onClear={clearPatient} />
      {minted ? (
        <MintedPanel
          prescription={minted}
          patientName={scan.patient.full_name}
          onDone={() => setMinted(null)}
        />
      ) : (
        <PrescribeForm patient={scan.patient} onMinted={setMinted} />
      )}
    </div>
  );
}
