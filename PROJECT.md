# Pacy — Frontend

> **One prescription. One token. One time.**

Pacy tokenizes prescriptions on Cardano (preprod testnet). Each prescription is a
token: it cannot be forged, cannot be filled more times than the doctor allowed, and
cannot be dispensed after it expires. Every fill burns one unit.

This repository is the **frontend only** — a single Next.js PWA with three role-based
views. It talks to the Pacy backend over HTTP and to Supabase Auth on the client. It
never touches the blockchain or the database directly.

---

## Scope boundary

| Concern | Owner |
| --- | --- |
| Cardano signing, minting, burning | Backend (separate repo) |
| Database (patients, prescriptions, events) | Backend |
| JWT verification, role assignment | Backend (verifies Supabase JWT) |
| Login / signup / session | **This repo** (Supabase Auth client SDK) |
| All UI, routing, role gating | **This repo** |
| QR rendering, camera-based QR scanning | **This repo** |

The frontend holds **no** business truth. It renders what the backend returns.

---

## The three views

### Patient (mobile-first)
- A rotating QR code derived from `GET /patient/qr-token`, refreshed every 30s.
  The code is short-lived by design — a screenshot of it goes stale.
- Prescription history: drug, uses remaining, expiry, and mint/burn events with
  Cardano tx hashes shown as trust signals.

### Doctor (desktop)
- After a patient is identified (scan or lookup), fill a prescription form: drug
  details, dosage, number of allowed fills, expiry (or "no expiry") → submit →
  backend mints a token.
- Read-back of the resulting tx hash so the doctor can see it landed on-chain.

### Pharmacy (desktop)
- After a patient is scanned, see that patient's **active, non-expired**
  prescriptions → dispense → backend burns one unit.
- Expired / exhausted prescriptions are visible but not dispensable, so the
  pharmacist understands *why* they can't fill it.

---

## Scan model

The **primary** scan path is IoT hardware calling `POST /stations/scan` directly —
the web app is not in that loop. The doctor and pharmacy views therefore need a way
to learn "a patient was just scanned at my station."

The web app also offers **browser-camera QR scanning as a fallback** for demo
resilience (no hardware on the table, hardware offline, judge wants to try it).

> **OPEN:** how the web app learns the scan result — poll a backend endpoint,
> subscribe to Supabase Realtime, or manual patient-ID entry. See CLAUDE.md
> "Open questions". Blocking for Phase 4/5.

---

## On-chain vs off-chain framing

The chain is a **guarantee layer**, not a data store:

- On-chain: existence of the prescription token, remaining fill count, expiry
  enforcement, mint/burn history.
- Off-chain (backend DB): patient identity, drug details, everything PII.

**No patient data goes on-chain.** The UI should reflect that: surface tx hashes as
proof-of-integrity badges, never imply that medical details are public.

---

## Constraints

- Solo developer, ~4-day hackathon. Build the smallest thing that demos
  **end-to-end**: doctor mints → patient sees it → pharmacy burns it.
- Deploy target: Vercel.
- Demo runs on **preprod testnet** — say so in the UI footer so nobody thinks this
  is handling real controlled substances.

---

## Related docs

- `ARCHITECTURE.md` — folder layout, data flow, API client, auth wiring
- `CLAUDE.md` — working agreements for AI-assisted development in this repo
