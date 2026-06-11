import { MoveproConfigError, type MoveproClient } from "./client";
import type {
  Booking,
  ISODateString,
  Lead,
  LeadInput,
  MoveSize,
  QuoteEstimate,
  QuoteRequest,
} from "./types";

/** Indicative pricing model for mock quotes — tune freely, it's demo data.
 *  The SHAPE mirrors real company quotes (truck + movers + rate ex-GST +
 *  callout + 2-hour minimum + $200 deposit); the numbers are placeholders. */
const HOURLY_RATE_AUD = 169;
const MINIMUM_HOURS = 2;
const DEPOSIT_AUD = 200;
const CALLOUT = "45 minutes";
const SIZE_SPECS: Record<MoveSize, { hours: number; crew: number; truck: string }> = {
  "few-items": { hours: 2, crew: 2, truck: "4.5-tonne" },
  studio: { hours: 3, crew: 2, truck: "4.5-tonne" },
  "1-bedroom": { hours: 4, crew: 2, truck: "8-tonne" },
  "2-bedroom": { hours: 6, crew: 3, truck: "8-tonne" },
  "3-bedroom": { hours: 8, crew: 3, truck: "10-tonne" },
  "4-bedroom-plus": { hours: 10, crew: 4, truck: "12-tonne" },
  office: { hours: 9, crew: 4, truck: "10-tonne" },
};

function daysFromNow(days: number): ISODateString {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function roundToTen(n: number): number {
  return Math.round(n / 10) * 10;
}

/**
 * In-memory Movepro stand-in. Ships with seed data so dashboards and lists
 * have something to render. State resets on every server restart — fine for
 * development, never for production writes you care about.
 */
export class MockMoveproClient implements MoveproClient {
  readonly mode = "mock" as const;

  private leads = new Map<string, Lead>();
  private bookings = new Map<string, Booking>();
  private counter = 0;

  constructor() {
    this.seed();
  }

  async ping(): Promise<{ ok: boolean; mode: "mock" | "live" }> {
    return { ok: true, mode: this.mode };
  }

  async createLead(input: LeadInput): Promise<Lead> {
    const lead: Lead = {
      ...input,
      id: this.nextId("lead"),
      status: "new",
      createdAt: new Date().toISOString(),
    };
    this.leads.set(lead.id, lead);
    return lead;
  }

  async getLead(id: string): Promise<Lead | null> {
    return this.leads.get(id) ?? null;
  }

  async listLeads(filter?: { status?: Lead["status"] }): Promise<Lead[]> {
    const all = [...this.leads.values()];
    return filter?.status ? all.filter((l) => l.status === filter.status) : all;
  }

  async requestQuote(request: QuoteRequest): Promise<QuoteEstimate> {
    const spec = SIZE_SPECS[request.size];
    if (spec === undefined) {
      throw new MoveproConfigError(`Unknown move size: ${String(request.size)}`);
    }
    const min = roundToTen(Math.max(spec.hours, MINIMUM_HOURS) * HOURLY_RATE_AUD);
    const max = roundToTen(min * 1.35);
    return {
      id: this.nextId("quote"),
      priceRange: { min, max, currency: "AUD" },
      basis: "hourly",
      hourlyRate: HOURLY_RATE_AUD,
      gst: "exclusive",
      estimatedHours: spec.hours,
      minimumHours: MINIMUM_HOURS,
      callout: CALLOUT,
      crewSize: spec.crew,
      truckSize: spec.truck,
      depositAmount: DEPOSIT_AUD,
      validUntil: daysFromNow(14),
      disclaimer:
        "Indicative estimate only — final pricing is confirmed after a review of your inventory and access details.",
    };
  }

  async getBooking(id: string): Promise<Booking | null> {
    return this.bookings.get(id) ?? null;
  }

  async listBookings(range?: {
    from?: ISODateString;
    to?: ISODateString;
  }): Promise<Booking[]> {
    return [...this.bookings.values()].filter((b) => {
      if (range?.from && b.scheduledAt < range.from) return false;
      if (range?.to && b.scheduledAt > range.to) return false;
      return true;
    });
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_mock_${String(this.counter).padStart(4, "0")}`;
  }

  private seed(): void {
    const sampleLead: Lead = {
      id: this.nextId("lead"),
      status: "quoted",
      createdAt: daysFromNow(-2),
      source: "seed-data",
      contact: { firstName: "Sarah", lastName: "Chen", phone: "+61400111222", email: "sarah@example.com" },
      from: { suburb: "Parramatta", state: "NSW", postcode: "2150" },
      to: { suburb: "Newcastle", state: "NSW", postcode: "2300" },
      size: "3-bedroom",
      moveDate: daysFromNow(12),
      notes: "Piano on the ground floor.",
    };
    this.leads.set(sampleLead.id, sampleLead);

    const sampleBooking: Booking = {
      id: this.nextId("booking"),
      leadId: sampleLead.id,
      contact: sampleLead.contact,
      from: sampleLead.from,
      to: sampleLead.to,
      status: "confirmed",
      scheduledAt: daysFromNow(12),
      crewSize: 3,
      trucks: 1,
      totalIncGst: 1890,
    };
    this.bookings.set(sampleBooking.id, sampleBooking);
  }
}
