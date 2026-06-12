import type { ReactNode } from "react";

import { company } from "@nlr/config/brand";
import { ButtonLink, Container, CountUp, Footer, Marquee, MobileActionBar, Reveal } from "@nlr/ui";

import { ManifestHeader } from "./ManifestHeader";
import { QuoteCard } from "./QuoteCard";

// Manifest vocabulary, familiar anchors (kept stable for #quote logic).
const NAV = [
  { label: "Fleet", href: "#fleet" },
  { label: "Cargo", href: "#services" },
  { label: "Dispatch", href: "#how" },
  { label: "Promise", href: "#why" },
  { label: "Paperwork", href: "#faq" },
];

const ROUTES = [
  "Lansvale → Bondi",
  "Sydney → Melbourne",
  "Penrith → Newcastle",
  "Sydney → Brisbane",
  "Wollongong → Central Coast",
  "Sydney → Canberra",
  "Parramatta → Gold Coast",
  "Sydney → Adelaide",
];

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
    body: "Truck size, crew and hourly rate upfront. A refundable deposit locks in your date.",
  },
  {
    title: "We do the heavy lifting",
    body: "Trained crews with heavy blankets, shrink wrap, straps and dollies — all included.",
  },
];

const FAQS = [
  {
    q: "How much does my move cost?",
    a: "Moves are priced on truck size, crew and an hourly rate plus GST — the docket above gives you a live ballpark for your size and suburbs. And we price match: we'll beat any comparable written quote where possible.",
  },
  {
    q: "Is the deposit refundable?",
    a: "Yes — the reservation fee and deposit are refundable. Paying it simply locks your date into the schedule.",
  },
  {
    q: "What if my dates change?",
    a: `Plans move; so do we. Rescheduling is flexible with no cancellation fees — call ${company.phoneDisplay} and we'll shift the booking.`,
  },
  {
    q: "Is my furniture protected?",
    a: "Every crew carries heavy blankets, shrink wrap, straps and dollies as standard — padding and wrapping are part of the job, not an extra.",
  },
  {
    q: "Where do you move people?",
    a: "Everywhere. All of Sydney from our Lansvale depot, country NSW, and interstate — Melbourne, Brisbane, Canberra and beyond, door to door.",
  },
  {
    q: "Can you pack for me?",
    a: "Yes — add packing, unpacking, cleaning, storage, utility connections or car relocation to any move. Free site visits and virtual inspections help us scope it.",
  },
];

// 70 bays, one per truck — reviewer-endorsed proof, made visible (no
// hover-dependency: a slow ambient flare animates a scattered handful).
const BAYS = Array.from({ length: company.facts.fleetSize }, (_, i) => i + 1);

const stagger = (step: number) => ({ animationDelay: `${step * 110}ms` });

/** Mono panel kicker: gold dash + manila label. */
function PanelLabel({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={`flex items-center gap-3 font-mono text-xs font-bold tracking-[0.3em] uppercase ${
        dark ? "text-brand-900" : "text-manila-200"
      }`}
    >
      <span aria-hidden className={`h-[3px] w-8 ${dark ? "bg-brand-950" : "bg-accent-400"}`} />
      {children}
    </p>
  );
}

/** Giant outlined title ghosting behind a panel. */
function StencilGhost({ children }: { children: string }) {
  return (
    <span
      aria-hidden
      className="stencil-ghost font-display pointer-events-none absolute -top-4 right-0 text-[clamp(5rem,16vw,13rem)] leading-none font-bold tracking-wide uppercase select-none"
    >
      {children}
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="ink-grain flex min-h-dvh flex-col bg-ink-950 text-manila-100">
      <ManifestHeader nav={NAV} />

      <main id="main" className="flex-1">
        {/* ── HERO: stencil placards left, consignment docket right. */}
        <section className="relative isolate overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(80%_70%_at_70%_0%,var(--color-ink-900)_0%,transparent_65%)] motion-safe:animate-glow"
          />
          <Container className="grid items-center gap-10 py-14 sm:py-18 lg:grid-cols-[1.1fr_minmax(380px,0.9fr)] lg:gap-14 lg:py-20">
            <div>
              <p
                className="font-mono text-xs font-bold tracking-[0.3em] text-accent-400 uppercase motion-safe:animate-fade-up"
                style={stagger(0)}
              >
                Sydney · Country · Interstate
              </p>
              <h1 className="font-display mt-5 text-[clamp(3.5rem,11vw,7.5rem)] leading-[0.88] font-bold tracking-wide uppercase">
                <span className="block motion-safe:animate-fade-up" style={stagger(1)}>
                  Big move?
                </span>
                <span
                  className="block text-accent-400 motion-safe:animate-fade-up"
                  style={stagger(2)}
                >
                  No limits.
                </span>
              </h1>
              <p
                className="mt-6 max-w-md text-lg leading-relaxed text-manila-200 motion-safe:animate-fade-up"
                style={stagger(3)}
              >
                {company.heroLine}
              </p>
              <ul
                className="mt-8 flex flex-wrap gap-2 motion-safe:animate-fade-up"
                style={stagger(4)}
                aria-label="Why people choose us"
              >
                {[
                  `★ ${company.facts.googleRating} · ${company.facts.googleReviewCount.toLocaleString(company.locale)} reviews`,
                  `${company.facts.fleetSize}-truck fleet`,
                  "Family owned",
                ].map((chip) => (
                  <li
                    key={chip}
                    className="border border-brand-700 bg-white/5 px-3.5 py-1.5 font-mono text-xs font-bold tracking-widest text-manila-200 uppercase"
                  >
                    {chip}
                  </li>
                ))}
              </ul>
            </div>

            <div
              id="quote"
              className="scroll-mt-24 motion-safe:animate-fade-up"
              style={stagger(3)}
            >
              <QuoteCard />
            </div>
          </Container>

          {/* Route board */}
          <div className="border-y-2 border-accent-400/60 bg-ink-900/80">
            <Marquee
              items={ROUTES}
              label="Routes we move"
              className="font-display py-3 text-lg font-bold tracking-widest text-manila-200 uppercase"
            />
          </div>
        </section>

        {/* ── THE FLEET: 70 bays, one per truck. */}
        <section id="fleet" className="relative scroll-mt-20 overflow-hidden py-14 sm:py-20">
          <StencilGhost>Fleet</StencilGhost>
          <Container className="relative">
            <Reveal className="max-w-2xl">
              <PanelLabel>The fleet</PanelLabel>
              <h2 className="font-display mt-3 text-4xl font-bold tracking-wide text-manila-100 uppercase sm:text-5xl">
                Seventy bays, zero excuses
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-brand-300">
                One bay per truck at the Lansvale depot. Small, medium or big rig — there's a slot
                with your move's name on it.
              </p>
            </Reveal>

            <Reveal delay={120}>
              <ul
                aria-hidden
                className="mt-10 grid grid-cols-7 gap-1.5 sm:grid-cols-10 sm:gap-2"
              >
                {BAYS.map((n) => (
                  <li
                    key={n}
                    style={n % 9 === 0 ? { animationDelay: `${(n * 137) % 6000}ms` } : undefined}
                    className={`grid aspect-square place-items-center border border-brand-800/70 font-mono text-[0.6rem] font-bold text-brand-700 sm:text-xs ${
                      n % 9 === 0 ? "motion-safe:animate-flare" : ""
                    }`}
                  >
                    {String(n).padStart(2, "0")}
                  </li>
                ))}
              </ul>
            </Reveal>

            <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
              {[
                { value: <CountUp to={company.facts.fleetSize} />, label: "Trucks in the bays" },
                {
                  value: <CountUp to={company.facts.fiveStarReviews} suffix="+" />,
                  label: "Five-star reviews",
                },
                {
                  value: <CountUp to={company.facts.googleRating} decimals={1} suffix="★" />,
                  label: "Rating on Google",
                },
                { value: String(company.facts.foundedYear), label: "Moving families since" },
              ].map((stat, i) => (
                <Reveal key={stat.label} delay={i * 80}>
                  <p className="font-display text-5xl font-bold tracking-wide text-manila-100 sm:text-6xl">
                    {stat.value}
                  </p>
                  <p className="mt-2 font-mono text-[0.65rem] font-bold tracking-[0.25em] text-accent-400 uppercase">
                    {stat.label}
                  </p>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* ── CARGO: services as punched manila freight tags. */}
        <section
          id="services"
          className="relative scroll-mt-20 overflow-hidden border-t-2 border-accent-400/60 py-14 sm:py-20"
        >
          <StencilGhost>Cargo</StencilGhost>
          <Container className="relative">
            <Reveal className="max-w-2xl">
              <PanelLabel>What we carry</PanelLabel>
              <h2 className="font-display mt-3 text-4xl font-bold tracking-wide text-manila-100 uppercase sm:text-5xl">
                Every move, covered
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map((service, i) => (
                <Reveal key={service.title} delay={(i % 3) * 90} className="h-full">
                  <div className="relative h-full bg-manila-100 p-6 pl-9 transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:rotate-[0.4deg]">
                    {/* tag hole */}
                    <span
                      aria-hidden
                      className="absolute top-6 left-3.5 size-3 rounded-full bg-ink-950 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]"
                    />
                    <span className="font-mono text-[0.6rem] font-bold tracking-[0.25em] text-brand-700 uppercase">
                      {service.tag}
                    </span>
                    <h3 className="font-display mt-3 text-2xl font-bold tracking-wide text-brand-950 uppercase">
                      {service.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-brand-900/80">{service.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* ── DISPATCH: the three-step sequence. */}
        <section
          id="how"
          className="relative scroll-mt-20 overflow-hidden border-t-2 border-accent-400/60 py-14 sm:py-20"
        >
          <StencilGhost>Dispatch</StencilGhost>
          <Container className="relative">
            <Reveal className="max-w-2xl">
              <PanelLabel>How dispatch works</PanelLabel>
              <h2 className="font-display mt-3 text-4xl font-bold tracking-wide text-manila-100 uppercase sm:text-5xl">
                Three steps to moving day
              </h2>
            </Reveal>
            <ol className="mt-10 grid gap-10 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <Reveal delay={i * 130}>
                    <p
                      aria-hidden
                      className="stencil-ghost font-display text-6xl font-bold [-webkit-text-stroke-color:rgb(255_212_46/0.5)]"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </p>
                  </Reveal>
                  <Reveal
                    effect="grow-x"
                    delay={i * 130 + 250}
                    className="mt-3 h-1 w-10 bg-accent-400"
                  />
                  <Reveal delay={i * 130 + 120}>
                    <h3 className="mt-4 text-lg font-bold text-manila-100">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-brand-300">{step.body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        {/* ── PROMISE: full gold panel, ink stamps. */}
        <section id="why" className="scroll-mt-20 bg-accent-400 py-14 sm:py-20">
          <Container>
            <Reveal className="max-w-2xl">
              <PanelLabel dark>The promise</PanelLabel>
              <h2 className="font-display mt-3 text-4xl font-bold tracking-wide text-ink-950 uppercase sm:text-5xl">
                The No Limits promise
              </h2>
              <p className="mt-3 font-medium text-brand-950">
                Straight out of every quote we send — hold us to it.
              </p>
            </Reveal>
            <ul className="mt-10 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {company.guarantees.map((guarantee, i) => (
                <li key={guarantee}>
                  <Reveal delay={i * 90} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 grid size-6 shrink-0 place-items-center bg-ink-950 font-mono text-xs font-bold text-accent-400"
                    >
                      ✓
                    </span>
                    <span className="font-semibold text-ink-950">{guarantee}</span>
                  </Reveal>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* ── PAPERWORK: FAQ as manila dockets. */}
        <section id="faq" className="relative scroll-mt-20 overflow-hidden py-14 sm:py-20">
          <StencilGhost>Papers</StencilGhost>
          <Container className="relative max-w-3xl">
            <Reveal>
              <PanelLabel>Paperwork, answered</PanelLabel>
              <h2 className="font-display mt-3 text-4xl font-bold tracking-wide text-manila-100 uppercase sm:text-5xl">
                Questions, answered
              </h2>
            </Reveal>
            <div className="mt-10 space-y-3">
              {FAQS.map((faq, i) => (
                <Reveal key={faq.q} delay={i * 60}>
                  <details className="group bg-manila-100 transition-colors open:shadow-lg open:shadow-black/40">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 p-5 font-bold text-brand-950 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400 [&::-webkit-details-marker]:hidden">
                      {faq.q}
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-5 shrink-0 text-accent-600 transition-transform duration-300 group-open:rotate-180"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>
                    <p className="px-5 pb-5 text-sm leading-relaxed text-brand-900/80">{faq.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
            <Reveal delay={150}>
              <p className="mt-8 text-center text-sm text-brand-300">
                Still deciding?{" "}
                <a
                  href={company.googleReviewsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-manila-100 underline decoration-accent-400 decoration-2 underline-offset-4 transition-colors hover:text-accent-300"
                >
                  Read what {company.facts.googleReviewCount.toLocaleString(company.locale)}{" "}
                  reviewers say on Google
                </a>{" "}
                — or just call {company.phoneDisplay}.
              </p>
            </Reveal>
          </Container>
        </section>

        {/* ── FINAL CALL */}
        <section className="relative isolate overflow-hidden border-t-2 border-accent-400/60">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(70%_90%_at_50%_110%,var(--color-ink-900)_0%,transparent_70%)] motion-safe:animate-glow"
          />
          <Container className="py-16 text-center sm:py-20">
            <Reveal>
              <h2 className="font-display text-4xl font-bold tracking-wide text-manila-100 uppercase sm:text-6xl">
                Move date locked in?
              </h2>
              <p className="mx-auto mt-4 max-w-md text-brand-300">
                Quotes take minutes, and the deposit is refundable. {company.tagline}
              </p>
            </Reveal>
            <Reveal delay={150}>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <ButtonLink href={`tel:${company.phone}`} variant="secondary" size="lg">
                  Call {company.phoneDisplay}
                </ButtonLink>
                <ButtonLink
                  href={`mailto:${company.email}`}
                  variant="outline"
                  size="lg"
                  className="border-manila-100 text-manila-100 hover:bg-ink-900 active:bg-ink-900"
                >
                  Email us instead
                </ButtonLink>
              </div>
            </Reveal>
            <Reveal delay={250}>
              <p className="mt-7 font-mono text-xs tracking-[0.2em] text-brand-300 uppercase">
                <span aria-hidden className="text-accent-400">
                  ★★★★★
                </span>{" "}
                {company.facts.googleRating} from{" "}
                {company.facts.googleReviewCount.toLocaleString(company.locale)} Google reviews
              </p>
            </Reveal>
          </Container>
        </section>
      </main>

      <Footer />
      <div aria-hidden className="h-24 md:hidden" />
      <MobileActionBar className="border-manila-400 bg-manila-100/95" />
    </div>
  );
}
