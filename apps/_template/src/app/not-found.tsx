import type { Metadata } from "next";

import { ButtonLink, Container, Footer, Header } from "@nlr/ui";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        <Container className="py-24 text-center">
          <p className="text-sm font-semibold tracking-widest text-accent-600 uppercase">
            404
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-900 sm:text-4xl">
            We couldn&apos;t find that page
          </h1>
          <p className="mx-auto mt-3 max-w-md text-slate-600">
            It may have moved or never existed. Let&apos;s get you back on track.
          </p>
          <div className="mt-8">
            <ButtonLink href="/">Back to the homepage</ButtonLink>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
