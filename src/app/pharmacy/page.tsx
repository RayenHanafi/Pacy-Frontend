"use client";

import { useCallback, useState } from "react";
import { DispenseList } from "@/components/pharmacy/dispense-list";
import {
  ChainWalletBadge,
  ChainWalletPanel,
} from "@/components/shared/chain-wallet-panel";
import { PatientContextBar } from "@/components/shared/patient-context-bar";
import { ScanPanel } from "@/components/shared/scan-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, useMe } from "@/lib/queries";
import { useChainWalletGate } from "@/lib/use-chain-wallet-gate";
import type { ScanResult } from "@/lib/types";

export default function PharmacyHome() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  // Path A: the pharmacy signs burns with their own on-chain key.
  const gate = useChainWalletGate();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const onScanned = useCallback((result: ScanResult) => setScan(result), []);

  function clearPatient() {
    queryClient.removeQueries({ queryKey: queryKeys.currentScan, exact: true });
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

  if (gate.state === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Couldn&rsquo;t check your signing key, so dispensing is unavailable.{" "}
          {gate.message}
        </AlertDescription>
      </Alert>
    );
  }

  // Blocking: a pharmacy can't dispense without an enrolled key. Set it up
  // before the scanner so it doesn't interrupt a patient interaction.
  if (gate.state === "enrol") {
    return <ChainWalletPanel userId={me.id} role="pharmacy" />;
  }

  if (!scan) {
    return (
      <div className="space-y-4">
        <ScanPanel onScanned={onScanned} />
        <ChainWalletBadge keyHash={gate.keyHash} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PatientContextBar scan={scan} onClear={clearPatient} />
      <DispenseList
        prescriptions={scan.prescriptions ?? []}
        recentlyCompleted={scan.recently_completed ?? []}
        patientName={scan.patient.full_name}
        pharmacyUserId={me.id}
      />
    </div>
  );
}
