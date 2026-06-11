import { company, formatCurrency, formatDate } from "@nlr/config/brand";
import { createMoveproClient } from "@nlr/movepro";
import { ButtonLink, Card, Container, Footer, Header, Section } from "@nlr/ui";

const NAV = [
  { label: "What's included", href: "#included" },
  { label: "Movepro demo", href: "#movepro" },
];

const INCLUDED = [
  {
    title: "Brand design tokens",
    body: "Colours, fonts and spacing come from @nlr/config — restyle every app by editing one file.",
  },
  {
    title: "Shared UI library",
    body: "Header, footer, forms and buttons from @nlr/ui. Mobile-first with accessibility built in.",
  },
  {
    title: "Movepro adapter",
    body: "Typed CRM client with a working mock today and a drop-in slot for the real API later.",
  },
  {
    title: "Quality gates",
    body: "Strict TypeScript, ESLint and a repo-wide `pnpm check` keep main always deployable.",
  },
];

export default async function HomePage() {
  // Demo of the Movepro adapter — delete this (and the section below) in real apps.
  const movepro = createMoveproClient();
  const estimate = await movepro.requestQuote({
    from: { suburb: "Parramatta", state: "NSW", postcode: "2150" },
    to: { suburb: "Newcastle", state: "NSW", postcode: "2300" },
    size: "3-bedroom",
  });

  return (
    <>
      <Header nav={NAV} />

      <main id="main" className="flex-1">
        <div className="bg-brand-950 text-white">
          <Container className="py-16 sm:py-24">
            <p className="mb-3 text-sm font-semibold tracking-widest text-accent-300 uppercase">
              {company.name} · App template
            </p>
            <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Your next project starts here.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-brand-100">
              Branded, responsive and accessible out of the box. Copy this
              template, swap in your pages, and you&apos;re production-ready.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {/* On navy, the yellow "secondary" variant is the high-contrast CTA. */}
              <ButtonLink href="#movepro" variant="secondary" size="lg">
                See the Movepro demo
              </ButtonLink>
              <ButtonLink
                href="https://github.com/MajdSameer/No-Limits-Projects"
                variant="outline"
                size="lg"
                className="border-white text-white hover:bg-brand-900 active:bg-brand-900"
              >
                Read the docs
              </ButtonLink>
            </div>
          </Container>
        </div>

        <Section
          id="included"
          eyebrow="Foundation"
          title="What every app gets for free"
          lead="These come from the shared packages — improve them once, every project benefits."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <Card key={item.title}>
                <h3 className="font-bold text-brand-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section
          id="movepro"
          eyebrow="Adapter demo"
          title="A quote estimate from the Movepro adapter"
          lead="Rendered server-side via createMoveproClient(). Today it's mock data; when API access is confirmed the same call hits the real CRM."
          className="bg-slate-50"
        >
          <Card className="max-w-md">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-bold text-brand-900">
                Parramatta → Newcastle, 3-bedroom
              </h3>
              <span className="rounded-full bg-accent-100 px-2.5 py-1 text-xs font-bold tracking-wide text-accent-800 uppercase">
                {estimate.priceRange.currency} · {movepro.mode} mode
              </span>
            </div>
            <p className="mt-4 text-3xl font-extrabold text-brand-900">
              {formatCurrency(estimate.priceRange.min)} –{" "}
              {formatCurrency(estimate.priceRange.max)}
              {estimate.gst === "exclusive" && (
                <span className="ml-1.5 text-sm font-semibold text-slate-500">+ GST</span>
              )}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              ~{estimate.estimatedHours} hours · {estimate.crewSize} movers ·{" "}
              {estimate.truckSize} truck at {formatCurrency(estimate.hourlyRate ?? 0)}/hr
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {estimate.minimumHours}-hour minimum + {estimate.callout} callout ·{" "}
              {formatCurrency(estimate.depositAmount ?? 0)} refundable deposit · valid
              until {formatDate(estimate.validUntil)}
            </p>
            <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
              {estimate.disclaimer}
            </p>
          </Card>
        </Section>
      </main>

      <Footer />
    </>
  );
}
