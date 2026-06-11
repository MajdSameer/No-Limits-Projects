import type { HTMLAttributes } from "react";

import { cx } from "../cx";

/** Centred page column with mobile-first gutters. */
export function Container({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("mx-auto w-full max-w-6xl px-4 sm:px-6", className)} {...rest} />
  );
}
