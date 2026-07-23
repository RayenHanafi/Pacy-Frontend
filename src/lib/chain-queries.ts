"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CHAIN_TIMEOUT_MS } from "./api";
import {
  generateChainWallet,
  getLocalChainIdentity,
  signTransaction,
} from "./chain-wallet";
import { queryKeys } from "./queries";
import type {
  ChainWalletEnrolment,
  ChainWalletStatus,
  CreatePrescriptionBody,
  PrepareTxResponse,
  Prescription,
} from "./types";

/** Prepare body — the same fields as the custodial mint, minus the signature. */
export type PreparePrescriptionInput = Omit<
  CreatePrescriptionBody,
  "doctor_signature"
>;

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

/**
 * Doctor prescribe, Path A: prepare → sign → commit.
 *
 * The backend builds the unsigned mint, this wallet adds the doctor's witness,
 * and the backend co-signs and submits. Signing is local and instant; the two
 * network legs are the slow part, so this is bounded by CHAIN_TIMEOUT_MS and
 * never auto-retried — a retry would re-run prepare and could double-mint the
 * abandoned first record. On a chain error the user re-submits, which re-runs
 * prepare cleanly (the handoff's "re-prepare and retry" done by hand).
 */
export function useChainPrescribe(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PreparePrescriptionInput) => {
      if (!userId) throw new Error("No user id.");
      const prepared = await api<PrepareTxResponse>("/prescriptions/prepare", {
        method: "POST",
        json: input,
        timeoutMs: CHAIN_TIMEOUT_MS,
      });
      if (!prepared) throw new Error("Prepare returned no transaction.");

      const signedTx = await signTransaction(userId, prepared.unsigned_tx);

      const result = await api<Prescription>("/prescriptions/commit", {
        method: "POST",
        json: {
          prescription_id: prepared.prescription_id,
          signed_tx: signedTx,
        },
        timeoutMs: CHAIN_TIMEOUT_MS,
      });
      if (!result) throw new Error("Commit returned no prescription.");
      return result;
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.patientPrescriptions,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.doctorPrescriptions,
      });
    },
  });
}

/**
 * Pharmacy dispense, Path A: prepare → sign → commit.
 *
 * Same two-step shape as prescribe. `retry: false` is load-bearing: a burn
 * spends a fill, and an auto-retry on a slow commit could burn a second one
 * the patient never received.
 */
export function useChainDispense(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prescriptionId: string) => {
      if (!userId) throw new Error("No user id.");
      const prepared = await api<PrepareTxResponse>(
        `/prescriptions/${prescriptionId}/dispense/prepare`,
        { method: "POST", timeoutMs: CHAIN_TIMEOUT_MS },
      );
      if (!prepared) throw new Error("Prepare returned no transaction.");

      const signedTx = await signTransaction(userId, prepared.unsigned_tx);

      const result = await api<Prescription>(
        `/prescriptions/${prescriptionId}/dispense/commit`,
        {
          method: "POST",
          json: { signed_tx: signedTx },
          timeoutMs: CHAIN_TIMEOUT_MS,
        },
      );
      if (!result) throw new Error("Commit returned no prescription.");
      return result;
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.currentScan });
      queryClient.invalidateQueries({
        queryKey: queryKeys.patientPrescriptions,
      });
    },
  });
}
