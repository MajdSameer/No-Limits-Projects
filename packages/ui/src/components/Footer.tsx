import { company } from "@nlr/config/brand";

import { Container } from "./Container";

/** Branded site footer. Company details come from @nlr/config/brand. */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-brand-950 text-brand-100">
      <Container className="py-10 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-lg font-extrabold tracking-tight text-white">
              {company.name}
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed">
              Family-run, AFRA-accredited removalists moving homes and offices
              across Sydney and Australia since {company.facts.foundedYear}.
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
                </a>
              </li>
              <li>
                <a className="hover:text-white hover:underline" href={`mailto:${company.email}`}>
                  {company.email}
                </a>
              </li>
              <li>
                {company.address.suburb}, {company.address.state}
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
