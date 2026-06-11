// Base + React hooks rules. For React packages that aren't Next.js apps (e.g. @nlr/ui).
import reactHooks from "eslint-plugin-react-hooks";

import base from "./base.mjs";

export default [
  ...base,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: { "react-hooks": reactHooks },
    // Rules named explicitly so this works across plugin major versions.
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
