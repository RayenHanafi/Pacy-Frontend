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
  transparency.
- **Backend base URL**: `http://localhost:8080` for dev; Railway URL later.
  CORS is already open (`origin: true, credentials: true`) — no CORS work here.
- **Error envelope**: `{ error: { code, message, details? } }` on every endpoint.
  Branch on `code`, never on message text. See the code table in
  `ARCHITECTURE.md`; the four `PRESCRIPTION_*` 409s render as blocked states.
- **Roles**: pre-seeded server-side. No signup, no role picker, no verification
  UI — doctors and pharmacies can't self-verify (regulator constraint).

## Open questions

- **Response shapes** for `/me` (incl. which station the caller owns),
  `/patient/qr-token`, `/patient/prescriptions`, and the shared patient-context
  shape returned by the two scan paths. Confirm against the live backend in
  Phase 1 and write them into `lib/types.ts` before building screens on them.
- **Seeded test credentials** — arriving at the end of backend Phase 1.
