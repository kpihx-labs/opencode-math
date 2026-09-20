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

- Converts inline `$ ... $` and block `$$ ... $$` math in agent messages.
- Zero-latency WebAssembly execution.
- High-fidelity Unicode mathematical alphabets, integrals, matrices, fractions, and accents.

## License

MIT License. Copyright (c) 2026 Ivann H. KAMDEM POUOKAM (KpihX).
