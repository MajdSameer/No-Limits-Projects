// Root config covers repo-level files (scripts/). Apps and packages lint
// themselves via their own eslint.config.mjs, so they're ignored here.
import base from "@nlr/config/eslint/base";

export default [
  {
    ignores: ["apps/**", "packages/**"],
  },
  ...base,
];
