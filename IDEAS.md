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

---

# IDEAS — TUI-only Unicode vs DB LaTeX (canonical storage)

Captured 2026-09-23. Analysis + exact fix plan. Web research + local binary/plugin evidence. No implementation yet.

## WARNING (status quo)

**Current hook mutates DB — not TUI-scoped.**

`experimental.text.complete` runs on `text-end`, mutates `output.text` to Unicode, then OpenCode calls `updatePart(...)`. That write is the shared session storage (`~/.local/share/opencode/opencode.db`). TUI, desktop, web, export, and resume all read the same parts → all see Unicode.

Upstream design of the hook ([PR #4962](https://github.com/sst/opencode/pull/4962)): transform **before** text is saved to the session — intentionally a persist-time filter, not a display filter.

### Timing intuition

```
text-delta  → TUI paint raw LaTeX     (plugin silent)
text-end    → experimental.text.complete  mutates output.text → Unicode
            → updatePart(...)             WRITES THAT TEXT TO DB
```

Flash mid-stream = expected. Final Unicode everywhere = expected with this hook. **Not** a desktop/web bug.

### Smoking-gun evidence (DB ≠ agent LaTeX)

Session `New session - 2026-09-23T13:50:04.411Z` = `ses_f31782785ffebC4W8qAQ9zd4g2` (Academic X/3A, floats):

| Layer | Content |
|-------|---------|
| RAW agent (`/tmp/opencode-math-raw.log`) | `$$…$$`, `\sum`, `\(...\)` |
| DB `part.data.text` (e.g. `prt_0cf7bc2ea00161EuB2Az8Y0oCO`) | Unicode `∑` / no `$` — persist log `changed:true` |

Same pattern on e-proof `ses_f31a22a82ffe…`: DB = Unicode + 2D bars `S₁`/`R`, zero `$`/`\frac`.

Target contract (non-negotiable):

| Layer | Content |
|-------|---------|
| DB / export / desktop / web / resume | **Agent LaTeX** (`$…$`, `$$…$$`, `\frac`, …) |
| TUI paint only | **Unicode** via `transform_markdown` |

Same model as Markview nvim: display/conceal, never rewrite the stored buffer.

## Can a plugin alone fix this on OpenCode 1.18.16?

**No.** Evidence:

| Source | Fact |
|--------|------|
| [#11864](https://github.com/anomalyco/opencode/issues/11864) | Exact ask: `chat.display.transform` string→string, **TUI only**, **not persisted**, wire on `TextPart`. **CLOSED** (stale ~90d, never implemented). Modes proposed: `final` / `throttle` (default ~100ms) / `chunk`. Sync-only, error fallback to original text. |
| [#10868](https://github.com/anomalyco/opencode/issues/10868) | Broader TUI/storage hooks. **CLOSED**. |
| Local binary 1.18.16 | `chat.display.transform` count = **0**; `experimental.text.complete` present. |
| `@opencode-ai/plugin` `tui.d.ts` | `TuiHostSlotMap` = chrome only (`sidebar_*`, `session_prompt`, footers, home_*). **No** `TextPart` / message-body slot. |
| Plugin docs / events | toast, prompt.append, commands — no message-body display transform. |

Consequences:

- Remove `text.complete` without an OpenCode render patch → TUI shows LaTeX again (visual regression).
- Keep `text.complete` → DB stays Unicode (violates TUI-only intent).
- Dual-field / `schema.extend` → not shipped (#10868 closed).
- `experimental.chat.messages.transform` → LLM-bound deep copy only ([PR #5207](https://github.com/anomalyco/opencode/pull/5207)); does not change TUI or DB.
- Post-hoc `client.part.update` / PATCH → race; abandoned; still shared DB.

## Exact fix plan (ordered)

### Step 0 — Contract

DB = LaTeX. TUI paint = Unicode. Desktop/web = LaTeX (same DB).

### Step 1 — Patch OpenCode (the real fix): display-only hook

Implement locally (fork / patch of installed OpenCode) what [#11864](https://github.com/anomalyco/opencode/issues/11864) describes.

**1a. Plugin types** (`packages/plugin/src/index.ts` or equivalent):

```ts
"chat.display.transform"?: (
  input: { sessionID: string; messageID: string; partID: string; streaming: boolean },
  output: { text: string }
) => void   // SYNC ONLY — #11864
```

**1b. TUI chokepoint** — in the component that paints `TextPart` (NOT in `SessionProcessor`):

```ts
// at render — NOT before updatePart
const display = plugin.triggerSync("chat.display.transform", meta, { text: part.text }).text
<Markdown text={display} />
```

Modes: start with `final`, then `throttle` + closed-spans-only for mid-stream (ties to P1 above).

**1c. Stop writing transform into storage** — `SessionProcessor` `text-end`:

```ts
case "text-end":
  // Do NOT use experimental.text.complete for math display
  // OR leave the hook but opencode-math must unregister from it
  yield* updatePart(currentText)  // LaTeX intact
```

Typical files to touch in an OpenCode fork:

- `packages/opencode/src/session/processor.ts` — do not rely on `text.complete` for math display
- TUI `TextPart` / markdown message component (opentui / TUI packages)
- `packages/plugin/src/index.ts` (+ shipped types)

Acceptance criteria:

1. After a message: SQLite `part.data.text` still contains `$` / `\frac`
2. TUI shows Unicode
3. Desktop/web (same DB) show LaTeX
4. Session export = LaTeX

### Step 2 — Adapt `opencode-math`

```js
// BEFORE (current — mutates DB)
"experimental.text.complete": async (_, output) => {
  output.text = transform_markdown(output.text)  // REMOVE
}

// AFTER
"chat.display.transform": (_input, output) => {
  const next = maybeTransform(output.text)
  if (next) output.text = next
}
```

Keep WASM + raw/persist logs. Document: display-only; DB = LaTeX.

### Step 3 — Already-corrupted sessions (Unicode already in DB)

Chats that already went through `text.complete` (e.g. `ses_f31782785ffe…`, e/√2 verify sessions) **stay Unicode in DB**. Options:

| Option | How |
|--------|-----|
| A | Leave historical sessions as-is |
| B | One-shot migration: `/tmp/opencode-math-raw.log` → PATCH parts when `partID` matches |
| C | Do not attempt blind Unicode→LaTeX reverse (information loss) |

Recommendation: **A + B only for logged partIDs**; no magical reverse.

### Step 4 — Upstream (parallel, non-blocking)

Reopen / PR: implement `#11864` `chat.display.transform` at `TextPart`, with math fixture (DB assert LaTeX + TUI assert Unicode). Until merged: carry the local patch on every `opencode` bump.

### Anti-patterns (do not do)

| Anti-pattern | Why |
|--------------|-----|
| Keep `text.complete` + “filter” desktop | Impossible — same DB |
| Mutate via `client.part.update` / PATCH after the fact | Race; abandoned; DB still shared |
| Rely on `experimental.chat.messages.transform` | LLM copy only — neither TUI nor DB |
| Current TUI slots | No message-body slot |
| Dual-field without OpenCode schema | No shipped `schema.extend` |

### Concrete cut if greenlit

1. Locate OpenCode sources (or binary extract) for `TextPart` render
2. Inject sync `chat.display.transform` at paint
3. Remove `text.complete` registration from `opencode-math`
4. Live test (Ling): assert DB has `$`; TUI capture has `∑`/`∫`
5. Desktop/web check: LaTeX visible
6. Commit sovereign OpenCode patch + `opencode-math`; update docs

**Without Step 1 (OpenCode patch), “TUI Unicode / DB LaTeX” is impossible on 1.18.16.**

## Cross-links

- Streaming flash / mid-stream options: **P1–P6** in the section above (orthogonal: display-time vs persist-time; P4 becomes real once `#11864` exists).
- Backend leftover fixes (underbrace, mid, bigl, frac): `latex-to-unicode` v0.1.1 `bc84794` — independent of storage-vs-display; still needed for correct Unicode when display path runs.
