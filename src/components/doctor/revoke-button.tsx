"use client";

import { BlockedPanel } from "@/components/shared/blocked-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRevoke } from "@/lib/queries";
import type { Prescription } from "@/lib/types";

/**
 * Revoke burns every remaining fill at once and cannot be undone, so it always
 * goes through a confirmation naming the exact count.
 *
 * One component for both revoke sites (the mint confirmation and the doctor's
 * own list) so the confirmation copy and the in-flight guard can't drift apart.
 */
export function RevokeButton({
  prescription,
  patientName,
  onRevoked,
}: {
  prescription: Prescription;
  patientName: string;
  onRevoked: (revoked: Prescription, revokedAt: number) => void;
}) {
  const revoke = useRevoke();

  return (
    <div className="space-y-3">
      {revoke.isError ? (
        <BlockedPanel error={revoke.error} onRetry={() => revoke.reset()} />
      ) : null}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={revoke.isPending}>
            {revoke.isPending ? "Writing to Cardano…" : "Revoke prescription"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this prescription?</AlertDialogTitle>
            <AlertDialogDescription>
              This burns all {prescription.uses_remaining} remaining fill
              {prescription.uses_remaining === 1 ? "" : "s"} of{" "}
              {prescription.drug_details.drug} on-chain. It cannot be undone,
              and {patientName} will see it marked revoked in their history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it active</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                revoke.mutate(prescription.id, {
                  onSuccess: (result) =>
                    result && onRevoked(result, Date.now()),
                })
              }
            >
              Revoke &amp; burn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Revoke only means something while fills remain on-chain. An expired
 * prescription is still revocable — that path is database-only and comes back
 * with `burn_tx_hash: null`, which callers must render honestly.
 */
export function canRevoke(prescription: Prescription): boolean {
  return prescription.status === "active" || prescription.status === "expired";
}
