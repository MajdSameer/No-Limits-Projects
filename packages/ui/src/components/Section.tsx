import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "../cx";
import { Container } from "./Container";

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Small uppercase label above the title. */
  eyebrow?: string;
  title?: string;
  /** Intro paragraph under the title. */
  lead?: string;
  children?: ReactNode;
}

export function Section({ eyebrow, title, lead, className, children, ...rest }: SectionProps) {
  return (
    <section className={cx("py-12 sm:py-16", className)} {...rest}>
      <Container>
        {(eyebrow ?? title ?? lead) && (
          <div className="mb-8 max-w-2xl">
            {eyebrow && (
              <p className="mb-2 text-sm font-semibold tracking-widest text-accent-700 uppercase">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">
                {title}
              </h2>
            )}
            {lead && <p className="mt-3 text-base text-slate-600 sm:text-lg">{lead}</p>}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}
