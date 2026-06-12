import base from "@nlr/config/eslint/next";

export default [
  // Node helper scripts (Playwright audits) are CommonJS by design.
  { ignores: ["scripts/**"] },
  ...base,
];
