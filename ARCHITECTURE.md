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
    layout.tsx                 # root: providers, PWA meta
    page.tsx                   # entry → redirects by role
    login/page.tsx
    (patient)/
      layout.tsx               # requireRole('patient'); mobile shell
      page.tsx                 # rotating QR
      prescriptions/page.tsx   # history + events
    (doctor)/
      layout.tsx               # requireRole('doctor'); desktop shell
      page.tsx                 # patient scan/lookup + prescribe form
    (pharmacy)/
      layout.tsx               # requireRole('pharmacy'); desktop shell
      page.tsx                 # scan + active prescriptions + dispense
  components/
    ui/                        # shadcn output — do not hand-edit
    patient/  doctor/  pharmacy/
    shared/                    # RoleGate, TxHashBadge, EmptyState, ScanPanel
  lib/
    supabase.ts                # browser client (singleton)
    api.ts                     # typed fetch wrapper, injects Bearer token
    queries.ts                 # TanStack Query hooks, one per endpoint
    types.ts                   # API response types (mirror backend contract)
  hooks/
    use-session.ts  use-role.ts  use-qr-token.ts
public/
  manifest.json  icons/
```

Route groups (`(patient)`, `(doctor)`, `(pharmacy)`) keep each role's layout,
shell, and gating isolated without leaking into the URL.

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

A 401 means the Supabase session expired → sign out and bounce to `/login`.
Handle it centrally here, not in every component.

### Endpoints consumed

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/health` | — | startup banner / demo sanity check |
| GET | `/me` | any | source of truth for role |
| GET | `/patient/qr-token` | patient | poll every 30s, render as QR |
| GET | `/patient/prescriptions` | patient | history incl. mint/burn events |
| POST | `/prescriptions` | doctor | `{ patient_id, drug_details, max_uses, expiry }` → mints |
| POST | `/prescriptions/:id/dispense` | pharmacy | burns 1 |
| POST | `/prescriptions/:id/revoke` | doctor (?) | **TODO: confirm role + semantics** |
| POST | `/stations/scan` | IoT only | web app does **not** call this |

> Response shapes are **unconfirmed**. Phase 1 starts by hitting the live backend
> and writing the real types into `lib/types.ts`. Do not invent field names and
> build three screens on top of them.

---

## Polling strategy

- QR token: `refetchInterval: 30_000`, `refetchOnWindowFocus: true`. Show a
  countdown ring so the patient understands the code rotates.
- Pharmacy/doctor scan inbox (if polling is the answer to the open scan question):
  2–3s interval while the view is focused, stopped otherwise.
- Everything else: fetch on mount + invalidate after mutations.

---

## Environment

`.env.local` (never committed; `.env.example` is committed):

```
NEXT_PUBLIC_SUPABASE_URL=        # TODO: full URL was truncated in the brief
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_BACKEND_URL=         # Railway backend base URL
```

All three are `NEXT_PUBLIC_` because auth and data fetching happen in the browser.
The anon key is public by design; the backend is the enforcement point.

---

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
