import type { ReactNode } from "react";

import { company } from "@nlr/config/brand";
import {
  ButtonLink,
  Container,
  CountUp,
  Footer,
  Header,
  Marquee,
  MobileActionBar,
  Reveal,
} from "@nlr/ui";

import { QuoteCard } from "./QuoteCard";

const NAV = [
  { label: "Services", href: "#services" },
  { label: "How it works", href: "#how" },
  { label: "Why us", href: "#why" },
  { label: "FAQ", href: "#faq" },
];

// Routes we actually run — the marquee reads like a depot destination board.
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
    body: "Truck size, crew and hourly rate upfront. A refundable deposit locks in your date.",
  },
  {
    title: "We do the heavy lifting",
    body: "Trained crews with heavy blankets, shrink wrap, straps and dollies — all included.",
  },
];

// Objection handling, built only from the company's own claims (quote email,
// site, Google listing) — never invent policies here.
const FAQS = [
  {
    q: "How much does my move cost?",
    a: `Moves are priced on truck size, crew and an hourly rate plus GST — the estimate card above gives you a live ballpark for your size and suburbs. And we price match: we'll beat any comparable written quote where possible.`,
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

// Hero load choreography: each element enters in order.
const stagger = (step: number) => ({ animationDelay: `${step * 110}ms` });

/** Section kicker: a short gold road-line + navy label. */
function Eyebrow({ children, onAccent = false }: { children: ReactNode; onAccent?: boolean }) {
  return (
    <p
      className={`flex items-center gap-3 text-sm font-bold tracking-[0.2em] uppercase ${
        onAccent ? "text-brand-800" : "text-brand-600"
      }`}
    >
      <span
        aria-hidden
        className={`h-[3px] w-8 rounded-full ${onAccent ? "bg-brand-900" : "bg-accent-400"}`}
      />
      {children}
    </p>
  );
}

export default function HomePage() {
  return (
    <>
      <Header nav={NAV} logoSrc={company.logoAnimatedUrl} />

      <main id="main" className="flex-1">
        {/* ── Hero: the thesis is the price. Headline left, live quote right. */}
        <div className="relative isolate overflow-hidden bg-brand-900 text-white">
          <div aria-hidden className="absolute inset-x-0 top-0 z-10 h-1 bg-accent-400" />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(85%_75%_at_75%_0%,var(--color-brand-800)_0%,transparent_65%)] motion-safe:animate-glow"
          />
          <Container className="grid items-center gap-10 py-14 sm:py-18 lg:grid-cols-[1.1fr_minmax(380px,0.9fr)] lg:gap-14 lg:py-20">
            <div>
              <p
                className="flex items-center gap-3 text-sm font-bold tracking-[0.2em] text-accent-400 uppercase motion-safe:animate-fade-up"
                style={stagger(0)}
              >
                <span aria-hidden className="h-[3px] w-8 rounded-full bg-accent-400" />
                Sydney · Country · Interstate
              </p>
              <h1 className="font-display mt-4 text-[clamp(3.5rem,10vw,6.5rem)] leading-[0.9] font-bold tracking-wide uppercase">
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
                className="mt-5 max-w-md text-lg leading-relaxed text-brand-100 motion-safe:animate-fade-up"
                style={stagger(3)}
              >
                {company.heroLine}
              </p>
              <ul
                className="mt-7 flex flex-wrap gap-2 motion-safe:animate-fade-up"
                style={stagger(4)}
                aria-label="Why people choose us"
              >
                {[
                  `★ ${company.facts.googleRating} on Google (${company.facts.googleReviewCount.toLocaleString(company.locale)} reviews)`,
                  `${company.facts.fleetSize}-truck fleet`,
                  "Family owned & operated",
                ].map((chip) => (
                  <li
                    key={chip}
                    className="rounded-full border border-brand-700 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-brand-100"
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

          {/* Destination board: slow ambient ticker of real routes. */}
          <div className="border-t border-brand-800 bg-brand-950/60">
            <Marquee
              items={ROUTES}
              label="Routes we move"
              className="font-display py-3 text-lg font-bold tracking-widest text-brand-200 uppercase"
            />
          </div>
        </div>

        {/* ── Numbers band: the facts, oversized and counting. */}
        <section aria-label="Company facts" className="border-b border-slate-200 bg-white">
          <Container className="grid grid-cols-2 gap-x-6 gap-y-8 py-10 sm:grid-cols-4 sm:py-12">
            {[
              {
                value: <CountUp to={company.facts.fleetSize} />,
                label: "Trucks in the fleet",
              },
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
              <Reveal key={stat.label} delay={i * 80} className="text-center">
                <p className="font-display text-5xl font-bold tracking-wide text-brand-900 sm:text-6xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
                  {stat.label}
                </p>
              </Reveal>
            ))}
          </Container>
        </section>

        {/* ── Services */}
        <section id="services" className="scroll-mt-20 py-14 sm:py-20">
          <Container>
            <Reveal className="max-w-2xl">
              <Eyebrow>What we move</Eyebrow>
              <h2 className="font-display mt-3 text-4xl font-bold tracking-wide text-brand-900 uppercase sm:text-5xl">
                Every move, covered
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map((service, i) => (
                <Reveal key={service.title} delay={(i % 3) * 90} className="h-full">
                  <div className="rounded-card h-full border border-slate-200 bg-white p-6 transition-all duration-300 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-900/5 motion-safe:hover:-translate-y-1">
                    <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-[0.65rem] font-bold tracking-widest text-brand-700 uppercase">
                      {service.tag}
                    </span>
                    <h3 className="mt-4 text-lg font-bold text-brand-900">{service.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{service.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* ── How it works: a real sequence, so numbers carry meaning. */}
        <section id="how" className="scroll-mt-20 bg-slate-50 py-14 sm:py-20">
          <Container>
            <Reveal className="max-w-2xl">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="font-display mt-3 text-4xl font-bold tracking-wide text-brand-900 uppercase sm:text-5xl">
                Three steps to moving day
              </h2>
            </Reveal>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <Reveal delay={i * 130}>
                    <p className="font-display text-5xl font-bold text-brand-300" aria-hidden>
                      {i + 1}
                    </p>
                  </Reveal>
                  <Reveal
                    effect="grow-x"
                    delay={i * 130 + 250}
                    className="mt-2 h-1 w-9 bg-accent-400"
                  />
                  <Reveal delay={i * 130 + 120}>
                    <h3 className="mt-4 text-lg font-bold text-brand-900">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        {/* ── The promise: their own guarantees on their own email yellow. */}
        <section id="why" className="scroll-mt-20 bg-accent-200 py-14 sm:py-20">
          <Container>
            <Reveal className="max-w-2xl">
              <Eyebrow onAccent>Why us</Eyebrow>
              <h2 className="font-display mt-3 text-4xl font-bold tracking-wide text-brand-950 uppercase sm:text-5xl">
                The No Limits promise
              </h2>
              <p className="mt-3 font-medium text-brand-900">
                Straight out of every quote we send — hold us to it.
              </p>
            </Reveal>
            <ul className="mt-10 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {company.guarantees.map((guarantee, i) => (
                <li key={guarantee}>
                  <Reveal delay={i * 90} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-900 text-xs font-bold text-accent-300"
                    >
                      ✓
                    </span>
                    <span className="font-semibold text-brand-950">{guarantee}</span>
                  </Reveal>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* ── FAQ: the questions people ring up with, answered in our voice. */}
        <section id="faq" className="scroll-mt-20 py-14 sm:py-20">
          <Container className="max-w-3xl">
            <Reveal>
              <Eyebrow>Good to know</Eyebrow>
              <h2 className="font-display mt-3 text-4xl font-bold tracking-wide text-brand-900 uppercase sm:text-5xl">
                Questions, answered
              </h2>
            </Reveal>
            <div className="mt-10 space-y-3">
              {FAQS.map((faq, i) => (
                <Reveal key={faq.q} delay={i * 60}>
                  <details className="group rounded-card border border-slate-200 bg-white transition-colors open:border-brand-300 open:shadow-md open:shadow-brand-900/5 hover:border-brand-200">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-card p-5 font-bold text-brand-900 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 [&::-webkit-details-marker]:hidden">
                      {faq.q}
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-5 shrink-0 text-brand-400 transition-transform duration-300 group-open:rotate-180 group-open:text-brand-700"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>
                    <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600">{faq.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
            <Reveal delay={150}>
              <p className="mt-8 text-center text-sm text-slate-600">
                Still deciding?{" "}
                <a
                  href={company.googleReviewsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand-800 underline decoration-accent-400 decoration-2 underline-offset-4 transition-colors hover:text-brand-600"
                >
                  Read what {company.facts.googleReviewCount.toLocaleString(company.locale)}{" "}
                  reviewers say on Google
                </a>{" "}
                — or just call {company.phoneDisplay}.
              </p>
            </Reveal>
          </Container>
        </section>

        {/* ── Final call to action */}
        <section className="relative isolate overflow-hidden bg-brand-950 text-white">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(70%_90%_at_50%_110%,var(--color-brand-800)_0%,transparent_70%)] motion-safe:animate-glow"
          />
          <Container className="py-16 text-center sm:py-20">
            <Reveal>
              <h2 className="font-display text-4xl font-bold tracking-wide uppercase sm:text-6xl">
                Move date locked in?
              </h2>
              <p className="mx-auto mt-4 max-w-md text-brand-100">
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
                  className="border-white text-white hover:bg-brand-900 active:bg-brand-900"
                >
                  Email us instead
                </ButtonLink>
              </div>
            </Reveal>
            <Reveal delay={250}>
              <p className="mt-7 text-sm text-brand-100">
                <span aria-hidden className="tracking-[0.25em] text-accent-400">
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
      {/* Keeps the fixed action bar from covering the footer on phones. */}
      <div aria-hidden className="h-24 md:hidden" />
      <MobileActionBar />
    </>
  );
}
