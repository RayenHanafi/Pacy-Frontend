"use client";

import { TxHash } from "@/components/shared/tx-hash";
import type {
  DrugDetails,
  Medicine,
  PrescriptionEvent,
  PrescriptionStatus,
} from "@/lib/types";

/**
 * A prescription's medicines, tolerant of a row written before `drug_details`
 * became `{ medicines: [...] }`. Seeded demo data may still hold the old flat
 * shape, and a `.map` on `undefined` would blank the whole screen — so read
 * defensively here, once, rather than guarding at five call sites.
 */
export function medicinesOf(details: DrugDetails): Medicine[] {
  if (Array.isArray(details?.medicines)) return details.medicines;
  const legacy = details as unknown as Partial<Medicine>;
  if (typeof legacy?.drug === "string") {
    return [
      {
        drug: legacy.drug,
        dosage: legacy.dosage ?? "",
        instructions: legacy.instructions ?? "",
      },
    ];
  }
  return [];
}

/** "Metformin 500mg" / "Metformin 500mg and 2 others" — for one-line copy. */
export function summariseMedicines(details: DrugDetails): string {
  const medicines = medicinesOf(details);
  if (medicines.length === 0) return "this prescription";
  const [first, ...rest] = medicines;
  if (rest.length === 0) return first.drug;
  return `${first.drug} and ${rest.length} other${rest.length === 1 ? "" : "s"}`;
}

/**
 * The medicines on a script. Always a list, even at one entry — a pharmacist
 * reading only the first line of a two-drug prescription is the failure this
 * shape exists to prevent, so multiples are visually separated, not run together.
 *
 * `showDiagnosis` is off by default: the diagnosis is the doctor's and the
 * patient's, never the dispensing pharmacy's.
 */
export function MedicineList({
  details,
  showDiagnosis = false,
}: {
  details: DrugDetails;
  showDiagnosis?: boolean;
}) {
  const medicines = medicinesOf(details);
  const many = medicines.length > 1;

  return (
    <div className="min-w-0">
      {many ? (
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          {medicines.length} medicines
        </p>
      ) : null}

      <ul className={many ? "space-y-3" : undefined}>
        {medicines.map((medicine, index) => (
          <li
            key={`${medicine.drug}-${index}`}
            className={many ? "border-l-2 border-brand/30 pl-3" : undefined}
          >
            <p className="font-medium text-text-strong">{medicine.drug}</p>
            {medicine.dosage ? (
              <p className="text-sm text-text-muted">{medicine.dosage}</p>
            ) : null}
            {medicine.instructions ? (
              <p className="mt-0.5 text-sm text-foreground">
                {medicine.instructions}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {showDiagnosis && details.diagnosis ? (
        <p className="mt-2 text-sm text-text-muted">
          Diagnosis: {details.diagnosis}
        </p>
      ) : null}
    </div>
  );
}

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
