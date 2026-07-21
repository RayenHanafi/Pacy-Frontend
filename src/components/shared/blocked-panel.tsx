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
  DOCTOR_KEY_NOT_ENROLLED: {
    title: "Signing not set up on this device",
    body: "Prescriptions must be signed with your own key before they can be minted. Set up signing to continue — nothing was written.",
  },
  INVALID_DOCTOR_SIGNATURE: {
    // Almost always means this device's key is no longer the active one —
    // the doctor enrolled elsewhere since. Re-enrolling on this device fixes
    // it. Deliberately not retryable: a prescription that fails to sign must
    // not be written, and retrying the same signature can't help.
    title: "Signature didn't verify",
    body: "This device's signing key doesn't match the one on record — it's usually because signing was set up on another device since. Set up signing again here. Nothing was written.",
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
  patientName,
  emphasis = false,
  fallbackTitle = "Couldn't dispense",
}: {
  error: unknown;
  onRetry?: () => void;
  /**
   * Heading for codes with no copy of their own. Defaults to the pharmacy
   * wording because that's where most blocked states occur — every other
   * caller must pass its own verb. A doctor being told a prescription
   * "couldn't be dispensed" reads as a broken app.
   */
  fallbackTitle?: string;
  /** Whose prescription was refused — shown so the refusal is unambiguous. */
  patientName?: string;
  /**
   * Turn the refusal into the loudest thing on screen. Used where a refusal is
   * the expected, correct outcome rather than a mishap — the pharmacy trying
   * to re-dispense a spent prescription.
   */
  emphasis?: boolean;
}) {
  const code = error instanceof ApiError ? error.code : undefined;
  const copy = code ? BLOCKED_COPY[code] : undefined;

  const title = copy?.title ?? fallbackTitle;
  const body =
    copy?.body ??
    (error instanceof Error ? error.message : "Something went wrong.");
  // The server's own words, kept distinct from our pharmacist-facing copy:
  // this is the part that proves the refusal came from the backend and not
  // from a client-side guard we wrote.
  const serverMessage =
    error instanceof ApiError && error.message !== body ? error.message : null;

  return (
    <div
      className={
        emphasis
          ? "rounded-lg border-2 border-danger bg-danger-surface p-5"
          : "rounded-lg border border-danger/40 bg-danger-surface p-4"
      }
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={
            emphasis
              ? "mt-2 size-3 shrink-0 rounded-full bg-danger"
              : "mt-1 size-2 shrink-0 rounded-full bg-danger"
          }
        />
        <div className="space-y-1">
          <p
            className={
              emphasis
                ? "font-display text-xl font-semibold text-danger-text"
                : "font-medium text-danger-text"
            }
          >
            {title}
          </p>
          {patientName ? (
            <p className="text-sm font-medium text-foreground">
              {patientName}
            </p>
          ) : null}
          <p className="text-sm text-foreground">{body}</p>
          {serverMessage ? (
            <p className="pt-1 text-sm italic text-text-muted">
              Server: &ldquo;{serverMessage}&rdquo;
            </p>
          ) : null}
          {code ? (
            <p
              className={
                emphasis
                  ? "pt-1 font-mono text-sm font-medium text-danger-text"
                  : "pt-1 font-mono text-xs text-text-muted"
              }
            >
              {code}
            </p>
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
