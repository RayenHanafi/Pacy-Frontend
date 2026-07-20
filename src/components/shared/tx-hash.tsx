"use client";

import { useEffect, useState } from "react";
import type { IsoDateTime } from "@/lib/types";

const EXPLORER = "https://preprod.cardanoscan.io/transaction";

/**
 * How long a submitted tx takes to become findable on the explorer.
 *
 * The backend resolves a chain write as soon as the node *accepts* the
 * submission, not when it settles — so the hash exists in our response before
 * Cardanoscan will serve it, and a link clicked too early 404s. The backend
 * puts that window at ~20s; we hold the link a little longer so a sceptical
 * judge clicking the instant it appears never sees a dead page.
 */
const CONFIRMATION_MS = 25_000;

/** ms elapsed since `at`, clamped so clock skew can't produce nonsense. */
function elapsedSince(at: IsoDateTime | number): number {
  const started = typeof at === "number" ? at : new Date(at).getTime();
  if (!Number.isFinite(started)) return CONFIRMATION_MS;
  return Math.min(Math.max(Date.now() - started, 0), CONFIRMATION_MS);
}

/**
 * A tx hash is the trust signal — proof the ledger, not our database, is
 * keeping count. Links out to the preprod explorer so a sceptical judge can
 * verify it independently.
 *
 * Pass `submittedAt` for a transaction we just watched happen; the link stays
 * inert and labelled "pending confirmation" until the explorer can resolve it.
 * Omit it for historical hashes — anything already in the record has settled.
 */
export function TxHash({
  hash,
  label,
  submittedAt,
}: {
  hash: string;
  label: string;
  submittedAt?: IsoDateTime | number;
}) {
  const [pending, setPending] = useState(
    () => submittedAt !== undefined && elapsedSince(submittedAt) < CONFIRMATION_MS,
  );

  useEffect(() => {
    if (!pending || submittedAt === undefined) return;
    const remaining = CONFIRMATION_MS - elapsedSince(submittedAt);
    const timer = setTimeout(() => setPending(false), remaining);
    return () => clearTimeout(timer);
  }, [pending, submittedAt]);

  const short = `${hash.slice(0, 8)}…${hash.slice(-6)}`;

  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
        <span>{label}</span>
        <code className="font-mono">{short}</code>
        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px]">
          pending confirmation
        </span>
      </span>
    );
  }

  return (
    <a
      href={`${EXPLORER}/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-info-text underline underline-offset-2 hover:text-brand-strong"
    >
      <span className="text-text-muted">{label}</span>
      <code className="font-mono">{short}</code>
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
