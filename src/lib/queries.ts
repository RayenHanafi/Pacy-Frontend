"use client";

import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  CreatePrescriptionBody,
  HealthResponse,
  Me,
  PatientPrescriptionsResponse,
  Prescription,
  QrToken,
  ScanResult,
} from "./types";

/** Query keys in one place so invalidation can't drift from fetching. */
export const queryKeys = {
  me: ["me"] as const,
  health: ["health"] as const,
  qrToken: ["patient", "qr-token"] as const,
  currentScan: ["stations", "current-scan"] as const,
  patientPrescriptions: ["patient", "prescriptions"] as const,
};

/**
 * The role authority. Everything role-gated waits on this — never on JWT
 * claims or anything cached client-side (CLAUDE.md rule 5).
 */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<Me>("/me"),
    // Identity doesn't change mid-session; don't refetch it on every focus.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * The patient's rotating QR token.
 *
 * The 30s expiry is enforced server-side (an expired token is rejected 422),
 * so we refetch at 25s — the code must never be dead while it's on screen and
 * a patient is holding the phone up to a scanner.
 */
export function useQrToken({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.qrToken,
    queryFn: () => api<QrToken>("/patient/qr-token"),
    refetchInterval: 25_000,
    // Keep rotating even if the phone is backgrounded, so returning to the
    // app doesn't show a stale code for the moment before the next tick.
    refetchIntervalInBackground: true,
    staleTime: 0,
    enabled,
  });
}

/**
 * IoT polling path: the station POSTs the scan, we poll for the result.
 * Resolves to `undefined` on 204 — "no patient at the station yet."
 *
 * Only poll while the waiting screen is actually on screen; `enabled` should
 * go false the moment a patient is in hand, or the next poll will clobber the
 * operator's context mid-task.
 */
export function useCurrentScan({ enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: queryKeys.currentScan,
    queryFn: () => api<ScanResult>("/stations/current-scan"),
    refetchInterval: 1_500,
    refetchIntervalInBackground: false,
    staleTime: 0,
    enabled,
    retry: false,
  });
}

/**
 * Camera fallback: we decode the QR in-browser and exchange it for patient
 * context inline — no polling, works on a laptop with no hardware present.
 */
export function useScanQrToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (qr_token: string) =>
      api<ScanResult>("/scan", { method: "POST", json: { qr_token } }),
    onSuccess: (result) => {
      // Seed the polling cache so both paths converge on one source of truth.
      queryClient.setQueryData(queryKeys.currentScan, result);
    },
  });
}

/** The patient's full history, including revoked entries, for audit clarity. */
export function usePatientPrescriptions() {
  return useQuery({
    queryKey: queryKeys.patientPrescriptions,
    queryFn: async () =>
      (await api<PatientPrescriptionsResponse>("/patient/prescriptions"))
        ?.prescriptions ?? [],
  });
}

/** Doctor: mint. */
export function useCreatePrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePrescriptionBody) =>
      api<Prescription>("/prescriptions", { method: "POST", json: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.patientPrescriptions,
      });
    },
  });
}

/**
 * Pharmacy: burn one fill.
 *
 * `retry: false` is load-bearing, not a default. A dispense takes 12–16s
 * against the real chain; an automatic retry on a slow response would burn a
 * second fill the patient never received.
 */
export function useDispense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prescriptionId: string) =>
      api<Prescription>(`/prescriptions/${prescriptionId}/dispense`, {
        method: "POST",
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.currentScan });
      queryClient.invalidateQueries({
        queryKey: queryKeys.patientPrescriptions,
      });
    },
  });
}

/** Doctor: burn ALL remaining fills at once. Only the prescribing doctor. */
export function useRevoke() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prescriptionId: string) =>
      api<Prescription>(`/prescriptions/${prescriptionId}/revoke`, {
        method: "POST",
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.patientPrescriptions,
      });
    },
  });
}

/** Connectivity smoke test — is the backend up and configured? */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api<HealthResponse>("/health", { anonymous: true }),
    retry: false,
  });
}
