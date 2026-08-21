# Remax ConfigHub — Web (Next.js)

The next-generation frontend for Remax ConfigHub, rebuilt in **Next.js + TypeScript**
with **Tailwind CSS** and **shadcn/ui** components. This replaces the Streamlit proof of
concept with a scalable, component-based UI.

> **Screens-first build.** We are porting the app one screen at a time. The UI currently runs
> on **mock data** (`src/lib/mock-data.ts`) — the real M1 data layer is wired up in a later step.

## Status

| Screen | Status |
|---|---|
| **Estimate** (header + customer picker + line items) | ✅ Built (mock data) |
| Configurator (door / curtain / installation) | ⏳ Next |
| Pricing & summary | ⏳ Planned |

## Prerequisites

- **Node.js 18.18+** (or 20+) and npm — not yet installed on the build machine; install from
  <https://nodejs.org> before running.

## Getting started

```bash
cd web
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Project structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout + fonts
│   │   ├── globals.css          # Tailwind + shadcn design tokens
│   │   └── page.tsx             # Estimate screen (first page)
│   ├── components/
│   │   ├── ui/                  # shadcn/ui primitives (button, card, input, tabs, table, dialog…)
│   │   └── estimate/            # Estimate feature components
│   │       ├── estimate-header.tsx
│   │       ├── customer-picker.tsx
│   │       └── estimate-lines.tsx
│   ├── lib/
│   │   ├── utils.ts             # cn() class helper
│   │   ├── format.ts            # money() / percent() (mirror the Python helpers)
│   │   └── mock-data.ts         # Stand-in for the M1 SQL layer
│   └── types/
│       └── estimate.ts          # Domain types
├── tailwind.config.ts
├── components.json              # shadcn/ui config
└── package.json
```

## Conventions

- **TypeScript** everywhere; domain types live in `src/types`.
- **shadcn/ui** components are copied into `src/components/ui` and owned by us — extend freely.
- **Formatting** (`money`, `percent`) mirrors `services/data_mapping.py` so figures read identically
  to the current app.
- Data access is isolated in `src/lib` so swapping mock data for the real M1 API is a localised change.
