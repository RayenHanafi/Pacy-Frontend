"use client";

import { QRCodeSVG } from "qrcode.react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useQrToken } from "@/lib/queries";

const WINDOW_SECONDS = 30;

/** Seconds until `expiresAt`, clamped to the 0–30 window. */
function secondsLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.min(WINDOW_SECONDS, ms / 1000));
}

/**
 * The patient's rotating code.
 *
 * The countdown is real: the backend rejects an expired token with 422, so the
 * ring shows the actual server deadline rather than a decorative animation.
 * The query refetches at 25s, so in practice the ring should never reach zero —
 * if it does, the network is slow and we say so instead of showing a dead code.
 */
export function QrCard() {
  const { data, isPending, isError, error, refetch, isFetching } = useQrToken();
  const [remaining, setRemaining] = useState(WINDOW_SECONDS);
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!data?.token) return;
    try {
      await navigator.clipboard.writeText(data.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the QR is still the primary path.
    }
  }

  const expiresAt = data?.expires_at;

  useEffect(() => {
    if (!expiresAt) return;
    // 200ms keeps the ring smooth without being a busy loop.
    const tick = () => setRemaining(secondsLeft(expiresAt));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [expiresAt]);

  const expired = remaining <= 0;
  const progress = remaining / WINDOW_SECONDS;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-text-strong">
          Your prescription code
        </CardTitle>
        <CardDescription>
          Show this to your doctor or pharmacist. It changes every 30 seconds.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isPending ? (
          <Skeleton className="aspect-square w-full rounded-lg" />
        ) : isError ? (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertDescription>
                {error instanceof Error
                  ? error.message
                  : "Couldn't load your code."}
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => refetch()}
            >
              Try again
            </Button>
          </div>
        ) : data ? (
          <>
            <div className="relative flex items-center justify-center rounded-lg border border-border-subtle bg-white p-6">
              {/* White quiet zone and high contrast — scanners are the
                  audience here, not people.

                  Level "L", not "M": the token is a ~250-char JWT, which at
                  "M" produces a very dense QR whose tiny modules a fixed-focus
                  laptop webcam can't resolve off a phone screen. "L" needs a
                  lower version (bigger modules) and the extra error correction
                  buys nothing for a clean on-screen render. Rendered large for
                  the same reason — bigger modules scan from further away. */}
              <QRCodeSVG
                value={data.token}
                size={320}
                level="L"
                bgColor="#ffffff"
                // Near-black, not brand teal: scanners want maximum contrast,
                // and a colored QR is the classic way to make one unreadable.
                fgColor="#10201f"
                className="h-auto w-full max-w-[320px]"
              />

              {expired ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/90 text-sm font-medium text-text-muted">
                  Refreshing…
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={WINDOW_SECONDS}
                aria-valuenow={Math.ceil(remaining)}
                aria-label="Seconds until this code refreshes"
              >
                <div
                  className="h-full rounded-full bg-info-strong transition-[width] duration-200 ease-linear"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <span className="tabular w-16 text-right text-sm text-text-muted">
                {expired ? "…" : `${Math.ceil(remaining)}s`}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-text-muted">
                A screenshot of this code won&rsquo;t work — it expires in 30
                seconds.
              </p>
              {/* Fallback for when the camera can't read the QR — the copied
                  code goes through the same scan endpoint and expires just as
                  fast, so it's no weaker than showing the QR. */}
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs"
                onClick={copyCode}
                disabled={expired}
              >
                {copied ? "Copied" : "Copy code"}
              </Button>
            </div>

            {isFetching ? (
              <span className="sr-only" role="status">
                Refreshing your code
              </span>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
