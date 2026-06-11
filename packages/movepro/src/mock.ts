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

/** Indicative pricing model for mock quotes — tune freely, it's demo data. */
const HOURLY_RATE_AUD = 169;
const SIZE_HOURS: Record<MoveSize, number> = {
  "few-items": 2,
  studio: 3,
  "1-bedroom": 4,
  "2-bedroom": 6,
  "3-bedroom": 8,
  "4-bedroom-plus": 10,
  office: 9,
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
    const hours = SIZE_HOURS[request.size];
    if (hours === undefined) {
      throw new MoveproConfigError(`Unknown move size: ${String(request.size)}`);
    }
    const min = roundToTen(hours * HOURLY_RATE_AUD);
    const max = roundToTen(min * 1.35);
    return {
      id: this.nextId("quote"),
      priceRange: { min, max, currency: "AUD" },
      basis: "hourly",
      hourlyRate: HOURLY_RATE_AUD,
      estimatedHours: hours,
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
