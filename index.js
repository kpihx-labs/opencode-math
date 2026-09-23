/**
 * opencode-math — LaTeX → Unicode for OpenCode TUI.
 *
 * Correct injection point (OpenCode processor text-end):
 *   experimental.text.complete  → mutate output.text BEFORE session.updatePart
 *
 * Why the old PATCH / SQLite path failed:
 * 1. experimental.chat.messages.transform only mutates the LLM-bound deep copy
 * 2. client.part.update is absent on the v1 plugin client surface
 * 3. post-hoc PATCH / sqlite refresh threw (persist_throw v[0]) and never refreshed TUI
 *
 * Honest verification: pre-transform LaTeX → /tmp/opencode-math-raw.log
 * Post-transform outcomes → /tmp/opencode-math-persist.log
 */

import fs from "node:fs";
import { transform_markdown } from "./wasm-pkg/latex_to_unicode_wasm.js";

const MATH_HINT = /\$\$|\$|\\\[|\\\(|\\begin\{/;
const RAW_LATEX_CMD =
  /\\(int|sum|prod|frac|sqrt|begin|end|alpha|beta|gamma|pi|infty|partial|nabla|cdot|times|leq|geq|neq|in|to|mapsto|left|right|mathrm|mathbf|mathbb|text)\b/;
const RAW_LOG = "/tmp/opencode-math-raw.log";
const PERSIST_LOG = "/tmp/opencode-math-persist.log";
const CLIENT_LOG = "/tmp/opencode-math-client.log";

function appendLog(file, obj) {
  try {
    fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n");
  } catch {
    // never break chat on debug I/O
  }
}

function maybeTransform(text) {
  if (typeof text !== "string" || !MATH_HINT.test(text)) return null;
  try {
    const next = transform_markdown(text);
    return next !== text ? next : null;
  } catch (err) {
    appendLog(PERSIST_LOG, { op: "transform_error", error: String(err) });
    return null;
  }
}

function logRaw(source, meta, text) {
  if (typeof text !== "string") return;
  if (!MATH_HINT.test(text) && !RAW_LATEX_CMD.test(text)) return;
  const hasCmd = RAW_LATEX_CMD.test(text) || /\\[a-zA-Z]+/.test(text);
  const hasDelim = /\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/.test(
    text,
  );
  if (!hasCmd && !hasDelim) return;
  appendLog(RAW_LOG, {
    source,
    ...meta,
    preview: text.slice(0, 1200),
  });
}

export default async function (input) {
  appendLog(CLIENT_LOG, {
    op: "init",
    hasClient: Boolean(input?.client),
    serverUrl: input?.serverUrl ? String(input.serverUrl) : null,
    directory: input?.directory || null,
    hook: "experimental.text.complete",
  });

  return {
    /**
     * Fires at text-end in SessionProcessor, BEFORE updatePart.
     * Mutating output.text is what the TUI and DB both see.
     */
    "experimental.text.complete": async (meta, output) => {
      if (!output || typeof output.text !== "string") return;

      logRaw(
        "text.complete",
        {
          partID: meta?.partID,
          messageID: meta?.messageID,
          sessionID: meta?.sessionID,
        },
        output.text,
      );

      const next = maybeTransform(output.text);
      if (!next) {
        appendLog(PERSIST_LOG, {
          op: "text.complete",
          partID: meta?.partID,
          changed: false,
          reason: "no_math_or_noop",
        });
        return;
      }

      const beforeLen = output.text.length;
      output.text = next;
      appendLog(PERSIST_LOG, {
        op: "text.complete",
        partID: meta?.partID,
        messageID: meta?.messageID,
        sessionID: meta?.sessionID,
        changed: true,
        beforeLen,
        afterLen: next.length,
        preview: next.slice(0, 400),
      });
    },
  };
}
