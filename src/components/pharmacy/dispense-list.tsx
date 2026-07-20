"use client";

import { useState } from "react";
import { BlockedPanel } from "@/components/shared/blocked-panel";
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
import { useDispense } from "@/lib/queries";
import type { Prescription } from "@/lib/types";

function PrescriptionRow({ prescription }: { prescription: Prescription }) {
  const dispense = useDispense();
  const [justDispensed, setJustDispensed] = useState<Prescription | null>(null);

  const current = justDispensed ?? prescription;
  const exhausted = current.uses_remaining <= 0;

  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text-strong">
            {current.drug_details.drug}
          </p>
          <p className="text-sm text-text-muted">{current.drug_details.dosage}</p>
          <p className="mt-1 text-sm text-foreground">
            {current.drug_details.instructions}
          </p>
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
        <Badge variant="secondary">{formatDate(current.expires_at)}</Badge>
        {exhausted ? <Badge variant="outline">Fully dispensed</Badge> : null}
        <TxHash hash={current.mint_tx_hash} label="Mint" />
        {current.burn_tx_hash ? (
          <TxHash hash={current.burn_tx_hash} label="Burn" />
        ) : null}
      </div>

      {dispense.isError ? (
        <div className="mt-3">
          <BlockedPanel
            error={dispense.error}
            onRetry={() => dispense.reset()}
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
              <TxHash hash={justDispensed.burn_tx_hash} label="Burn tx" />
            </div>
          ) : null}
        </div>
      ) : null}

      <Button
        className="mt-3 w-full sm:w-auto"
        // Disabled for the whole request: a burn takes 12-16s against the real
        // chain, and a double-submit would consume a fill the patient never got.
        disabled={dispense.isPending || exhausted}
        onClick={() =>
          dispense.mutate(current.id, {
            onSuccess: (result) => result && setJustDispensed(result),
          })
        }
      >
        {dispense.isPending
          ? "Burning on-chain… (up to 20s)"
          : exhausted
            ? "No fills remaining"
            : "Dispense one fill"}
      </Button>
    </div>
  );
}

export function DispenseList({
  prescriptions,
}: {
  prescriptions: Prescription[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-text-strong">
          Dispensable prescriptions
        </CardTitle>
        <CardDescription>
          Expired, exhausted and revoked prescriptions are filtered out by the
          backend — anything listed here is valid right now.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {prescriptions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-surface-sunken px-4 py-12 text-center text-sm text-text-muted">
            Nothing to dispense for this patient.
          </div>
        ) : (
          prescriptions.map((p) => (
            <PrescriptionRow key={p.id} prescription={p} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
