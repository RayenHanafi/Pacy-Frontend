"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CHAIN_TIMEOUT_MS } from "./api";
import {
  generateChainWallet,
  getLocalChainIdentity,
} from "./chain-wallet";
import type {
  ChainWalletEnrolment,
  ChainWalletStatus,
} from "./types";

/**
 * Path A query keys. Namespaced under "chain" so nothing here collides with
 * the custodial hooks in queries.ts.
 */
export const chainKeys = {
  wallet: ["chain", "wallet"] as const,
  localWallet: (userId: string) => ["chain", "wallet", "local", userId] as const,
};

/** The server's view: is this user enrolled in the on-chain allow-list? */
export function useChainWalletStatus() {
  return useQuery({
    queryKey: chainKeys.wallet,
    queryFn: () => api<ChainWalletStatus>("/chain/wallet"),
    refetchOnMount: "always",
    staleTime: 0,
    retry: false,
  });
}

/** What this device holds — read from IndexedDB, never the network. */
export function useLocalChainWallet(userId: string | undefined) {
  return useQuery({
    queryKey: chainKeys.localWallet(userId ?? ""),
    queryFn: () => getLocalChainIdentity(userId as string),
    enabled: Boolean(userId),
    retry: false,
  });
}

/**
 * Generate a wallet on this device and enrol its key hash on-chain.
 *
 * The enrolment writes to the on-chain allow-list via an admin settings-update
 * transaction, so it is SLOW — 20–60s while it confirms. `CHAIN_TIMEOUT_MS`
 * (120s) bounds it; never retry automatically, since a re-enrol of the same
 * key is a no-op but a fresh generate would strand the first key.
 */
export function useEnrolChainWallet(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("No user id.");
      const identity = await generateChainWallet(userId);
      return api<ChainWalletEnrolment>("/chain/wallet", {
        method: "POST",
        json: { address: identity.address, key_hash: identity.keyHash },
        timeoutMs: CHAIN_TIMEOUT_MS,
      });
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chainKeys.wallet });
      queryClient.invalidateQueries({
        queryKey: chainKeys.localWallet(userId ?? ""),
      });
    },
  });
}
