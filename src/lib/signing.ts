/**
 * Doctor signing keys.
 *
 * A prescription is signed in the doctor's browser with a private key that
 * never leaves the device, so the backend cannot mint a prescription no doctor
 * wrote. The key is generated non-extractable: JavaScript can sign with it but
 * can never read its bytes, so even an XSS bug can't exfiltrate it.
 *
 * That property is the whole point, which is why there is deliberately no
 * export, backup or sync here. An exportable key is a copyable key. Losing a
 * device means re-enrolling, and old prescriptions stay verifiable because the
 * backend retains every key it has seen.
 */

const DB_NAME = "pacy";
const STORE = "signing-keys";

/** ECDSA P-256 — chosen over Ed25519 for WebCrypto support on older phones. */
const ALGORITHM = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_PARAMS = { name: "ECDSA", hash: "SHA-256" } as const;

export class SigningUnavailableError extends Error {
  constructor() {
    super(
      "This browser can't create a signing key. Prescription signing needs a secure connection (https:// or localhost).",
    );
    this.name = "SigningUnavailableError";
  }
}

/**
 * WebCrypto's subtle API only exists in a secure context. Notably absent when
 * a dev server is reached over a LAN IP rather than localhost.
 */
export function isSigningAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.crypto?.subtle !== "undefined" &&
    typeof indexedDB !== "undefined"
  );
}

/* ---------------------------------------------------------------- storage */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/**
 * Scoped by user id: a shared clinic workstation with two doctor accounts must
 * never cross-wire keys.
 */
function storageKey(doctorUserId: string): string {
  return `pacy.signingKey.${doctorUserId}`;
}

/**
 * The whole pair is stored, not just the private key — the public half is
 * needed to recompute the fingerprint and check it still matches the server's.
 * `CryptoKey` survives IndexedDB's structured clone; localStorage can't hold
 * it at all.
 */
async function loadPair(doctorUserId: string): Promise<CryptoKeyPair | null> {
  if (!isSigningAvailable()) return null;
  try {
    const stored = await idbRequest<CryptoKeyPair | undefined>("readonly", (s) =>
      s.get(storageKey(doctorUserId)),
    );
    return stored ?? null;
  } catch {
    // A blocked or unavailable IndexedDB is indistinguishable from "no key" as
    // far as the caller is concerned: either way we must enrol.
    return null;
  }
}

async function storePair(
  doctorUserId: string,
  pair: CryptoKeyPair,
): Promise<void> {
  await idbRequest("readwrite", (s) => s.put(pair, storageKey(doctorUserId)));
}

/* -------------------------------------------------------------- encoding */

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * First 16 hex chars of sha256(spki). This is what a doctor reads to confirm
 * two devices hold the same key without understanding any of the cryptography.
 */
async function fingerprintOf(spki: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", spki);
  return toHex(digest).slice(0, 16);
}

/* ------------------------------------------------------- canonicalisation */

/**
 * Ported verbatim from the backend's `src/lib/hash.ts`. Recursive key sort,
 * `undefined` dropped.
 *
 * DO NOT "improve" this, reformat it, or swap in a canonical-JSON library.
 * The backend recomputes this exact string and verifies the signature over it;
 * a one-byte difference fails the mint with INVALID_DOCTOR_SIGNATURE and looks
 * like a mystery.
 */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortDeep(v)]));
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

/* ------------------------------------------------------------ public API */

export interface LocalKeyState {
  /** Null when this device holds no key for this doctor. */
  fingerprint: string | null;
}

/** What this device holds, if anything. */
export async function getLocalKeyState(
  doctorUserId: string,
): Promise<LocalKeyState> {
  const pair = await loadPair(doctorUserId);
  if (!pair) return { fingerprint: null };
  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  return { fingerprint: await fingerprintOf(spki) };
}

export interface GeneratedKey {
  publicKeyB64: string;
  fingerprint: string;
}

/**
 * Generate a keypair, store it, and return the public half for enrolment.
 *
 * `extractable: false` locks the private key only — per the WebCrypto spec the
 * public half of an asymmetric pair is always exportable, which is what lets us
 * enrol it and compute the fingerprint.
 */
export async function generateAndStoreKey(
  doctorUserId: string,
): Promise<GeneratedKey> {
  if (!isSigningAvailable()) throw new SigningUnavailableError();

  const pair = await crypto.subtle.generateKey(ALGORITHM, false, [
    "sign",
    "verify",
  ]);
  await storePair(doctorUserId, pair);

  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  return {
    publicKeyB64: toBase64(spki),
    fingerprint: await fingerprintOf(spki),
  };
}

/** Exactly the five fields the backend reconstructs and verifies over. */
export interface SignedPayload {
  patient_id: string;
  /** The doctor's own user id — absent from the request body, present here. */
  doctor_id: string;
  drug_details: Record<string, unknown>;
  max_uses: number;
  expires_at: string | null;
}

/**
 * Sign the canonical JSON bytes — not a hex digest of them. WebCrypto applies
 * SHA-256 internally, so hashing first would double-hash and fail to verify.
 *
 * ECDSA is non-deterministic: signing the same payload twice yields different
 * signatures and both are valid. Never cache, compare or dedupe on this value.
 */
export async function signPayload(
  doctorUserId: string,
  payload: SignedPayload,
): Promise<string> {
  if (!isSigningAvailable()) throw new SigningUnavailableError();

  const pair = await loadPair(doctorUserId);
  if (!pair) {
    throw new Error("No signing key on this device.");
  }

  const bytes = new TextEncoder().encode(canonicalJson(payload));
  const signature = await crypto.subtle.sign(
    SIGN_PARAMS,
    pair.privateKey,
    bytes,
  );
  return toBase64(signature);
}
