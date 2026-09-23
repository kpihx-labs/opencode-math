# @kpihx-labs/opencode-math

OpenCode TUI plugin for high-performance LaTeX math rendering to Unicode directly inside the terminal.

Powered by the sovereign Rust WebAssembly core [`latex-to-unicode`](https://github.com/kpihx-labs/latex-to-unicode).

## Installation

Add to your `opencode.jsonc`:

```jsonc
{
  "plugin": [
    "file://{env:HOME}/.agents/skills/k-opencode/scripts/plugins/tui/opencode-math/index.js"
  ]
}
```

## Features

- Converts inline `$ ... $` / `\(...\)` and block `$$ ... $$` / `\[...\]` math in agent messages.
- Zero-latency WebAssembly execution.
- High-fidelity Unicode mathematical alphabets, integrals, matrices, fractions, and accents.
- **TUI persistence:** hooks `experimental.text.complete` (SessionProcessor text-end) and
  mutates `output.text` **before** OpenCode calls `updatePart`. That is the supported path;
  `experimental.chat.messages.transform` only mutates the LLM-bound deep copy and does not
  change what the TUI renders. Post-hoc PATCH/SQLite was abandoned (broken on the v1 client).

## License

MIT License. Copyright (c) 2026 Ivann H. KAMDEM POUOKAM (KpihX).
