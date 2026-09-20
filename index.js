import { transform_markdown } from "../wasm-pkg/latex_to_unicode_wasm.js";

export const OpencodeMathHook = async () => {
  return {
    name: "opencode-math-hook",

    async "experimental.chat.messages.transform"({ messages }) {
      if (!messages || !Array.isArray(messages)) return;
      for (const msg of messages) {
        if (msg.role === "assistant" && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part && part.type === "text" && typeof part.text === "string") {
              try {
                part.text = transform_markdown(part.text);
              } catch (e) {
                // Ignore error
              }
            }
          }
        }
      }
    }
  };
};

export default OpencodeMathHook;
