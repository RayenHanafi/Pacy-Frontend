"use client";

import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, CHAIN_TIMEOUT_MS } from "./api";
import { generateAndStoreKey, getLocalKeyState } from "./signing";
import { getSupabaseClient } from "./supabase";
import type {
  CreatePrescriptionBody,
  DoctorPrescriptionsResponse,
  HealthResponse,
  Me,
  PatientPrescriptionsResponse,
  Prescription,
  QrToken,
  ScanResult,
  SigningKeyEnrolment,
  SigningKeyStatus,
} from "./types";

/** Query keys in one place so invalidation can't drift from fetching. */
export const queryKeys = {
  session: ["session"] as const,
  me: ["me"] as const,
  health: ["health"] as const,
  qrToken: ["patient", "qr-token"] as const,
  currentScan: ["stations", "current-scan"] as const,
  patientPrescriptions: ["patient", "prescriptions"] as const,
  doctorPrescriptions: ["doctor", "prescriptions"] as const,
  signingKey: ["doctor", "signing-key"] as const,
  localSigningKey: (userId: string) => ["signing-key", "local", userId] as const,
};

/**
 * Is the browser holding a Supabase session at all?
 *
 * This is *not* the role authority — it answers only "is there a token to
 * send". Being signed out is an ordinary state, not an error, so it must not
 * reach the backend as a 401: that would be indistinguishable from a session
 * that expired mid-use, and would sign the user out of the login page they're
 * already sitting on.
 *
 * Resolves to `null` when signed out, never throws.
 */
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async () => {
      const { data } = await getSupabaseClient().auth.getSession();
      return data.session ? { userId: data.session.user.id } : null;
    },
    retry: false,
  });
}

/**
 * The role authority. Everything role-gated waits on this — never on JWT
 * claims or anything cached client-side (CLAUDE.md rule 5).
 *
 * Stays pending while we don't yet know whether a session exists, and never
 * runs at all without one. Callers that need to react to "signed out" should
 * watch `useSession()`.
 */
export function useMe() {
  const session = useSession();

  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<Me>("/me"),
    // Identity doesn't change mid-session; don't refetch it on every focus.
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: Boolean(session.data),
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

/**
 * The server's view of this doctor's signing key.
 *
 * `refetchOnMount: "always"` is load-bearing. Signing went live mid-session on
 * demo day; a doctor whose tab predated that deploy would otherwise keep an
 * old verdict and prescribe unsigned until a full reload. The answer is cheap
 * and it decides whether prescribing is possible at all, so re-ask every time
 * the dashboard mounts.
 */
export function useSigningKeyStatus() {
  return useQuery({
    queryKey: queryKeys.signingKey,
    queryFn: () => api<SigningKeyStatus>("/doctor/signing-key"),
    refetchOnMount: "always",
    staleTime: 0,
    retry: false,
  });
}

/** What this device holds. Read from IndexedDB, never from the network. */
export function useLocalSigningKey(doctorUserId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.localSigningKey(doctorUserId ?? ""),
    queryFn: () => getLocalKeyState(doctorUserId as string),
    enabled: Boolean(doctorUserId),
    retry: false,
  });
}

/**
 * Generate a keypair on this device and enrol its public half.
 *
 * Also used for re-enrolment on a new or lost device: the server replaces the
 * active key but retains previous ones, so prescriptions already written stay
 * verifiable forever.
 */
export function useEnrolSigningKey(doctorUserId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!doctorUserId) throw new Error("No doctor id.");
      const { publicKeyB64 } = await generateAndStoreKey(doctorUserId);
      return api<SigningKeyEnrolment>("/doctor/signing-key", {
        method: "POST",
        json: { public_key: publicKeyB64 },
      });
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.signingKey });
      queryClient.invalidateQueries({
        queryKey: queryKeys.localSigningKey(doctorUserId ?? ""),
      });
    },
  });
}

/** Everything this doctor has written, newest first, with patient and events. */
export function useDoctorPrescriptions() {
  return useQuery({
    queryKey: queryKeys.doctorPrescriptions,
    queryFn: async () =>
      (await api<DoctorPrescriptionsResponse>("/doctor/prescriptions"))
        ?.prescriptions ?? [],
  });
}

/**
 * Doctor: mint. A real preprod confirmation, 20–60s — no optimistic update is
 * possible here because the tx hash does not exist until the response lands.
 */
export function useCreatePrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePrescriptionBody) =>
      api<Prescription>("/prescriptions", {
        method: "POST",
        json: body,
        timeoutMs: CHAIN_TIMEOUT_MS,
      }),
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
 * Pharmacy: burn one fill.
 *
 * `retry: false` is load-bearing, not a default. A dispense takes 20–60s
 * against the real chain; an automatic retry on a slow response would burn a
 * second fill the patient never received.
 */
export function useDispense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prescriptionId: string) =>
      api<Prescription>(`/prescriptions/${prescriptionId}/dispense`, {
        method: "POST",
        timeoutMs: CHAIN_TIMEOUT_MS,
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
        timeoutMs: CHAIN_TIMEOUT_MS,
      }),
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

/** Connectivity smoke test — is the backend up and configured? */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api<HealthResponse>("/health", { anonymous: true }),
    retry: false,
  });
}
