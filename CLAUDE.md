# CLAUDE.md — Pacy Frontend

Read `PROJECT.md` for what this is and `ARCHITECTURE.md` for how it's wired.
This file is the working agreement.

---

## Hard rules

1. **This repo is frontend only.** No Cardano libraries, no direct DB access, no
   service-role Supabase key. If a task seems to need one of those, it belongs in
   the backend repo — say so instead of building it here.
2. **shadcn components come from the shadcn MCP.** Do not hand-write a component
   that shadcn ships. Do not paste component source from memory. Install it, then
   compose it.
3. **`src/components/ui/` is generated.** Wrap and compose; don't edit in place
   unless there's no alternative, and say so if you do.
   - Known exception: `ui/form.tsx` is **hand-written**. The registry returns
     metadata but no file content for `@shadcn/form`, so `shadcn add form`
     exits silently. Written by hand with the owner's approval, following the
     preset's conventions so a future working `add --overwrite` swaps cleanly.
4. **All backend calls go through `lib/api.ts`.** No bare `fetch` to
   `BACKEND_URL` in a component.
5. **Role comes from `GET /me`.** Never from JWT claims, never from localStorage,
   never from a query param.
6. **Never invent an API response shape.** If the contract is unknown, hit the
   endpoint or ask. A screen built on guessed field names is worse than no screen.
7. **No PHI in logs, URLs, or analytics.** Prescription and patient data stay in
   the request body and in memory.
8. **Never commit `.env.local`** or paste real keys into docs, comments, or
   commit messages.

## Conventions

- TypeScript strict. No `any` in `lib/` — if the shape is unknown, model it as
  `unknown` and narrow.
- Server Components by default; `"use client"` only where you need state, effects,
  camera, or Supabase's browser client.
- Tailwind utilities inline. No separate CSS files beyond `globals.css`.
- Files kebab-case, components PascalCase, hooks `use-*.ts`.
- Dates: backend is the source of truth for expiry. Format for display only —
  never recompute "is expired" client-side as the deciding factor. Show the
  backend's status; use client-side date math for *presentation* only.

## Demo-first bias

This is a 4-day hackathon build. When choosing between correct-and-slow and
good-enough-and-demoable, pick demoable — but never fake data in a way that could
be mistaken for a real integration. If something is mocked, label it in the UI
(e.g. a "mock" badge) so nobody, including the judges, is misled about what works.

Preprod testnet only. Keep the "Cardano preprod testnet — demo" footer visible.

## Before you code a feature

1. Confirm the endpoint exists and its real response shape.
2. Check whether a shadcn component covers the UI; install via MCP if so.
3. Build loading / empty / error states in the same pass, not later.

## Resolved contract decisions

- **Supabase**: `https://rujemygoawvemvwewplq.supabase.co`, anon (legacy JWT) key.
  Public client keys only — the service-role key never enters this repo.
- **Scan**: polling, no Supabase Realtime. Two paths, same patient-context shape.
  IoT stations POST `/stations/scan`; the browser polls
  `GET /stations/current-scan` (~1.5s, `204` = nothing yet). Camera fallback:
  the browser decodes the QR and POSTs `/scan` with the operator's JWT, getting
  patient context inline with no polling. **Build the camera fallback first** —
  it makes the loop demoable from laptops with no hardware present.
- **Expiry**: always an ISO 8601 UTC string, or `null` for no expiry. Never
  epoch. Same format in requests and responses.
- **QR token**: the 30s is a real server-side expiry — the backend rejects an
  expired `qr_token` with 422. Show a hard countdown but refetch at ~25s so it
  never dies on screen.
- **Revoke**: doctor only; burns all remaining uses. Revoked prescriptions
  **do** appear in the patient's history, marked revoked, for audit
  transparency. Revoking an already-expired prescription returns
  `burn_tx_hash: null` — and only then. The policy's time-lock forbids any burn
  past expiry, so that revoke is database-only. Say so; never render a blank
  where a tx link goes.
- **Chain writes: mint ~3s, burn 12–16s** (measured, not estimated). The
  backend resolves the HTTP call as soon as the node *accepts* the submission;
  a burn is slow mostly because it waits on the *previous* write to settle.
  Never optimistically update — the tx hash doesn't exist until the response
  lands. Disable the control for the whole request and never auto-retry
  (`retry: false` on all three): a retried burn spends a fill the patient never
  received. `CHAIN_TIMEOUT_MS` (120s) in `lib/api.ts` bounds a genuinely hung
  socket — browsers impose no fetch timeout of their own.
- **A returned tx hash is submitted, not confirmed.** Cardanoscan 404s it for
  ~20s. Never render a fresh hash as a live link: pass `submittedAt` to
  `TxHash` and it holds the link inert, labelled "pending confirmation", for
  25s. Omit `submittedAt` only for historical hashes. A judge clicking through
  to a 404 mid-demo is a credibility hit.
- **Prescription events** are `mint | burn | revoke` — three, not two. A burn is
  one fill spent by a pharmacy; a revoke is the doctor voiding all remaining
  fills. Don't collapse them in the UI.
- **No doctor-side prescription list endpoint exists *yet*.** `GET
  /patient/prescriptions` is patient-only and a doctor's scan response omits
  `prescriptions`, so today a doctor can only revoke the prescription they just
  minted, from the mint confirmation screen. `GET /doctor/prescriptions` is
  being built — see "Not built yet" below.
- **Backend base URL**: `http://localhost:8080` for dev; Railway URL later.
  CORS is already open (`origin: true, credentials: true`) — no CORS work here.
- **Error envelope**: `{ error: { code, message, details? } }` on every endpoint.
  Branch on `code`, never on message text. See the code table in
  `ARCHITECTURE.md`; the four `PRESCRIPTION_*` 409s render as blocked states.
- **Roles**: pre-seeded server-side. No signup, no role picker, no verification
  UI — doctors and pharmacies can't self-verify (regulator constraint).

- **The live dispense button on a spent row is deliberate.** Rows in the
  pharmacy's `recently_completed` list keep their button enabled so a click
  makes a real request the server genuinely refuses with a 409. Branch on
  *which list the row came from*, never on `uses_remaining` — see the
  `RowVariant` comment in `pharmacy/dispense-list.tsx` before "fixing" it. The
  in-flight double-click guard still applies to every row.

## Doctor signing keys

- **The private key is generated non-extractable and stored in IndexedDB**,
  scoped by doctor user id. There is deliberately **no export, backup or sync**
  — an exportable key is a copyable key, which destroys the property being
  bought. Re-enrolment is the recovery path; the backend retains old keys so
  past prescriptions stay verifiable.
- **`lib/signing.ts`'s `sortDeep`/`canonicalJson` is a verbatim port of the
  backend's `src/lib/hash.ts`.** Do not reformat it or swap in a
  canonical-JSON library. A one-byte difference fails the mint with
  `INVALID_DOCTOR_SIGNATURE` and looks like a mystery.
- **Sign the canonical JSON bytes, never a hash of them** — WebCrypto applies
  SHA-256 internally, so pre-hashing double-hashes and always fails.
- **The signed payload has five fields and includes `doctor_id`**, which is
  *not* in the request body (the backend reads it from the JWT). Sign and send
  the same `expires_at` string.
- **ECDSA is non-deterministic**: the same payload signs to a different value
  every time and both are valid. Never cache, compare or dedupe on a signature.
- **`useSigningGate` treats a 404 on `/doctor/signing-key` as "signing not
  deployed yet"**, distinct from "not enrolled", and prescribes unsigned. The
  pre-signing backend ignores the extra field (verified), so one build works
  against both. Once the signing release is live, that branch is dead weight
  and can be removed.
- Signing needs a secure context: `crypto.subtle` is undefined over a plain-http
  LAN IP, so a doctor must be on https:// or localhost.

## Backend handoffs are files, not messages

Read `../Pacy-Backend/FRONTEND_HANDOFF.md`. Pasted handoffs arrived truncated
three times; the corruption is in the relay, so the file is the source of truth.

## Palette

Teal, light mode only. Dark Teal `#014342`, Teal `#107D7C`, Seagrass
`#5C9682`, with Soft Aqua-Teal `#1AA3AD` and Light Mint-Teal `#73B39A`
supporting. Signature gradient (`.brand-gradient`, `--brand-gradient`) runs
Dark Teal → Teal → Seagrass and **carries white text only** — its lightest stop
is 3.4:1, so dark text fails on the right-hand end.

`--brand-600` (`#107D7C`, 4.9:1 with white) is the only brand rung safe as a
button fill; `--brand-700`/`900` for colored text. 300/400/500 are accents and
must never carry text. Success stays green, not teal, so "dispensed" can't be
mistaken for chrome. The QR renders near-black on white regardless of palette —
a tinted QR is the classic way to make one unscannable.

## PWA

- **The service worker never caches a backend response.** `public/sw.js` is
  hand-written for exactly this reason: it returns early for any non-GET and
  any cross-origin request, so the API and Supabase are never seen by the
  caching logic at all. Only `/_next/static/` and `/icons/` are cached, both
  content-addressed. A cached `/patient/prescriptions` would show a spent fill
  as available and a cached QR token would already be rejected — both worse
  than being offline, because they look correct. Don't swap in a generated
  worker without re-deriving this.
- Registered in production only (`components/shared/service-worker.tsx`); in
  dev it serves stale Turbopack chunks after an edit.
- Icons are generated at build time from `components/shared/icon-mark.tsx` via
  `next/og` — no binary assets in the repo. Swap that one file when the real
  logo lands and the favicon, apple-touch icon and both manifest sizes follow.
  The mark is text-free because `ImageResponse` needs font data to draw glyphs.

## Open questions

None blocking. Backend is deployed at
`https://pacy-backend-production.up.railway.app`.

All response shapes (`/me`, `/patient/qr-token`, `/patient/prescriptions`, both
scan paths, mint / dispense / revoke) are verified live and typed in
`lib/types.ts`. Seeded logins: `doctor@` / `pharmacy@` / `patient@pacy.test`,
all `PacyDemo123!`.
