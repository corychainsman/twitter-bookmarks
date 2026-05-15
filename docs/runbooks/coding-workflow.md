# Coding Workflow Runbook

Use this runbook for agents making React, TypeScript, worker, query, grid, media, theme, or script changes.

## Ramp-up

1. Read `CONTEXT.md` for the product model, data flow, invariants, and edit map.
2. Inspect the nearest implementation files and their colocated tests before changing code.
3. Use `ast-grep` for code symbol searches such as functions, variables, types, components, and imports.
4. Prefer existing feature/module patterns over new abstractions unless the change clearly reduces real complexity.

## Common Work Areas

- Bookmark state, artifact loading, URL state, query behavior, and exported contracts live in `src/features/bookmarks`.
- UI behavior is split by surface: toolbar in `src/components/toolbar`, grid in `src/components/grid`, media in `src/components/media`, and lightbox in `src/components/lightbox`.
- Route and app composition live in `src/app` and `src/routes`.
- Worker message contracts and worker implementations live in `src/workers`.
- Data pipeline code lives in `scripts`, with shared app-facing types in `src/features/bookmarks`.

## Validation Ladder

Run the narrowest relevant checks first while iterating:

- Nearest tests for the touched module, usually with `bun run test -- <pattern>`.
- For shared behavior or before completion when practical: `bun run typecheck`.
- Before completion when practical: `bun run lint`.
- Before completion when practical: `bun run build`.

If a check is skipped, note why.

## Documentation Maintenance

Update agent ramp-up docs only when architecture, commands, data flow, workflow policy, or recurring implementation conventions change. Avoid routine wording churn for ordinary code edits.
