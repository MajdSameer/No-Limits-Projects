import type { HTMLAttributes } from "react";

import { cx } from "../cx";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-card border border-slate-200 bg-white p-6 shadow-sm",
        className,
      )}
      {...rest}
    />
  );
}
