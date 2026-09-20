import { test, expect } from "bun:test";
import { transform_markdown, latex_to_unicode } from "../wasm-pkg/latex_to_unicode_wasm.js";

test("smoke conversion", () => {
  const res = latex_to_unicode("\\int_0^1 x dx = 1/2");
  expect(res).toBe("∫₀¹ x dx = 1/2");
});

test("markdown full transformation", () => {
  const md = "Formule: $\\alpha + \\beta = 10$";
  const res = transform_markdown(md);
  expect(res).toBe("Formule: α + β = 10");
});
