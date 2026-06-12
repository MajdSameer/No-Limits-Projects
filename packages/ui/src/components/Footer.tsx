import { company } from "@nlr/config/brand";

import { Container } from "./Container";

/** Branded site footer. Company details come from @nlr/config/brand. */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    // brand-900 (#182646) matches the company's own email footer.
    <footer className="mt-auto bg-brand-900 text-brand-100">
      <Container className="py-10 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-lg font-extrabold tracking-tight text-white">
              {company.name}
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed">
              {company.tagline} Family owned and operated, moving homes and
              offices across Sydney and Australia — over{" "}
              {company.facts.fiveStarReviews.toLocaleString(company.locale)}{" "}
              five-star reviews.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold tracking-widest text-white uppercase">
              Contact
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a className="hover:text-white hover:underline" href={`tel:${company.phone}`}>
                  {company.phoneDisplay}
                </a>{" "}
                · {company.hoursDisplay}
              </li>
              <li>
                <a className="hover:text-white hover:underline" href={`mailto:${company.email}`}>
                  {company.email}
                </a>
              </li>
              <li>
                <a
                  className="hover:text-white hover:underline"
                  href={`mailto:${company.emailGeneral}`}
                >
                  {company.emailGeneral}
                </a>
              </li>
              <li>
                {company.address.line1}, {company.address.suburb}{" "}
                {company.address.state} {company.address.postcode}
              </li>
              <li>Offices: {company.offices.join(" · ")}</li>
              <li>
                <a
                  className="hover:text-white hover:underline"
                  href={company.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Facebook
                </a>
              </li>
              <li>
                <a
                  className="hover:text-white hover:underline"
                  href={company.termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms and conditions
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold tracking-widest text-white uppercase">
              Services
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {company.services.map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-brand-800 pt-6 text-xs text-brand-300">
          <p>
            © {year} {company.legalName} · ABN {company.abn}
          </p>
        </div>
      </Container>
    </footer>
  );
}
