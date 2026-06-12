"use client";

import { useEffect } from "react";

import { Button, Container } from "@nlr/ui";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in Vercel logs; wire up real error reporting when we adopt it.
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex-1">
      <Container className="py-24 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-brand-900">
          Something went wrong
        </h1>
        <p className="mx-auto mt-3 max-w-md text-slate-600">
          Sorry about that — an unexpected error occurred. Trying again usually
          fixes it.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-slate-400">Error reference: {error.digest}</p>
        )}
        <div className="mt-8">
          <Button onClick={reset}>Try again</Button>
        </div>
      </Container>
    </main>
  );
}
