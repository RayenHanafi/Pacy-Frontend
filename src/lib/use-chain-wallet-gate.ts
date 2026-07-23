"use client";

import { useChainWalletStatus, useLocalChainWallet } from "./chain-queries";
import { useMe } from "./queries";

/**
 * Path A readiness, resolved from the server's allow-list and this device's
 * stored wallet into one value the UI switches on.
 *
 * - `loading`    — still resolving
 * - `error`      — couldn't establish state; block rather than guess
 * - `enrol`      — no usable key on this device (first time, or new device).
 *                  Generate + enrol. A setup step, not an error
 * - `reactivate` — this device HAS a key, but it isn't the one the backend
 *                  currently requires (another device — or a stray enrolment —
 *                  became current since). Re-enrol this device's stored key to
 *                  promote it back; do NOT regenerate. Without this the mint
 *                  signs with a key the tx doesn't require → the witness the
 *                  backend needs is missing (MissingVKeyWitnessesUTXOW)
 * - `ready`      — this device's key matches the backend's current key
 *
 * The hash comparison is the whole point: a local key that merely *exists* is
 * not enough — it must be the key the backend will build the transaction to
 * require.
 */
export type ChainWalletGate =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "enrol" }
  | { state: "reactivate" }
  | { state: "ready"; keyHash: string };

export function useChainWalletGate(): ChainWalletGate {
  const { data: me } = useMe();
  const status = useChainWalletStatus();
  const local = useLocalChainWallet(me?.id);

  if (!me || status.isPending) return { state: "loading" };

  if (status.isError) {
    return {
      state: "error",
      message:
        status.error instanceof Error
          ? status.error.message
          : "Couldn't check your chain wallet.",
    };
  }

  if (!status.data?.enrolled) return { state: "enrol" };

  if (local.isPending) return { state: "loading" };

  // Server enrolled but this device holds nothing (new device) → enrol here.
  const localKeyHash = local.data?.keyHash ?? null;
  if (!localKeyHash) return { state: "enrol" };

  // This device holds a key, but the backend's current key is a different one.
  // Signing now would add the wrong witness — re-enrol to make ours current.
  if (localKeyHash !== status.data.key_hash) return { state: "reactivate" };

  return { state: "ready", keyHash: localKeyHash };
}
