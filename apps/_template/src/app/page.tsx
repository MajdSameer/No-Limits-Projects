import { company } from "@nlr/config/brand";
import { ButtonLink, Container, Footer, Header } from "@nlr/ui";

import { QuoteCard } from "./QuoteCard";

const NAV = [
  { label: "Services", href: "#services" },
  { label: "How it works", href: "#how" },
  { label: "Why us", href: "#why" },
];

// Tags encode real coverage, not decoration.
const SERVICES = [
  {
    tag: "Homes",
    title: "Home removals",
    body: "Full-house moves with trained crews who pad, wrap and load like it's their nan's china.",
  },
  {
    tag: "Offices",
    title: "Office removals",
    body: "Desks out Friday night, working Monday morning. Minimal downtime, no surprises.",
  },
  {
    tag: "Sydney-wide",
    title: "Local Sydney moves",
    body: "Based in Lansvale with slots across the metro — the whole city counts as local.",
  },
  {
    tag: "NSW-wide",
    title: "Country relocations",
    body: "Sydney to the regions and back, with door-to-door timelines you can plan around.",
  },
  {
    tag: "Australia-wide",
    title: "Interstate moves",
    body: "Melbourne, Brisbane and beyond — one crew, one truck, one point of contact.",
  },
  {
    tag: "Add-ons",
    title: "Packing & extras",
    body: "Packing, unpacking, cleaning, storage, utility connections — bolt on what you need.",
  },
];

const STEPS = [
  {
    title: "Tell us about your move",
    body: `Size, suburbs and date — two minutes online, or call ${company.phoneDisplay}.`,
  },
  {
    title: "Get your price",
    body: "Truck size, crew and hourly rate upfront. A $200 refundable deposit locks in your date.",
  },
  {
    title: "We do the heavy lifting",
    body: "Trained crews with heavy blankets, shrink wrap, straps and dollies — all included.",
  },
];

export default function HomePage() {
  return (
    <>
      <Header nav={NAV} />

      <main id="main" className="flex-1">
        {/* ── Hero: the thesis is the price. Headline left, live quote right. */}
        <div className="relative isolate overflow-hidden bg-brand-900 text-white">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-accent-400" />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(85%_75%_at_75%_0%,var(--color-brand-800)_0%,transparent_65%)]"
          />
          <Container className="grid items-center gap-10 py-14 sm:py-18 lg:grid-cols-[1.1fr_minmax(380px,0.9fr)] lg:gap-14 lg:py-20">
            <div>
              <p className="text-sm font-bold tracking-[0.2em] text-accent-400 uppercase">
                Sydney · Country · Interstate
              </p>
              <h1 className="font-display mt-4 text-[clamp(3.5rem,10vw,6.5rem)] leading-[0.9] font-bold tracking-wide uppercase">
                Big move?
                <br />
                <span className="text-accent-400">No limits.</span>
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-brand-100">
                {company.heroLine}
              </p>
              <ul className="mt-7 flex flex-wrap gap-2" aria-label="Why people choose us">
                {[
                  `★ ${company.facts.googleRating} on Google (${company.facts.googleReviewCount.toLocaleString(company.locale)} reviews)`,
                  `${company.facts.fleetSize}-truck fleet`,
                  "Family owned & operated",
                ].map((chip) => (
                  <li
                    key={chip}
                    className="rounded-full border border-brand-700 px-3.5 py-1.5 text-sm font-medium text-brand-100"
                  >
                    {chip}
                  </li>
                ))}
              </ul>
            </div>

            <QuoteCard />
          </Container>
        </div>

        {/* ── Numbers band: the facts, oversized. */}
        <section aria-label="Company facts" className="border-b border-slate-200 bg-white">
          <Container className="grid grid-cols-2 gap-x-6 gap-y-8 py-10 sm:grid-cols-4 sm:py-12">
            {[
              { value: String(company.facts.fleetSize), label: "Trucks in the fleet" },
              {
                value: `${company.facts.fiveStarReviews.toLocaleString(company.locale)}+`,
                label: "Five-star reviews",
              },
              { value: `${company.facts.googleRating}★`, label: "Rating on Google" },
              { value: String(company.facts.foundedYear), label: "Moving families since" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-5xl font-bold tracking-wide text-brand-900 sm:text-6xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
                  {stat.label}
                </p>
              </div>
            ))}
          </Container>
        </section>

        {/* ── Services */}
        <section id="services" className="py-14 sm:py-20">
          <Container>
            <div className="max-w-2xl">
              <p className="text-sm font-bold tracking-[0.2em] text-accent-700 uppercase">
                What we move
              </p>
              <h2 className="font-display mt-2 text-4xl font-bold tracking-wide text-brand-900 uppercase sm:text-5xl">
                Every move, covered
              </h2>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map((service) => (
                <div
                  key={service.title}
                  className="rounded-card border border-slate-200 bg-white p-6 transition-shadow hover:shadow-lg hover:shadow-brand-900/5"
                >
                  <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-[0.65rem] font-bold tracking-widest text-brand-700 uppercase">
                    {service.tag}
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-brand-900">{service.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{service.body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── How it works: a real sequence, so numbers carry meaning. */}
        <section id="how" className="bg-slate-50 py-14 sm:py-20">
          <Container>
            <div className="max-w-2xl">
              <p className="text-sm font-bold tracking-[0.2em] text-accent-700 uppercase">
                How it works
              </p>
              <h2 className="font-display mt-2 text-4xl font-bold tracking-wide text-brand-900 uppercase sm:text-5xl">
                Three steps to moving day
              </h2>
            </div>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <p className="font-display text-5xl font-bold text-brand-200" aria-hidden>
                    {i + 1}
                  </p>
                  <div className="mt-2 h-1 w-9 bg-accent-400" aria-hidden />
                  <h3 className="mt-4 text-lg font-bold text-brand-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        {/* ── The promise: their own guarantees on their own email yellow. */}
        <section id="why" className="bg-accent-200 py-14 sm:py-20">
          <Container>
            <div className="max-w-2xl">
              <p className="text-sm font-bold tracking-[0.2em] text-brand-800 uppercase">
                Why us
              </p>
              <h2 className="font-display mt-2 text-4xl font-bold tracking-wide text-brand-950 uppercase sm:text-5xl">
                The No Limits promise
              </h2>
              <p className="mt-3 font-medium text-brand-900">
                Straight out of every quote we send — hold us to it.
              </p>
            </div>
            <ul className="mt-10 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {company.guarantees.map((guarantee) => (
                <li key={guarantee} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-900 text-xs font-bold text-accent-300"
                  >
                    ✓
                  </span>
                  <span className="font-semibold text-brand-950">{guarantee}</span>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* ── Final call to action */}
        <section className="relative isolate overflow-hidden bg-brand-950 text-white">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(70%_90%_at_50%_110%,var(--color-brand-800)_0%,transparent_70%)]"
          />
          <Container className="py-16 text-center sm:py-20">
            <h2 className="font-display text-4xl font-bold tracking-wide uppercase sm:text-6xl">
              Move date locked in?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-brand-100">
              Quotes take minutes, and the deposit is refundable. {company.tagline}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href={`tel:${company.phone}`} variant="secondary" size="lg">
                Call {company.phoneDisplay}
              </ButtonLink>
              <ButtonLink
                href={`mailto:${company.email}`}
                variant="outline"
                size="lg"
                className="border-white text-white hover:bg-brand-900 active:bg-brand-900"
              >
                Email us instead
              </ButtonLink>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}
