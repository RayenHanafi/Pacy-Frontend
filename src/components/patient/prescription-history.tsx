"use client";

import {
  EventTrail,
  MedicineList,
  StatusPill,
} from "@/components/shared/prescription-meta";
import { formatDate } from "@/components/shared/tx-hash";
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
import type { Prescription } from "@/lib/types";

function PrescriptionCard({ prescription }: { prescription: Prescription }) {
  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <MedicineList details={prescription.drug_details} showDiagnosis />
        <StatusPill status={prescription.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="tabular">
          {prescription.uses_remaining} of {prescription.max_uses} fills left
        </Badge>
        <Badge variant="outline">{formatDate(prescription.expires_at)}</Badge>
      </div>

      {prescription.events?.length ? (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <EventTrail events={prescription.events} />
        </div>
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
