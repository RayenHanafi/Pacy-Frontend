"use client";

import { useLocalSigningKey, useMe, useSigningKeyStatus } from "./queries";

/**
 * Resolves the backend's decision table into one value the UI can switch on.
 *
 * - `loading` — still resolving; show nothing rather than a wrong prompt
 * - `error`   — couldn't establish key state. Prescribing is blocked, on
 *               purpose: an unsigned prescription is refused server-side, so
 *               offering the form would only produce a confusing 400. Fail
 *               closed and say so.
 * - `enrol`   — no key on the server. A setup step, not an error
 * - `reenrol` — the server has a key this device doesn't hold, or holds a
 *               different one. New or lost device; the copy must reassure
 * - `ready`   — fingerprints agree; sign and carry on
 *
 * There is deliberately no "signing unavailable, prescribe unsigned" state.
 * An earlier version had one to bridge the backend deploy, and it was a
 * liability the moment signing went live: it turns a transient failure into
 * silently prescribing something the server will reject.
 */
export type SigningGate =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "enrol" }
  | { state: "reenrol" }
  | { state: "ready"; fingerprint: string };

export function useSigningGate(): SigningGate {
  const { data: me } = useMe();
  const status = useSigningKeyStatus();
  const local = useLocalSigningKey(me?.id);

  if (!me || status.isPending) return { state: "loading" };

  if (status.isError) {
    return {
      state: "error",
      message:
        status.error instanceof Error
          ? status.error.message
          : "Couldn't check your signing key.",
    };
  }

  const server = status.data;
  if (!server?.enrolled) return { state: "enrol" };

  if (local.isPending) return { state: "loading" };

  const localFingerprint = local.data?.fingerprint ?? null;
  if (!localFingerprint || localFingerprint !== server.fingerprint) {
    return { state: "reenrol" };
  }

  return { state: "ready", fingerprint: localFingerprint };
}
