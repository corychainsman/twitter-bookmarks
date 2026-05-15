# Data Refresh Runbook

Use this runbook for agents inspecting, validating, or explicitly refreshing the shipped bookmark data artifacts.

## Policy

Agents may inspect and validate data artifacts at any time. Agents must only run refresh or export commands that can change `public/data` when the user explicitly requests a data refresh/export.

`public/data` is shipped public output. Raw Field Theory cache data belongs in `.data/fieldtheory` and must remain local.

## Pipeline

The full refresh pipeline is:

```bash
bun run sync:ft
bun run data:export
bun run data:embeddings
bun run data:validate
bun run build
```

Convenience commands:

- `bun run refresh`: sync, export, embeddings, validate, and build.
- `bun run refresh:resume`: resume sync, then export, embeddings, validate, and build.
- `bun run refresh:full`: full sync, then export, embeddings, validate, and build.
- `bun run refresh:embeddings`: sync, export, embeddings, validate, and build.

## Command Notes

- `bun run sync:ft` depends on a real local Field Theory/X session and writes raw local cache data under `.data/fieldtheory`.
- `bun run data:export` writes normalized static bookmark artifacts under `public/data`.
- `bun run data:embeddings` writes the static semantic embedding index under `public/data`.
- `bun run data:validate` validates exported artifacts.
- `bun run build` confirms the static app builds with the exported artifacts.

## Review Checklist

Before completing data refresh work, report whether `public/data` changed and whether validation/build commands passed. Do not commit raw Field Theory cache data.
