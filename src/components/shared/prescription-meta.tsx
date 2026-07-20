"use client";

import { TxHash } from "@/components/shared/tx-hash";
import type { PrescriptionEvent, PrescriptionStatus } from "@/lib/types";

/**
 * Status styling. Revoked and expired prescriptions stay visible on purpose —
 * the audit trail is the point, so hiding them would defeat it.
 */
const STATUS: Record<PrescriptionStatus, { label: string; className: string }> =
  {
    active: { label: "Active", className: "bg-success-surface text-success-text" },
    fully_dispensed: {
      label: "Fully dispensed",
      className: "bg-surface-sunken text-text-muted",
    },
    revoked: { label: "Revoked", className: "bg-danger-surface text-danger-text" },
    expired: { label: "Expired", className: "bg-warning-surface text-warning-text" },
  };

export function StatusPill({ status }: { status: PrescriptionStatus }) {
  const style = STATUS[status] ?? {
    label: status,
    className: "bg-surface-sunken text-text-muted",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}

/** Three event types, not two — a burn is one fill spent, a revoke voids all. */
const EVENT_LABEL: Record<PrescriptionEvent["event_type"], string> = {
  mint: "Issued",
  burn: "Dispensed",
  revoke: "Revoked by doctor",
};

/** "12 Mar 2026 at 14:22" — enough to cite a specific fill. */
export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })} at ${date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * The chain trail. This is the receipt: it turns "this prescription was already
 * filled" from an assertion into something a sceptic can verify themselves.
 *
 * Each row links out only once the explorer can actually resolve the hash —
 * `TxHash` handles that from the event's own server-side timestamp.
 */
export function EventTrail({ events }: { events: PrescriptionEvent[] }) {
  if (events.length === 0) return null;

  return (
    <ul className="space-y-1.5">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs font-medium text-text-strong">
            {EVENT_LABEL[event.event_type] ?? event.event_type}
          </span>
          <span className="text-xs text-text-muted">
            {formatDateTime(event.created_at)}
          </span>
          {event.tx_hash ? (
            <TxHash
              hash={event.tx_hash}
              label=""
              submittedAt={event.created_at}
            />
          ) : (
            // No tx for an action the chain couldn't carry — revoking past
            // expiry, where the policy's time-lock already forbids any burn.
            <span className="text-xs text-text-muted">no on-chain burn</span>
          )}
        </li>
      ))}
    </ul>
  );
}
