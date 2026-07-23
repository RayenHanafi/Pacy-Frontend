"use client";

import { useState } from "react";
import { canRevoke, RevokeButton } from "@/components/doctor/revoke-button";
import { MedicineList } from "@/components/shared/prescription-meta";
import { formatDate, TxHash } from "@/components/shared/tx-hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Prescription } from "@/lib/types";

/** What the doctor sees the moment a mint confirms. */
export function MintedPanel({
  prescription,
  patientName,
  onNextPatient,
  onWriteAnother,
}: {
  prescription: Prescription;
  patientName: string;
  onNextPatient: () => void;
  onWriteAnother: () => void;
}) {
  const [revoked, setRevoked] = useState<Prescription | null>(null);
  const [revokedAt, setRevokedAt] = useState<number | undefined>(undefined);

  const current = revoked ?? prescription;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-text-strong">
          {revoked ? "Prescription revoked" : "Minted on-chain"}
        </CardTitle>
        <CardDescription>
          {revoked
            ? "Every remaining fill was burned. No pharmacy can dispense against this token."
            : `${current.max_uses} fill${current.max_uses === 1 ? "" : "s"} authorised for ${patientName}, enforced by the ledger.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border-subtle p-4">
          <MedicineList details={current.drug_details} showDiagnosis />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="tabular">
              {current.uses_remaining} of {current.max_uses} fills left
            </Badge>
            <Badge variant="outline">{formatDate(current.expires_at)}</Badge>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {current.mint_tx_hash ? (
              <TxHash
                hash={current.mint_tx_hash}
                label="Mint tx"
                submittedAt={current.created_at}
              />
            ) : null}
            {revoked?.burn_tx_hash ? (
              <TxHash
                hash={revoked.burn_tx_hash}
                label="Revoke tx"
                submittedAt={revokedAt}
              />
            ) : null}
          </div>

          {revoked && !revoked.burn_tx_hash ? (
            // Null burn_tx_hash happens in exactly one case: revoking an
            // already-expired prescription. The policy's time-lock forbids any
            // burn past expiry, so the revoke is database-only. Say that rather
            // than leaving a blank where a tx link goes.
            <p className="mt-2 text-sm text-text-muted">
              No on-chain burn — this prescription had already expired. The
              policy&rsquo;s time-lock forbids burning past expiry, so the chain
              had already stopped honouring it.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <Button onClick={onNextPatient}>
            Done — wait for next scan
          </Button>

          <Button variant="outline" onClick={onWriteAnother}>
            Write another for this patient
          </Button>

          {!revoked && canRevoke(current) ? (
            <RevokeButton
              prescription={current}
              patientName={patientName}
              onRevoked={(result, at) => {
                setRevokedAt(at);
                setRevoked(result);
              }}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
