/**
 * Company constants and locale helpers — the single source of truth for
 * "who we are" across every app. Primary source: the company's own quote
 * email + Google Business listing (captured 11 Jun 2026). Remaining gaps
 * are tracked in /TODO.md.
 *
 * Deliberately NOT stored here: the company's bank account details (they
 * appear in quote emails but are payment-operations data, not config).
 */

export const company = {
  name: "No Limits Removalists",
  /** Confirmed — appears as the account name in the company's quote emails. */
  legalName: "No Limits Removalists Pty Ltd",
  /** The company's own line, from their quote emails. */
  tagline: "It takes a family to move a family.",
  /** Hero line from the company's website. */
  heroLine:
    "From Coast to Coast, we take your move from tiring and stressful, to effortlessly easy.",
  /**
   * The company's public website — managed externally; we don't own or
   * control this domain or its DNS. Our tools deploy to Vercel URLs
   * (see TODO.md → Hosting domain).
   */
  domain: "nolimitsremovalists.com.au",
  url: "https://nolimitsremovalists.com.au",
  /**
   * The animated logo GIF the company's own site header uses, hotlinked from
   * their WordPress uploads (we can't vendor the file yet — see TODO.md →
   * Logo files). Anything rendering it must keep a text fallback in case the
   * URL ever breaks; we don't control that server.
   */
  logoAnimatedUrl:
    "https://nolimitsremovalists.com.au/wp-content/uploads/2024/07/logo-no-limits-animated.gif",
  /** Their public Google reviews — a search link until a Place ID is recorded. */
  googleReviewsUrl:
    "https://www.google.com/search?q=No+Limits+Removalists+reviews",
  /** From quote emails + Google listing. E.164-ish form for tel: links. */
  phone: "+611300609117",
  phoneDisplay: "1300 609 117",
  /**
   * The quotes inbox used in their emails. General enquiries go to
   * emailGeneral (from the website's contact page).
   */
  email: "quote@nolimitsremovalists.com.au",
  /** General enquiries inbox, listed on the website. */
  emailGeneral: "info@nolimitsremovalists.com.au",
  /** Phone hours from the website's contact page: Monday–Sunday. */
  hoursDisplay: "6am–9pm, 7 days",
  /** Office locations the website lists besides the Lansvale depot. */
  offices: ["Parramatta NSW", "Melbourne VIC"],
  social: {
    /** Their Facebook page (found Jun 2026). */
    facebook: "https://www.facebook.com/nolimitsremovalists.booknow/",
  },
  /** From the company's own ops records (Jun 2026). */
  abn: "69 657 017 822",
  /** Depot, from the Google Business listing. */
  address: {
    line1: "Unit 6/76 Hume Hwy",
    suburb: "Lansvale",
    state: "NSW",
    postcode: "2166",
    country: "Australia",
  },
  locale: "en-AU",
  currency: "AUD",
  timezone: "Australia/Sydney",
  /** Public T&Cs document the company links from every quote email. */
  termsUrl:
    "https://drive.google.com/file/d/1PRJvNSQZXzHxIfuAlsykK3fVFxvML9_X/view",
  /**
   * Marketing facts — snapshot Jun 2026. fleetSize/fiveStarReviews/guarantees
   * come from the company's own quote email; foundedYear/afraAccredited/
   * teamSize come from public listings (TODO: verify those before
   * customer-facing use). Review counts drift — refresh before quoting them.
   */
  facts: {
    foundedYear: 2016,
    afraAccredited: true,
    fleetSize: 70,
    teamSize: 60,
    fiveStarReviews: 5000,
    googleRating: 4.9,
    googleReviewCount: 5130,
  },
  services: [
    "Home removals",
    "Office removals",
    "Local Sydney moves",
    "Country relocations",
    "Interstate moves",
  ],
  /** Add-on services, from the quote email + the website's quote form. */
  addOnServices: [
    "Packing",
    "Unpacking",
    "Cleaning",
    "Storage",
    "Free site visits",
    "Virtual site inspections",
    "Utility connections",
    "Car relocation",
  ],
  /** Standing offers the company makes in every quote email + website. */
  guarantees: [
    "Refundable reservation fee and deposit",
    "Flexible rescheduling with no cancellation fees",
    "Price matching — we'll beat any comparable written quote where possible",
    "No hidden costs",
    "Our own crews and trucks on every job — we never use subcontractors",
    "Honest quotes up-front — no surprises",
  ],
  /** What comes standard, from the quote email + website. */
  inclusions: [
    "Heavy blankets, shrink wrap, straps and dollies on every truck",
    "Packing materials and protective coverings available",
    "Flexible storage solutions",
    "Free site visits and virtual inspections",
  ],
} as const;

/**
 * Brand hex values for places CSS tokens can't reach (theme-color meta tags,
 * email templates, OG images). MUST stay in sync with tailwind/theme.css.
 */
export const brandColors = {
  /** --color-brand-900 — exact navy from the company's quote email. */
  navy: "#182646",
  /** --color-accent-400 — CTA gold from the company's website. */
  yellow: "#ffd42e",
} as const;

const currencyFormatter = new Intl.NumberFormat(company.locale, {
  style: "currency",
  currency: company.currency,
  maximumFractionDigits: 0,
});

/** Format a dollar amount the Australian way: $1,250 */
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

const dateFormatter = new Intl.DateTimeFormat(company.locale, {
  dateStyle: "medium",
  timeZone: company.timezone,
});

/** Format a date the Australian way: 11 June 2026 -> "11 Jun 2026" */
export function formatDate(date: Date | string): string {
  return dateFormatter.format(typeof date === "string" ? new Date(date) : date);
}
