import { transform_markdown } from "./wasm-pkg/latex_to_unicode_wasm.js";

export default async function (input) {
  return {
    "experimental.chat.messages.transform": async (_input, output) => {
      const messages = output.messages || [];
      for (const msg of messages) {
        if (Array.isArray(msg.parts)) {
          for (const part of msg.parts) {
            if (part && part.type === "text" && typeof part.text === "string") {
              try {
                part.text = transform_markdown(part.text);
              } catch (e) {
                // Ignore error on malformed input
              }
            }
          }
        }
      }
      return output;
    },
  };
}
