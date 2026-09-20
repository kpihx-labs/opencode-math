/**
 * @kpihx-labs/opencode-math
 *
 * OpenCode TUI plugin: High-performance LaTeX math rendering to Unicode
 * using the sovereign Rust WASM core `latex-to-unicode`.
 */

import { transform_markdown, latex_to_unicode } from "./wasm-pkg/latex_to_unicode_wasm.js";

export const OpencodeMathPlugin = async () => {
  return {
    name: "opencode-math",

    /**
     * Intercept and transform assistant messages before rendering in TUI
     */
    async "chat.message"(message) {
      if (message && message.role === "assistant" && typeof message.content === "string") {
        try {
          message.content = transform_markdown(message.content);
        } catch (err) {
          // Graceful fallback to raw content on any error
        }
      }
      return message;
    },

    /**
     * Text processor helper for extensions
     */
    transform(text) {
      if (!text || typeof text !== "string") return text;
      try {
        return transform_markdown(text);
      } catch (e) {
        return text;
      }
    },

    transformFormula(latex) {
      if (!latex || typeof latex !== "string") return latex;
      try {
        return latex_to_unicode(latex);
      } catch (e) {
        return latex;
      }
    }
  };
};

export default OpencodeMathPlugin;
