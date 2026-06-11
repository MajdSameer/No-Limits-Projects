/**
 * Company constants and locale helpers — the single source of truth for
 * "who we are" across every app. Values marked TODO are placeholders;
 * the full list lives in /TODO.md.
 */

export const company = {
  name: "No Limits Removalists",
  /** TODO: confirm registered legal entity name. */
  legalName: "No Limits Removalists Pty Ltd",
  /** TODO: confirm or replace with the real tagline from the website. */
  tagline: "Sydney removalists who go the distance.",
  /**
   * The company's public website — managed externally; we don't own or
   * control this domain or its DNS. Our tools deploy to Vercel URLs
   * (see TODO.md → Hosting domain).
   */
  domain: "nolimitsremovalists.com.au",
  url: "https://nolimitsremovalists.com.au",
  /** TODO: real phone number. E.164 format, used in tel: links. */
  phone: "+61255550000",
  /** TODO: real phone number, as displayed to humans. */
  phoneDisplay: "(02) 5555 0000",
  /** TODO: confirm the real contact email. */
  email: "info@nolimitsremovalists.com.au",
  /** TODO: real ABN. */
  abn: "00 000 000 000",
  address: {
    /** TODO: depot suburb. */
    suburb: "Sydney",
    state: "NSW",
    country: "Australia",
  },
  locale: "en-AU",
  currency: "AUD",
  timezone: "Australia/Sydney",
  /**
   * Marketing facts gathered from public listings — TODO: verify with the
   * company before using in customer-facing copy.
   */
  facts: {
    foundedYear: 2016,
    afraAccredited: true,
    fleetSize: 24,
    teamSize: 60,
  },
  services: [
    "Home removals",
    "Office removals",
    "Local Sydney moves",
    "Country relocations",
    "Interstate moves",
  ],
} as const;

/**
 * Brand hex values for places CSS tokens can't reach (theme-color meta tags,
 * email templates, OG images). MUST stay in sync with tailwind/theme.css.
 */
export const brandColors = {
  /** --color-brand-900 */
  navy: "#11264c",
  /** --color-accent-500 */
  orange: "#f9621a",
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
