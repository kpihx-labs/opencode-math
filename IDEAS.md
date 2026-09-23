# IDEAS — opencode-math streaming / mid-stream Unicode

Captured 2026-09-23. Analysis only at capture time; no implementation yet.

## Current behavior (status quo)

- Hook used: `experimental.text.complete` only (fires on `text-end`).
- During stream: TUI paints raw LaTeX via `text-delta` → `updatePartDelta`.
- After stream: plugin mutates `output.text` → Unicode → `updatePart` refresh.
- Result: **flash LaTeX mid-stream, Unicode only at the end**. Final persist is correct.
- OpenCode 1.18.16 has **no** mutable mid-stream text hook. PR [#14741](https://github.com/anomalyco/opencode/pull/14741) (`stream.delta`) was **closed unmerged**. Upstream `dev` still only documents `experimental.text.complete`.

Constraint: only **closed** math spans (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`) can safely convert. An open `$` mid-stream must stay raw or be concealed.

## Proposals

| # | Approach | Stream effect | Feasible now? | Cost / risk |
|---|----------|---------------|---------------|-------------|
| **P1** | Fork / patch local OpenCode: hook before `updatePartDelta`, mutate delta (or rewrite accumulated display text) + convert **closed spans only** | Near real-time | Yes (sovereign) | Maintain on every `opencode` bump |
| **P2** | Upstream PR: `experimental.text.delta` mutable *before* `updatePartDelta` (better than abort-only #14741) | Same if merged | Long | Depends on maintainers |
| **P3** | Hook `event` + rewrite via client on `message.part.updated` | Theoretical | Fragile | Race TUI vs PATCH; abandoned once already |
| **P4** | TUI render-layer slot: storage stays LaTeX, display is Unicode | Ideal UX | If message render slot exists | Not in current plugin API |
| **P5** | Buffer / mask incomplete tail (`$` … without closer) during stream | Less ugly flash | Needs P1 | Temporary holes / `…` |
| **P6** | Stay on `text.complete` only | Status quo | Already shipped | Flash inevitable |

## Recommended path

1. **Short term:** P6 — correct for persistence; document flash as known limitation.
2. **Real stream fix:** **P1** (local processor patch) + closed-span-only transform in WASM/JS; keep `text.complete` as safety net.
3. **Medium term:** **P2** so the fork is not permanent.
4. Avoid P3 without a solid prototype.

## Stream algorithm (if P1)

```
acc += delta
display = transform_closed_spans(acc)   # closed → Unicode
         + tail_raw_or_ellipsis          # open span untouched / masked
push display_delta (or full part rewrite)
```

Without a mid-stream hook, **no** `index.js`-only change removes the flash.

## Related notes

- Issue [#7287](https://github.com/anomalyco/opencode/issues/7287) (TUI ignoring final mutated text): closed; final swap works here.
- Pattern: storage vs presentation (Markview = display-time; OpenCode plugin = mutate at `text-end`).
- Prototype closed-span transform on delta fixtures in JS before touching the OpenCode binary.
