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
import { useEnrolSigningKey } from "@/lib/queries";
import { isSigningAvailable } from "@/lib/signing";

/**
 * Enrolment, and the same flow on a new or replacement device.
 *
 * `replacing` is true when the server already has a key for this doctor but
 * this device holds none (or a stale one). The copy changes because the
 * reassurance a doctor needs is different: they must be told that what they've
 * already written stays valid.
 */
export function SigningKeyPanel({
  doctorUserId,
  replacing,
}: {
  doctorUserId: string;
  replacing: boolean;
}) {
  const enrol = useEnrolSigningKey(doctorUserId);
  const available = isSigningAvailable();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-text-strong">
          {replacing
            ? "Set up signing on this device"
            : "Set up prescription signing"}
        </CardTitle>
        <CardDescription>
          {replacing
            ? "Your signing key lives on the device that created it and can't be copied — that's what makes it trustworthy."
            : "Every prescription you write is signed on this device, so it can be proven it came from you."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border border-brand/40 bg-brand-surface p-4 text-sm text-foreground">
          {replacing ? (
            <p>
              Setting up here creates a new key for this device. Prescriptions
              you&rsquo;ve already written stay valid and verifiable.
            </p>
          ) : (
            <>
              <p>
                Pacy will create a signing key on this device. Nobody —
                including Pacy — can issue a prescription in your name.
              </p>
              <p className="mt-2">
                The key never leaves this device. If you change devices
                you&rsquo;ll set up a new one.
              </p>
            </>
          )}
        </div>

        {!available ? (
          <Alert variant="destructive">
            <AlertDescription>
              This browser can&rsquo;t create a signing key. Signing needs a
              secure connection — open the app over https:// or on localhost.
            </AlertDescription>
          </Alert>
        ) : null}

        {enrol.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {enrol.error instanceof Error
                ? enrol.error.message
                : "Couldn't set up signing."}
            </AlertDescription>
          </Alert>
        ) : null}

        <Button
          onClick={() => enrol.mutate()}
          disabled={enrol.isPending || !available}
        >
          {enrol.isPending ? "Creating key…" : "Create signing key"}
        </Button>
      </CardContent>
    </Card>
  );
}

/** The reassurance line: same key, still this device. */
export function SigningKeyBadge({ fingerprint }: { fingerprint: string }) {
  return (
    <p className="text-xs text-text-muted">
      Signing key{" "}
      <code className="font-mono text-text-default">····{fingerprint}</code>
    </p>
  );
}
