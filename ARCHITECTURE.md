# Architecture — Pacy Frontend

## Stack (locked, do not substitute)

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui — **installed via the shadcn MCP**, never hand-rolled |
| Auth | Supabase Auth, client-side (`@supabase/supabase-js`) |
| Data fetching | TanStack Query (polling, cache, retry) |
| Forms | react-hook-form + zod |
| QR render | `qrcode.react` |
| QR scan (fallback) | `@yudiel/react-qr-scanner` or `html5-qrcode` — decide at Phase 5 |
| PWA | `@serwist/next` (maintained successor to next-pwa) |
| Deploy | Vercel |

---

## Data flow

```
┌──────────────┐   1. signIn / getSession     ┌─────────────────┐
│  Browser     │ ───────────────────────────► │  Supabase Auth  │
│  (Next PWA)  │ ◄─────── JWT ─────────────── │                 │
└──────┬───────┘                              └─────────────────┘
       │
       │  2. fetch(BACKEND_URL/...,
       │       { Authorization: `Bearer <supabase jwt>` })
       ▼
┌───────────────────────────┐    signs tx     ┌──────────────────┐
│  Pacy Backend (Fastify)   │ ──────────────► │  Cardano preprod │
│  owns DB + wallet + roles │                 └──────────────────┘
└───────────────────────────┘
```

**The frontend never calls Cardano and never calls the DB.** One outbound
dependency for data: `BACKEND_URL`. One for identity: Supabase.

### Role resolution

Role comes from `GET /me`, **not** from the JWT claims and **not** from client
state. Fetch it once after session load, cache it in a React context, and gate
routing on it. Reason: the backend is the authority; a client-derived role is a
suggestion, not a permission. Server-side gating is the backend's job — our route
gating is UX, not security.

---

## Folder layout

```
src/
  app/
    layout.tsx                 # root: fonts, providers, testnet footer
    page.tsx                   # entry → redirects to the role's home
    providers.tsx              # QueryClient + central 401 → sign-out
    login/page.tsx
    patient/
      layout.tsx               # RequireRole('patient'); mobile shell
      page.tsx                 # rotating QR
      prescriptions/page.tsx   # history + events
    doctor/
      layout.tsx               # RequireRole('doctor'); desktop shell
      page.tsx                 # patient scan + prescribe form
    pharmacy/
      layout.tsx               # RequireRole('pharmacy'); desktop shell
      page.tsx                 # scan + active prescriptions + dispense
  components/
    ui/                        # shadcn output — do not hand-edit
    auth/require-role.tsx
    shared/                    # AppHeader, TestnetFooter, TxHashBadge, ScanPanel
    patient/  doctor/  pharmacy/
  lib/
    env.ts                     # env chokepoint; throws on missing vars
    supabase.ts                # browser client (singleton), auth only
    api.ts                     # typed fetch wrapper, injects Bearer token
    queries.ts                 # TanStack Query hooks + query keys
    roles.ts                   # role → home route, role → label
    types.ts                   # API types (mirror backend contract)
public/
  manifest.json  icons/
```

**Real path segments, not route groups.** Route groups (`(patient)`) don't add a
URL segment, so all three role homes would have collided on `/`. Segments also
make the demo legible — the URL says which view is on screen.

`RequireRole` gates on `GET /me` and redirects mismatches to their own home. This
is **UX, not security**: the backend enforces role on every endpoint, and the
gate only stops someone landing on a screen that would 403 anyway.

---

## API client

`lib/api.ts` is the single place a `fetch` to the backend is allowed.

```ts
// shape, not final code
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}
```

### Error envelope

Every endpoint fails with the same shape:

```jsonc
{ "error": { "code": "PRESCRIPTION_EXPIRED", "message": "…", "details": {} } }
```

`lib/api.ts` normalizes this into an `ApiError` carrying `code`, `status`, and
`details`. **Branch on `code`, never on message text** — messages are copy and
will change.

| Code | Status | Frontend behaviour |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | sign out, bounce to `/login` |
| `INVALID_STATION_KEY` | 401 | unreachable from a browser (IoT only) |
| `FORBIDDEN` | 403 | wrong role; show "not available for your role" |
| `NOT_FOUND` | 404 | empty state |
| `VALIDATION_ERROR` | 400 | surface on the offending form field |
| `INVALID_QR_TOKEN` | 422 | token aged out — refetch the token, retry once |
| `PRESCRIPTION_EXPIRED` | 409 | **blocked state** |
| `PRESCRIPTION_EXHAUSTED` | 409 | **blocked state** |
| `PRESCRIPTION_REVOKED` | 409 | **blocked state** |
| `PRESCRIPTION_NOT_ACTIVE` | 409 | **blocked state** |
| `CHAIN_ERROR` | 502 | retryable; say the chain rejected it, not "something broke" |
| `INTERNAL_ERROR` | 500 | generic retry |

The four 409s are **the demo moment** — they're the whole product thesis, that
the chain refuses a bad dispense. Render each as an explicit blocked panel
naming the reason. Never a generic toast. `ApiError.isBlockedDispense` groups
them.

Gate auto-logout on `code === "UNAUTHORIZED"`, never on `status === 401`.
`UNAUTHORIZED` is the only 401 a browser can receive; `INVALID_STATION_KEY` goes
only to a Pi sending `X-Station-Key`, a header no browser sends.

`api()` resolves to `undefined` on 204, which `GET /stations/current-scan` uses
for "no patient scanned yet."

### Endpoints consumed

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/health` | — | startup banner / demo sanity check |
| GET | `/me` | any | source of truth for role |
| GET | `/patient/qr-token` | patient | poll every 30s, render as QR |
| GET | `/patient/prescriptions` | patient | history incl. mint/burn events |
| POST | `/prescriptions` | doctor | body below → mints |
| POST | `/prescriptions/:id/dispense` | pharmacy | burns 1 |
| POST | `/prescriptions/:id/revoke` | doctor | burns **all** remaining |
| GET | `/stations/current-scan` | doctor/pharmacy | poll ~1.5s; `204` = no scan yet |
| POST | `/scan` | doctor/pharmacy | camera fallback; returns patient context inline |
| POST | `/stations/scan` | IoT only | web app does **not** call this |

```jsonc
// POST /prescriptions
{
  "patient_id": "<uuid>",
  "drug_details": { "drug": "", "dosage": "", "instructions": "", "diagnosis": "" },
  "max_uses": 1,                       // int >= 1
  "expires_at": "2026-08-01T00:00:00Z" // ISO 8601 UTC, or null for no expiry
}
```

> Response shapes are **unconfirmed**. Phase 1 starts by hitting the live backend
> and writing the real types into `lib/types.ts`. Do not invent field names and
> build three screens on top of them.

### Scan flow

The IoT station and the camera fallback return the **same patient-context
shape**, so the doctor and pharmacy views consume one type either way:

```
IoT:    Pi ──POST /stations/scan──► backend stores "current scan" for that station
        browser ──GET /stations/current-scan (poll 1.5s)──► patient context | 204

Camera: browser decodes QR ──POST /scan (operator JWT)──► patient context (inline)
```

`GET /me` tells the browser which station it owns. No Supabase Realtime — polling
only, by design. Poll only while the "waiting for patient" screen is focused.

---

## Polling strategy

- QR token: server-side expiry is a hard 30s (backend 422s an expired token), so
  `refetchInterval: 25_000` — refresh before it dies, and show a hard countdown
  ring so the patient understands the code rotates.
- Pharmacy/doctor scan inbox: `GET /stations/current-scan` at 1.5s while the
  "waiting for patient" screen is focused, stopped otherwise.
- Everything else: fetch on mount + invalidate after mutations.

---

## Environment

`.env.local` (never committed; `.env.example` is committed):

```
NEXT_PUBLIC_SUPABASE_URL=https://rujemygoawvemvwewplq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # anon/public key from the Supabase dashboard
NEXT_PUBLIC_BACKEND_URL=         # Railway backend base URL, no trailing slash
```

Read them through `lib/env.ts`, never `process.env` directly — a missing variable
should fail loudly at first use, not surface as `undefined` inside a URL.

All three are `NEXT_PUBLIC_` because auth and data fetching happen in the browser.
The anon key is public by design; the backend is the enforcement point.

---

## Design tokens

Defined in `src/app/globals.css`. **Light mode only** — deliberately no
`prefers-color-scheme` override, because a patient phone in dark mode must still
render the QR dark-on-white or scanners fail.

| Family | Accent (given) | Interactive fill | Text on white |
| --- | --- | --- | --- |
| Brand | `#67A976` | `#3F7A50` | `#326140` |
| Success | `#5FAE72` | `#3B8A51` | `#2F7043` |
| Danger | `#C84D4D` | `#C84D4D` | `#9C3333` |
| Warning | `#E7B547` | dark text only | `#8A6410` |
| Info | `#86BDD0` | `#3F8BA5` | `#2A6E85` |

The **accent** rung is the palette value as given. Most of them sit at 2–3:1 on
white, so they carry white text nowhere — they're for surfaces, borders, rings,
badge fills and the QR frame. The **interactive fill** rung is the darkened
sibling that clears AA (4.5:1) with white text on buttons. Don't substitute one
for the other without rechecking contrast; `#E7B547` in particular takes dark
text only, never white.

Neutrals: `#FFFFFF` page, `#F8FBFA` raised surface (the green tint), `#F1F5F3`
sunken, `#E4ECE7` / `#D3DED7` borders, `#1B241F` / `#2F3A34` / `#667A6F` text.

shadcn's variable names (`--primary`, `--destructive`, `--ring`, …) are mapped
onto these tokens, so a component installed via the MCP is themed on arrival and
`src/components/ui/` never needs editing.

### Typography

Loaded through `next/font/google` in `app/layout.tsx` — self-hosted at build
time, so there's no runtime CDN dependency and no font files in the repo.

- **Plus Jakarta Sans** (`font-display`) — headings only.
- **Inter** (`font-sans`) — body and UI. Picked for small-size legibility and
  real tabular numerals; use the `.tabular` class for fill counts and dosages so
  digits don't jitter as they update in place.
- **Geist Mono** (`font-mono`) — tx hashes and token IDs, compared by eye
  character by character.

## PWA

- `manifest.json`: name, short name, theme color, `display: standalone`,
  192/512 icons, `orientation: portrait` for the patient view.
- Service worker via `@serwist/next`, registered in production only.
- **Do not cache API responses in the service worker.** A stale QR token or a
  stale "uses remaining" is worse than an error state. Cache the app shell only.
- Camera access needs HTTPS — works on Vercel, and on `localhost` for dev.

---

## Error and loading states

Every data view ships three states: loading (shadcn `Skeleton`), empty (explain
what would appear here), error (message + retry). Hackathon demos fail on the
network, not on the happy path — the empty and error states are what the judges
see if the Wi-Fi hiccups.
