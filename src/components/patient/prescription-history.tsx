"use client";

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
import { usePatientPrescriptions } from "@/lib/queries";
import type { Prescription, PrescriptionStatus } from "@/lib/types";

/**
 * Status styling. Revoked prescriptions stay visible on purpose — the audit
 * trail is the point, so hiding them would defeat it.
 */
const STATUS: Record<PrescriptionStatus, { label: string; className: string }> =
  {
    active: {
      label: "Active",
      className: "bg-success-surface text-success-text",
    },
    fully_dispensed: {
      label: "Fully dispensed",
      className: "bg-surface-sunken text-text-muted",
    },
    revoked: {
      label: "Revoked",
      className: "bg-danger-surface text-danger-text",
    },
    expired: {
      label: "Expired",
      className: "bg-warning-surface text-warning-text",
    },
  };

function PrescriptionCard({ prescription }: { prescription: Prescription }) {
  const status = STATUS[prescription.status] ?? {
    label: prescription.status,
    className: "bg-surface-sunken text-text-muted",
  };

  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-text-strong">
            {prescription.drug_details.drug}
          </p>
          <p className="text-sm text-text-muted">
            {prescription.drug_details.dosage}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <p className="mt-2 text-sm text-foreground">
        {prescription.drug_details.instructions}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="tabular">
          {prescription.uses_remaining} of {prescription.max_uses} fills left
        </Badge>
        <Badge variant="outline">{formatDate(prescription.expires_at)}</Badge>
      </div>

      {prescription.events?.length ? (
        <ul className="mt-3 space-y-1 border-t border-border-subtle pt-3">
          {prescription.events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center gap-2">
              <span className="text-xs capitalize text-text-muted">
                {event.event_type === "mint" ? "Issued" : "Dispensed"}
              </span>
              <TxHash hash={event.tx_hash} label="" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PrescriptionHistory() {
  const { data, isPending, isError, error } = usePatientPrescriptions();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-text-strong">
          Your prescriptions
        </CardTitle>
        <CardDescription>
          Every issue and fill is recorded on-chain.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {isPending ? (
          <>
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
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
            No prescriptions yet. When a doctor issues one, it appears here.
          </div>
        ) : (
          data.map((p) => <PrescriptionCard key={p.id} prescription={p} />)
        )}
      </CardContent>
    </Card>
  );
}
