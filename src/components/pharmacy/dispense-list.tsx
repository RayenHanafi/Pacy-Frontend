"use client";

import { useState } from "react";
import { BlockedPanel } from "@/components/shared/blocked-panel";
import {
  EventTrail,
  MedicineList,
  StatusPill,
} from "@/components/shared/prescription-meta";
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
import { useChainDispense } from "@/lib/chain-queries";
import type { Prescription } from "@/lib/types";

/**
 * Which list a row came from — NOT a styling flag.
 *
 * "dispensable": the backend says this can be filled right now. Guard it
 *   properly — disabled at zero fills and for the whole in-flight request, so a
 *   double-click can't burn a fill the patient never received.
 *
 * "completed": already exhausted, revoked or expired. The button stays LIVE on
 *   purpose. Clicking it makes a real request that the server genuinely refuses
 *   with a 409; nothing is staged, and the refusal is the point. Do not "fix"
 *   the live button on a zero-fill row — that is this row's whole reason to
 *   exist. The double-click guard below still applies; only the zero-fill
 *   disable is lifted.
 */
type RowVariant = "dispensable" | "completed";

function PrescriptionRow({
  prescription,
  patientName,
  variant,
  pharmacyUserId,
}: {
  prescription: Prescription;
  patientName: string;
  variant: RowVariant;
  pharmacyUserId: string;
}) {
  const dispense = useChainDispense(pharmacyUserId);
  const [justDispensed, setJustDispensed] = useState<Prescription | null>(null);
  // When we saw the burn submitted — the explorer needs ~20s before it can
  // resolve the hash, so the link stays inert until then.
  const [burnedAt, setBurnedAt] = useState<number | undefined>(undefined);

  const current = justDispensed ?? prescription;
  const completed = variant === "completed";
  const outOfFills = current.uses_remaining <= 0;

  return (
    <div
      className={`rounded-lg border p-4 ${
        completed
          ? "border-border-subtle bg-surface-sunken"
          : "border-border-subtle"
      }`}
    >
      <div className="flex flex-wrap items-start gap-3">
        {/* No diagnosis here — a dispensing pharmacy has no need for it. */}
        <div className="min-w-0 flex-1">
          <MedicineList details={current.drug_details} />
        </div>

        <div className="text-right">
          <p className="tabular text-lg font-semibold text-text-strong">
            {current.uses_remaining}
            <span className="text-sm font-normal text-text-muted">
              {" "}
              of {current.max_uses}
            </span>
          </p>
          <p className="text-xs text-text-muted">fills left</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {completed ? <StatusPill status={current.status} /> : null}
        <Badge variant="secondary">{formatDate(current.expires_at)}</Badge>
        {current.mint_tx_hash ? (
          <TxHash
            hash={current.mint_tx_hash}
            label="Mint"
            submittedAt={current.created_at}
          />
        ) : null}
        {current.burn_tx_hash ? (
          <TxHash
            hash={current.burn_tx_hash}
            label="Burn"
            submittedAt={burnedAt}
          />
        ) : null}
      </div>

      {/* The receipt. On a refused row this is the answer to "how do you know
          it was already filled?" — a real tx, timestamped, independently
          verifiable on the explorer. */}
      {completed && current.events?.length ? (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <EventTrail events={current.events} />
        </div>
      ) : null}

      {dispense.isError ? (
        <div className="mt-3">
          <BlockedPanel
            error={dispense.error}
            onRetry={() => dispense.reset()}
            patientName={patientName}
            emphasis={completed}
          />
        </div>
      ) : null}

      {justDispensed ? (
        <div className="mt-3 rounded-lg border border-success/40 bg-success-surface p-3">
          <p className="text-sm font-medium text-success-text">
            Dispensed — one fill burned on-chain
          </p>
          {justDispensed.burn_tx_hash ? (
            <div className="pt-1">
              <TxHash
                hash={justDispensed.burn_tx_hash}
                label="Burn tx"
                submittedAt={burnedAt}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <Button
        className="mt-3 w-full sm:w-auto"
        variant={completed ? "outline" : "default"}
        // A burn takes 12-16s (measured), most of it waiting on the previous
        // chain write to settle, so the in-flight guard matters on every row.
        // The zero-fill disable applies only to dispensable rows — see the
        // RowVariant comment above before changing this.
        disabled={dispense.isPending || (!completed && outOfFills)}
        onClick={() =>
          dispense.mutate(current.id, {
            onSuccess: (result) => {
              if (!result) return;
              setBurnedAt(Date.now());
              setJustDispensed(result);
            },
          })
        }
      >
        {dispense.isPending
          ? "Writing to Cardano… (~15s)"
          : completed
            ? "Attempt dispense"
            : outOfFills
              ? "No fills remaining"
              : "Dispense one fill"}
      </Button>
    </div>
  );
}

export function DispenseList({
  prescriptions,
  recentlyCompleted,
  patientName,
  pharmacyUserId,
}: {
  prescriptions: Prescription[];
  recentlyCompleted: Prescription[];
  patientName: string;
  pharmacyUserId: string;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-text-strong">
            Dispensable prescriptions
          </CardTitle>
          <CardDescription>
            Anything listed here is valid right now.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {prescriptions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border-default bg-surface-sunken px-4 py-12 text-center text-sm text-text-muted">
              Nothing to dispense for this patient.
            </div>
          ) : (
            prescriptions.map((p) => (
              <PrescriptionRow
                key={p.id}
                prescription={p}
                patientName={patientName}
                variant="dispensable"
                pharmacyUserId={pharmacyUserId}
              />
            ))
          )}
        </CardContent>
      </Card>

      {recentlyCompleted.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-text-strong">
              Recently completed
            </CardTitle>
            <CardDescription>
              Filled, revoked or expired in the last 30 days. Shown so you can
              see a script was already dealt with — attempting one anyway is
              refused by the server, and the ledger would refuse it underneath.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {recentlyCompleted.map((p) => (
              <PrescriptionRow
                key={p.id}
                prescription={p}
                patientName={patientName}
                variant="completed"
                pharmacyUserId={pharmacyUserId}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
