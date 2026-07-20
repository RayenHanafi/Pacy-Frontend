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

## Open questions (blocking — resolve before the phase that needs them)

- **Supabase project URL** — arrived truncated as `https://rco…`. Blocks Phase 1.
- **How the web app learns a scan happened** at doctor/pharmacy stations: polling
  endpoint, Supabase Realtime, or manual patient-ID entry? Blocks Phases 4–5.
- **Response shapes** for `/me`, `/patient/qr-token`, `/patient/prescriptions`.
  Blocks Phase 2 onward.
- **`/prescriptions` request body**: exact field names, expiry format
  (ISO date vs null vs epoch), and how "no expiry" is expressed.
- **`/prescriptions/:id/revoke`**: which role, and does the patient view show
  revoked prescriptions?
- **Role provisioning**: how does a signup become a doctor or pharmacy? Is there a
  seeding step, or does the frontend need a role-selection screen?
