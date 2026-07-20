"use client";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import type { ApiErrorCode } from "@/lib/types";

/**
 * The demo centrepiece.
 *
 * When the ledger refuses a dispense, that refusal *is* the product working —
 * so it gets a named panel explaining which rule fired, not a generic toast.
 * Copy here is written for a pharmacist, not a developer.
 */
const BLOCKED_COPY: Partial<
  Record<ApiErrorCode, { title: string; body: string; retryable?: boolean }>
> = {
  PRESCRIPTION_EXHAUSTED: {
    title: "No fills remaining",
    body: "Every fill the doctor authorised has already been dispensed. The token is spent — the ledger won't allow another.",
  },
  PRESCRIPTION_EXPIRED: {
    title: "Prescription expired",
    body: "This prescription is past its expiry date and can no longer be dispensed.",
  },
  PRESCRIPTION_REVOKED: {
    title: "Prescription revoked",
    body: "The prescribing doctor revoked this prescription. All remaining fills were burned.",
  },
  PRESCRIPTION_NOT_ACTIVE: {
    title: "Prescription not available",
    body: "This prescription isn't currently dispensable. If someone else was dispensing at the same time, try again.",
    retryable: true,
  },
  CHAIN_ERROR: {
    title: "The chain rejected this",
    body: "Nothing was consumed — no fill was used. It's safe to try again.",
    retryable: true,
  },
  FORBIDDEN: {
    title: "Not permitted",
    body: "This account can't perform that action.",
  },
  NOT_FOUND: {
    title: "Prescription not found",
    body: "This prescription no longer exists.",
  },
};

export function BlockedPanel({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const code = error instanceof ApiError ? error.code : undefined;
  const copy = code ? BLOCKED_COPY[code] : undefined;

  const title = copy?.title ?? "Couldn't dispense";
  const body =
    copy?.body ??
    (error instanceof Error ? error.message : "Something went wrong.");

  return (
    <div className="rounded-lg border border-danger/40 bg-danger-surface p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1 size-2 shrink-0 rounded-full bg-danger"
        />
        <div className="space-y-1">
          <p className="font-medium text-danger-text">{title}</p>
          <p className="text-sm text-foreground">{body}</p>
          {code ? (
            <p className="pt-1 font-mono text-xs text-text-muted">{code}</p>
          ) : null}
        </div>
      </div>

      {copy?.retryable && onRetry ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onRetry}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}
