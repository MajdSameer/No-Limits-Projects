// React config + Next.js rules (Core Web Vitals). For everything under apps/.
import nextPlugin from "@next/eslint-plugin-next";

import react from "./react.mjs";

export default [
  ...react,
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
];
