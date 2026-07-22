"use client";

import { useCallback, useState } from "react";
import { DoctorPrescriptionList } from "@/components/doctor/doctor-prescription-list";
import { MintedPanel } from "@/components/doctor/minted-panel";
import { PrescribeForm } from "@/components/doctor/prescribe-form";
import {
  SigningKeyBadge,
  SigningKeyPanel,
} from "@/components/doctor/signing-key-panel";
import { PatientContextBar } from "@/components/shared/patient-context-bar";
import { ScanPanel } from "@/components/shared/scan-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, useMe } from "@/lib/queries";
import { useSigningGate } from "@/lib/use-signing-gate";
import type { Prescription, ScanResult } from "@/lib/types";

export default function DoctorHome() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const gate = useSigningGate();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [minted, setMinted] = useState<Prescription | null>(null);
  const onScanned = useCallback((result: ScanResult) => setScan(result), []);

  function clearPatient() {
    // ScanPanel remounts when scan becomes null. Remove the delivered result
    // first so React Query cannot replay the completed patient from its cache.
    queryClient.removeQueries({ queryKey: queryKeys.currentScan, exact: true });
    setMinted(null);
    setScan(null);
  }

  if (!me || gate.state === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Fail closed rather than offering a form whose submission the server will
  // refuse: without a verified key state we can't know we're able to sign.
  if (gate.state === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Couldn&rsquo;t check your signing key, so prescribing is unavailable.
          {" "}
          {gate.message}
        </AlertDescription>
      </Alert>
    );
  }

  // Blocking: a doctor cannot prescribe without a key. Shown before the
  // scanner so the setup happens once, up front, rather than stranding them
  // with a patient already in the room.
  if (gate.state === "enrol" || gate.state === "reenrol") {
    return (
      <SigningKeyPanel
        doctorUserId={me.id}
        replacing={gate.state === "reenrol"}
      />
    );
  }

  // No patient in hand: scan for one, and meanwhile show what this doctor has
  // already written — that list is where revoke lives.
  if (!scan) {
    return (
      <div className="space-y-4">
        <ScanPanel onScanned={onScanned} />
        {gate.state === "ready" ? (
          <SigningKeyBadge fingerprint={gate.fingerprint} />
        ) : null}
        <DoctorPrescriptionList />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PatientContextBar scan={scan} onClear={clearPatient} />
      {minted ? (
        <MintedPanel
          prescription={minted}
          patientName={scan.patient.full_name}
          onNextPatient={clearPatient}
          onWriteAnother={() => setMinted(null)}
        />
      ) : (
        <PrescribeForm
          patient={scan.patient}
          doctorUserId={me.id}
          onMinted={setMinted}
        />
      )}
    </div>
  );
}
