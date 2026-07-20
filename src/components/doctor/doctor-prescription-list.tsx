"use client";

import { useState } from "react";
import { canRevoke, RevokeButton } from "@/components/doctor/revoke-button";
import { EventTrail, StatusPill } from "@/components/shared/prescription-meta";
import { formatDate, TxHash } from "@/components/shared/tx-hash";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDoctorPrescriptions } from "@/lib/queries";
import type { Prescription } from "@/lib/types";

function DoctorPrescriptionRow({
  prescription,
}: {
  prescription: Prescription;
}) {
  const [revoked, setRevoked] = useState<Prescription | null>(null);
  const [revokedAt, setRevokedAt] = useState<number | undefined>(undefined);

  // The revoke response is fresher than the list, which won't have refetched
  // yet — show it immediately rather than making the doctor wait for a poll.
  const current = revoked ?? prescription;
  const patientName = current.patient?.full_name ?? "the patient";

  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-text-strong">
            {current.drug_details.drug}
          </p>
          <p className="text-sm text-text-muted">
            {patientName} · {current.drug_details.dosage}
          </p>
        </div>
        <StatusPill status={current.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="tabular">
          {current.uses_remaining} of {current.max_uses} fills left
        </Badge>
        <Badge variant="outline">{formatDate(current.expires_at)}</Badge>
        {current.mint_tx_hash ? (
          <TxHash
            hash={current.mint_tx_hash}
            label="Mint"
            submittedAt={current.created_at}
          />
        ) : null}
      </div>

      {current.events?.length ? (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <EventTrail events={current.events} />
        </div>
      ) : null}

      {revoked ? (
        <div className="mt-3 rounded-lg border border-danger/40 bg-danger-surface p-3">
          <p className="text-sm font-medium text-danger-text">
            Revoked — all remaining fills burned
          </p>
          {revoked.burn_tx_hash ? (
            <div className="pt-1">
              <TxHash
                hash={revoked.burn_tx_hash}
                label="Revoke tx"
                submittedAt={revokedAt}
              />
            </div>
          ) : (
            <p className="pt-1 text-sm text-foreground">
              No on-chain burn — this prescription had already expired. The
              policy&rsquo;s time-lock forbids burning past expiry, so the chain
              had already stopped honouring it.
            </p>
          )}
        </div>
      ) : canRevoke(current) ? (
        <div className="mt-3">
          <RevokeButton
            prescription={current}
            patientName={patientName}
            onRevoked={(result, at) => {
              setRevokedAt(at);
              setRevoked(result);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function DoctorPrescriptionList() {
  const { data, isPending, isError, error } = useDoctorPrescriptions();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-text-strong">
          Prescriptions you&rsquo;ve written
        </CardTitle>
        <CardDescription>
          Newest first. You can revoke any prescription that still has fills
          left — it burns them all on-chain.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {isPending ? (
          <>
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {error instanceof Error
                ? error.message
                : "Couldn't load your prescriptions."}
            </AlertDescription>
          </Alert>
        ) : !data?.length ? (
          <div className="rounded-lg border border-dashed border-border-default bg-surface-sunken px-4 py-10 text-center text-sm text-text-muted">
            You haven&rsquo;t written any prescriptions yet.
          </div>
        ) : (
          data.map((p) => (
            <DoctorPrescriptionRow key={p.id} prescription={p} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
