"use client";

/**
 * Path A bare round-trip surface (branch only, not linked from anywhere).
 *
 * Exists to prove §1–2 in a real browser: generate a MeshWallet, derive its
 * address and key hash, and enrol it on-chain — independent of the custodial
 * doctor/pharmacy flows, which this route does not touch. Delete before merge,
 * or fold into the real pages once the round-trip is confirmed.
 */

import {
  ChainWalletBadge,
  ChainWalletPanel,
} from "@/components/shared/chain-wallet-panel";
import { useChainWalletStatus, useLocalChainWallet } from "@/lib/chain-queries";
import { useMe } from "@/lib/queries";
import { useChainWalletGate } from "@/lib/use-chain-wallet-gate";

export default function ChainTestPage() {
  const { data: me } = useMe();
  const gate = useChainWalletGate();
  const status = useChainWalletStatus();
  const local = useLocalChainWallet(me?.id);

  if (!me) {
    return <p className="p-6 text-sm text-text-muted">Sign in first.</p>;
  }

  if (me.role === "patient") {
    return (
      <p className="p-6 text-sm text-text-muted">
        Path A is for doctors and pharmacies. Patients hold no wallet.
      </p>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-6">
      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4 text-sm">
        <p className="font-medium text-text-strong">Path A — {me.role}</p>
        <dl className="mt-2 space-y-1 font-mono text-xs text-text-muted">
          <div>gate: {gate.state}</div>
          <div>
            server:{" "}
            {status.isPending
              ? "…"
              : status.data?.enrolled
                ? `enrolled ${status.data.key_hash?.slice(-16)}`
                : "not enrolled"}
          </div>
          <div>
            device:{" "}
            {local.isPending
              ? "…"
              : (local.data?.keyHash?.slice(-16) ?? "no wallet")}
          </div>
        </dl>
      </div>

      {gate.state === "error" ? (
        <div className="rounded-lg border border-danger/40 bg-danger-surface p-4 text-sm text-danger-text">
          {gate.message}
        </div>
      ) : null}

      {gate.state === "enrol" ? (
        <ChainWalletPanel userId={me.id} role={me.role} />
      ) : null}

      {gate.state === "ready" ? (
        <div className="rounded-lg border border-success/40 bg-success-surface p-4">
          <p className="font-medium text-success-text">
            Wallet ready on this device
          </p>
          <div className="pt-1">
            <ChainWalletBadge keyHash={gate.keyHash} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
