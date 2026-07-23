"use client";

import { Scanner } from "@yudiel/react-qr-scanner";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useCurrentScan, useScanQrToken } from "@/lib/queries";
import type { ScanResult } from "@/lib/types";

/**
 * "Waiting for a patient" for both doctor and pharmacy stations.
 *
 * Two paths, one shape (verified against the live API):
 *  - IoT station: it POSTs /stations/scan, we poll /stations/current-scan.
 *  - Camera fallback: we decode the QR here and POST /scan for inline context.
 *
 * Polling stops as soon as a patient is in hand — otherwise the next tick would
 * yank the operator's context away mid-prescription.
 */
export function ScanPanel({
  onScanned,
}: {
  onScanned: (result: ScanResult) => void;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");

  const scanMutation = useScanQrToken();

  // The IoT path feeds results through the same handler as the camera.
  const { data: polled } = useCurrentScan({ enabled: !cameraOpen });

  useEffect(() => {
    if (polled) onScanned(polled);
  }, [polled, onScanned]);

  function handleDecode(value: string) {
    setCameraError(null);
    scanMutation.mutate(value, {
      onSuccess: (result) => {
        if (result) {
          setCameraOpen(false);
          onScanned(result);
        }
      },
    });
  }

  const scanError = scanMutation.error;
  const staleQr =
    scanError instanceof ApiError && scanError.isStaleQrToken;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-text-strong">
          Waiting for a patient
        </CardTitle>
        <CardDescription>
          Ask the patient to show their code at the station, or scan it with
          this device&rsquo;s camera.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {cameraOpen ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-border-default">
              <Scanner
                onScan={(codes) => {
                  const value = codes[0]?.rawValue;
                  if (value) handleDecode(value);
                }}
                onError={(err) =>
                  setCameraError(
                    err instanceof Error
                      ? err.message
                      : "Couldn't open the camera.",
                  )
                }
                formats={["qr_code"]}
                constraints={{ facingMode: "environment" }}
                sound={false}
              />
            </div>

            {scanMutation.isPending ? (
              <p className="text-sm text-text-muted">Checking that code…</p>
            ) : null}

            {staleQr ? (
              <Alert>
                <AlertDescription>
                  That code had already expired. Ask the patient to show the
                  current one — it refreshes every 30 seconds.
                </AlertDescription>
              </Alert>
            ) : scanError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {scanError instanceof Error
                    ? scanError.message
                    : "That code didn't work."}
                </AlertDescription>
              </Alert>
            ) : null}

            {cameraError ? (
              <Alert variant="destructive">
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setCameraOpen(false);
                setCameraError(null);
                scanMutation.reset();
              }}
            >
              Stop camera
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center rounded-lg border border-dashed border-border-default bg-surface-sunken px-4 py-12 text-center text-sm text-text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="size-2 animate-pulse rounded-full bg-info-strong" />
                Listening for a scan at your station…
              </span>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCameraOpen(true)}
            >
              Scan with this device&rsquo;s camera
            </Button>

            {/* Fallback when the camera can't read the QR — the same code the
                QR encodes, run through the same /scan endpoint. The patient's
                "Copy code" button provides it; it expires in 30s either way. */}
            <form
              className="flex gap-2 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                const code = manualCode.trim();
                if (code) handleDecode(code);
              }}
            >
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Or paste the patient's code"
                aria-label="Patient code"
              />
              <Button
                type="submit"
                variant="outline"
                disabled={!manualCode.trim() || scanMutation.isPending}
              >
                Go
              </Button>
            </form>

            {!cameraOpen && scanError ? (
              <Alert variant={staleQr ? "default" : "destructive"}>
                <AlertDescription>
                  {staleQr
                    ? "That code had already expired. Ask the patient for the current one."
                    : scanError instanceof Error
                      ? scanError.message
                      : "That code didn't work."}
                </AlertDescription>
              </Alert>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
