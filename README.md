# Custom design system (TanStack Start)

A deliberately bare [TanStack Start](https://tanstack.com/start) + React starter
for building a design system from scratch. No CSS framework, no component
library, no theme tokens — just a router, a blank page, and a plain-CSS reset.
Bring your own styling approach.

## What's (intentionally) not here

- No Tailwind, no PostCSS, no `components.json`
- No shadcn/ui or Radix primitives
- No theme tokens or design system — `src/styles.css` is a minimal reset

## Stack

- TanStack Start + TanStack Router (file-based routing under `src/routes/`)
- React 19 + TypeScript
- TanStack Query, Zod, Recharts, date-fns

## Develop

```sh
bun install
bun run dev
```
