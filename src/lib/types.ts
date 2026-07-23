/**
 * Types mirroring the backend contract.
 *
 * Only shapes the backend has actually confirmed live here. /patient/qr-token,
 * /patient/prescriptions and the scan patient-context are still unconfirmed —
 * they freeze at backend Phase 3 and get typed from real responses, not from
 * guesses (CLAUDE.md rule 6).
 */

/** The only three role values. Lowercase, exactly these — frozen by backend. */
export const ROLES = ["patient", "doctor", "pharmacy"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return (ROLES as readonly unknown[]).includes(value);
}

export type VerificationStatus = "pending" | "verified" | "rejected";

export interface Verification {
  /** "HPCSA" for doctors, "SAPC" for pharmacies — both seen live. */
  body: "HPCSA" | "SAPC";
  registration_number: string;
  status: VerificationStatus;
}

/**
 * GET /me — frozen. The authority on role; never read role from JWT claims,
 * localStorage, or a query param (CLAUDE.md rule 5).
 */
export interface Me {
  id: string;
  role: Role;
  full_name: string;
  /** UUID for doctor/pharmacy — the station they own. Null for patients. */
  station_id: string | null;
  /** Null for patients. */
  verification: Verification | null;
}

/** Stable error envelope, identical across every endpoint. */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Branch on `code`, never on `message` — message text is human-facing copy and
 * will change; codes are the contract.
 */
export type ApiErrorCode =
  | "UNAUTHORIZED" // 401 — session invalid/expired; sign out
  | "FORBIDDEN" // 403 — wrong role for this endpoint
  | "NOT_FOUND" // 404
  | "VALIDATION_ERROR" // 400 — surface on the offending form field
  | "INVALID_QR_TOKEN" // 422 — token aged out; refetch and retry
  // 401, but unreachable from a browser: only returned to an IoT station
  // authenticating with X-Station-Key. Kept for completeness.
  | "INVALID_STATION_KEY"
  | "PRESCRIPTION_EXPIRED" // 409 ─┐
  | "PRESCRIPTION_EXHAUSTED" // 409  ├─ blocked states: the demo moment
  | "PRESCRIPTION_REVOKED" // 409  │
  | "PRESCRIPTION_NOT_ACTIVE" // 409 ─┘
  | "CHAIN_ERROR" // 502 — on-chain submit failed; retryable
  | "INTERNAL_ERROR" // 500
  // 409 — doctor has no active signing key. A setup step, not an error state.
  | "DOCTOR_KEY_NOT_ENROLLED"
  // 422 — signature didn't verify. Never retry silently: a prescription that
  // fails to sign must not be written.
  | "INVALID_DOCTOR_SIGNATURE"
  // --- Path A (decentralized chain wallet) ---
  // 409 — user has no on-chain wallet enrolled. Route to enrolment, then retry.
  | "CHAIN_WALLET_NOT_ENROLLED"
  // 503 — settings UTxO not deployed yet. Transient at first boot; retry.
  | "CHAIN_NOT_INITIALISED";

/**
 * The four codes that mean "the chain refused this dispense." These are the
 * point of the product — render them as an explicit blocked state with the
 * reason, never as a generic error toast.
 */
export const BLOCKED_DISPENSE_CODES = [
  "PRESCRIPTION_EXPIRED",
  "PRESCRIPTION_EXHAUSTED",
  "PRESCRIPTION_REVOKED",
  "PRESCRIPTION_NOT_ACTIVE",
] as const satisfies readonly ApiErrorCode[];

export type BlockedDispenseCode = (typeof BLOCKED_DISPENSE_CODES)[number];

export function isBlockedDispenseCode(
  code: ApiErrorCode,
): code is BlockedDispenseCode {
  return (BLOCKED_DISPENSE_CODES as readonly ApiErrorCode[]).includes(code);
}

/** GET /health — connectivity smoke test. */
export interface HealthResponse {
  status: string;
  service: string;
  network: string; // "preprod"
  configured: Record<string, boolean>;
  timestamp: string;
}

/**
 * Expiry is always an ISO 8601 UTC string, or null for "no expiry". Never
 * epoch. Same format in requests and responses.
 */
export type IsoDateTime = string;
export type Expiry = IsoDateTime | null;

/**
 * GET /patient/qr-token — verified live.
 * `expires_in` is 30 and the expiry is enforced server-side; refetch at ~25s.
 * Render `token` as the QR payload.
 */
export interface QrToken {
  token: string;
  expires_in: number;
  expires_at: IsoDateTime;
}

export interface ScannedPatient {
  id: string;
  full_name: string;
}

/**
 * Shared result of both scan paths — verified live:
 *   POST /scan                  (camera fallback, patient context inline)
 *   GET  /stations/current-scan (IoT polling; 204 when nothing yet)
 *
 * `prescriptions` is present only for pharmacy stations and absent entirely
 * for doctor stations — so it's optional, not nullable.
 */
export interface ScanResult {
  patient: ScannedPatient;
  station_type: "doctor" | "pharmacy";
  scanned_at: IsoDateTime;
  /** Dispensable right now. Pharmacy only. */
  prescriptions?: Prescription[];
  /**
   * Pharmacy only: created in the last 30 days and NOT dispensable —
   * exhausted, revoked or expired. The exact complement of `prescriptions`,
   * so a prescription can never be in both lists and never falls between them.
   * Each row carries its full `events[]`, which is what lets a refusal cite
   * the fill that actually spent it.
   */
  recently_completed?: Prescription[];
}

/** One line on the script. A prescription carries at least one, at most 20. */
export interface Medicine {
  drug: string;
  dosage: string;
  instructions: string;
}

/**
 * One prescription = one token, one expiry, one fill count — but several
 * medicines. `max_uses` and `expires_at` sit on the prescription, not here.
 *
 * Always read `medicines` as a list; there is no single-drug shape any more.
 */
export interface DrugDetails {
  medicines: Medicine[];
  /** Prescription-level and optional. Never render it to a pharmacy. */
  diagnosis?: string;
}

/**
 * Prescription status — all four observed or documented.
 * `fully_dispensed` is what the backend flips to when uses_remaining hits 0.
 */
export type PrescriptionStatus =
  | "active"
  | "fully_dispensed"
  | "revoked"
  | "expired";

export interface PrescriptionEvent {
  id: string;
  /** Null for an action with no on-chain counterpart — e.g. revoking past expiry. */
  tx_hash: string | null;
  actor_role: Role | null;
  /**
   * "revoke" is distinct from "burn": a burn is one fill spent by a pharmacy,
   * a revoke is the doctor voiding every remaining fill at once. Don't collapse
   * them in the UI — the patient needs to see which one happened.
   */
  event_type: "mint" | "burn" | "revoke";
  created_at: IsoDateTime;
}

/**
 * Verified against the live API. The pharmacy scan list returns a *subset*
 * (no patient_id / doctor_id / content_hash / events), so those are optional
 * here rather than modelled as a separate type — one shape, narrower payload.
 */
export interface Prescription {
  id: string;
  patient_id?: string;
  doctor_id?: string;
  drug_details: DrugDetails;
  content_hash?: string;
  max_uses: number;
  uses_remaining: number;
  expires_at: Expiry;
  // Nullable: a row can exist in the database before its mint settles, so
  // never assume the on-chain identity is present. Guard before linking.
  policy_id: string | null;
  asset_name: string | null;
  mint_tx_hash: string | null;
  status: PrescriptionStatus;
  created_at: IsoDateTime;
  /** The mint/burn/revoke audit trail. Absent on the pharmacy dispensable list. */
  events?: PrescriptionEvent[];
  /** Present on POST /prescriptions and GET /doctor/prescriptions. */
  patient?: ScannedPatient;
  /** Present on dispense/revoke responses. Null when revoking an expired one. */
  burn_tx_hash?: string | null;
}

/** GET /patient/prescriptions — note the wrapper object. */
export interface PatientPrescriptionsResponse {
  prescriptions: Prescription[];
}

/**
 * GET /doctor/prescriptions — everything this doctor has written, newest first,
 * each with `patient` and its full `events[]`. Role-guarded but *not*
 * verification-guarded: a doctor whose HPCSA registration lapsed can still read
 * back and revoke what they wrote.
 */
export interface DoctorPrescriptionsResponse {
  prescriptions: Prescription[];
}

/** POST /prescriptions (doctor) — request body. */
export interface CreatePrescriptionBody {
  patient_id: string;
  drug_details: DrugDetails;
  max_uses: number; // int >= 1
  expires_at: Expiry;
  /**
   * Base64 raw (P1363) ECDSA signature over the canonical payload. Omitted
   * only while the backend's signing release is not yet deployed — the older
   * backend ignores the field, so sending it early is safe.
   */
  doctor_signature?: string;
}

/**
 * GET /doctor/signing-key. `enrolled: false` is the whole body when this
 * doctor has never enrolled.
 */
export interface SigningKeyStatus {
  enrolled: boolean;
  fingerprint?: string;
  enrolled_at?: IsoDateTime;
}

/** POST /doctor/signing-key — 201. */
export interface SigningKeyEnrolment {
  fingerprint: string;
  enrolled_at: IsoDateTime;
  /** True when this replaced an existing active key (new or lost device). */
  replaced_previous: boolean;
}

/* ------------------------------------------------------------- Path A ------
 * Decentralized chain-wallet flow. Doctor and pharmacy each hold a Cardano
 * key in the browser; the backend builds unsigned txs they co-sign.
 */

/** GET /chain/wallet. `enrolled: false` is the whole body when not enrolled. */
export interface ChainWalletStatus {
  enrolled: boolean;
  address?: string;
  key_hash?: string;
  role?: Role;
}

/** POST /chain/wallet — request. */
export interface ChainWalletEnrolmentBody {
  address: string;
  key_hash: string;
}

/** POST /chain/wallet — 201. */
export interface ChainWalletEnrolment {
  enrolled: boolean;
  role: Role;
  key_hash: string;
  /** False when the key was already on the allow-list (idempotent re-enrol). */
  added: boolean;
  /** The admin settings-update tx that added the key on-chain. */
  settings_tx: string;
}

/** POST /prescriptions/prepare and /:id/dispense/prepare — 200/201. */
export interface PrepareTxResponse {
  prescription_id: string;
  unsigned_tx: string;
}
