# Coding Workflow Runbook

Use this runbook for agents making React, TypeScript, worker, query, grid, media, theme, or script changes.

## Ramp-up

1. Read `CONTEXT.md` for the product model, data flow, invariants, and edit map.
2. Inspect the nearest implementation files and their colocated tests before changing code.
3. Use `ast-grep` for code symbol searches such as functions, variables, types, components, and imports.
4. Prefer existing feature/module patterns over new abstractions unless the change clearly reduces real complexity.

## Common Work Areas

- Browser domain and transport interfaces live in `src/greenfield/contracts`.
- UI behavior is split by surface under `src/greenfield/modules`: controls,
  wall, playback, composition, and lightbox.
- Route and application composition live in `src/greenfield/router`,
  `src/greenfield/GreenfieldApp.tsx`, and `src/main.tsx`.
- The Cloudflare edge adapter lives in `worker`.
- Catalog artifact contracts and export logic live in `scripts/catalog`; X
  sync, media mirroring, publication, validation, and refresh orchestration
  live in `scripts`. Follow `docs/runbooks/data-refresh.md` before changing or
  executing them.

## Validation Ladder

Run the narrowest relevant checks first while iterating:

- Nearest tests for the touched module, usually with `bun run test -- <pattern>`.
- For shared behavior or before completion when practical: `bun run typecheck`.
- Before completion when practical: `bun run lint`.
- Before completion when practical: `bun run build`.

If a check is skipped, note why.

## Documentation Maintenance

Update agent ramp-up docs only when architecture, commands, data flow, workflow policy, or recurring implementation conventions change. Avoid routine wording churn for ordinary code edits.
