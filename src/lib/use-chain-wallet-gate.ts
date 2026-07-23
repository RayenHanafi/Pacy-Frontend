"use client";

import { useChainWalletStatus, useLocalChainWallet } from "./chain-queries";
import { useMe } from "./queries";

/**
 * Path A readiness, resolved from the server's allow-list and this device's
 * stored wallet into one value the UI switches on.
 *
 * - `loading` — still resolving
 * - `error`   — couldn't establish state; block rather than guess
 * - `enrol`   — server has no wallet for this user, or this device holds none.
 *               Either way we generate + enrol here (the allow-list just gains
 *               the key). A setup step, not an error
 * - `ready`   — device holds a wallet and the server has it enrolled
 *
 * Unlike the custodial signing gate, a device holding a key the server hasn't
 * seen is NOT a distinct "reenrol" state: the backend allow-list is additive,
 * so re-enrolling the local key is the same POST as first-time enrolment.
 */
export type ChainWalletGate =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "enrol" }
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

  return { state: "ready", keyHash: localKeyHash };
}
