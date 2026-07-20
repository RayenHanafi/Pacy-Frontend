import type { IsoDateTime } from "@/lib/types";

const EXPLORER = "https://preprod.cardanoscan.io/transaction";

/**
 * A tx hash is the trust signal — proof the ledger, not our database, is
 * keeping count. Links out to the preprod explorer so a sceptical judge can
 * verify it independently.
 */
export function TxHash({ hash, label }: { hash: string; label: string }) {
  return (
    <a
      href={`${EXPLORER}/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-info-text underline underline-offset-2 hover:text-brand-strong"
    >
      <span className="text-text-muted">{label}</span>
      <code className="font-mono">
        {hash.slice(0, 8)}…{hash.slice(-6)}
      </code>
    </a>
  );
}

/** Dates are display-only; the backend decides what's expired. */
export function formatDate(value: IsoDateTime | null): string {
  if (!value) return "No expiry";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
