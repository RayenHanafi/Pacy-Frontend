"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEnrolChainWallet } from "@/lib/chain-queries";
import { isChainWalletAvailable } from "@/lib/chain-wallet";
import type { Role } from "@/lib/types";

const VERB: Record<"doctor" | "pharmacy", string> = {
  doctor: "sign the prescriptions you write",
  pharmacy: "sign the prescriptions you dispense",
};

/**
 * Path A enrolment. Generates a Cardano key on this device and writes its hash
 * into the on-chain allow-list — a slow settings transaction, so the pending
 * state must be honest about the 20–60s wait rather than looking hung.
 *
 * Serves first-device enrolment and new-device re-enrolment identically: the
 * backend allow-list is additive, so both are the same action.
 */
export function ChainWalletPanel({
  userId,
  role,
  reactivate = false,
}: {
  userId: string;
  role: Role;
  /**
   * The device already holds a key, but it isn't the one the backend currently
   * requires. Re-enrol to make it current — same key, no new one generated.
   */
  reactivate?: boolean;
}) {
  const enrol = useEnrolChainWallet(userId);
  const available = isChainWalletAvailable();
  const verb = role === "pharmacy" ? VERB.pharmacy : VERB.doctor;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-text-strong">
          {reactivate
            ? "Reactivate signing on this device"
            : "Set up your signing key"}
        </CardTitle>
        <CardDescription>
          {reactivate
            ? `Signing was set up somewhere more recently, so this device isn't active. Reactivate it to ${verb} from here.`
            : `Pacy creates a Cardano key on this device so you can ${verb}. Nobody, including Pacy, can act in your name without it.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border border-brand/40 bg-brand-surface p-4 text-sm text-foreground">
          {reactivate ? (
            <p>
              This uses the key already on this device — nothing new is created,
              and anything you&rsquo;ve already signed stays valid.
            </p>
          ) : (
            <>
              <p>
                The key stays on this device. It needs no funds — you only sign;
                Pacy pays the network fees.
              </p>
              <p className="mt-2 text-text-muted">
                If you change devices you&rsquo;ll set up a new one. Anything
                you&rsquo;ve already signed stays valid.
              </p>
            </>
          )}
        </div>

        {!available ? (
          <Alert variant="destructive">
            <AlertDescription>
              This browser can&rsquo;t create a signing key — it needs a modern
              browser with local storage available.
            </AlertDescription>
          </Alert>
        ) : null}

        {enrol.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {enrol.error instanceof Error
                ? enrol.error.message
                : "Couldn't set up your signing key."}
            </AlertDescription>
          </Alert>
        ) : null}

        {enrol.isPending ? (
          <div className="rounded-lg border border-info/40 bg-info-surface p-4 text-sm text-foreground">
            <p className="font-medium text-info-text">
              Setting up your signing key on-chain…
            </p>
            <p className="mt-1 text-text-muted">
              This writes your key to the ledger and takes 20–60 seconds.
              Don&rsquo;t close this tab.
            </p>
          </div>
        ) : null}

        <Button
          onClick={() => enrol.mutate()}
          disabled={enrol.isPending || !available}
        >
          {enrol.isPending
            ? "Setting up…"
            : reactivate
              ? "Reactivate signing key"
              : "Create signing key"}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Reassurance that this device can sign — no key hash. The raw hash reads as a
 * debug leak on a clinical screen; the operator only needs to know signing is
 * active, not the fingerprint.
 */
export function ChainWalletBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-surface px-2.5 py-1 text-xs font-medium text-success-text">
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
        <path
          d="M13 4.5 6.5 11 3 7.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Signing enabled
    </span>
  );
}
