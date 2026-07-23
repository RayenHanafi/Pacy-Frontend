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
}: {
  userId: string;
  role: Role;
}) {
  const enrol = useEnrolChainWallet(userId);
  const available = isChainWalletAvailable();
  const verb = role === "pharmacy" ? VERB.pharmacy : VERB.doctor;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-text-strong">
          Set up your signing key
        </CardTitle>
        <CardDescription>
          Pacy creates a Cardano key on this device so you can {verb}. Nobody,
          including Pacy, can act in your name without it.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border border-brand/40 bg-brand-surface p-4 text-sm text-foreground">
          <p>
            The key stays on this device. It needs no funds — you only sign;
            Pacy pays the network fees.
          </p>
          <p className="mt-2 text-text-muted">
            If you change devices you&rsquo;ll set up a new one. Anything
            you&rsquo;ve already signed stays valid.
          </p>
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
          {enrol.isPending ? "Setting up…" : "Create signing key"}
        </Button>
      </CardContent>
    </Card>
  );
}

/** The reassurance line once enrolled — short key-hash tail, human-comparable. */
export function ChainWalletBadge({ keyHash }: { keyHash: string }) {
  return (
    <p className="text-xs text-text-muted">
      Signing key{" "}
      <code className="font-mono text-text-default">····{keyHash.slice(-16)}</code>
    </p>
  );
}
