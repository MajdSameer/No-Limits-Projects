import type {
  Booking,
  ISODateString,
  Lead,
  LeadInput,
  QuoteEstimate,
  QuoteRequest,
} from "./types";

/**
 * The contract every Movepro implementation fulfils (mock today, live later).
 * App code depends on THIS interface — never on a concrete implementation —
 * so swapping mock → live is a config change, not a refactor.
 */
export interface MoveproClient {
  /** Which implementation is answering — surface this in dev UIs. */
  readonly mode: "mock" | "live";

  /** Cheap connectivity/health check. */
  ping(): Promise<{ ok: boolean; mode: "mock" | "live" }>;

  /** Push a new lead into the CRM pipeline. */
  createLead(input: LeadInput): Promise<Lead>;

  getLead(id: string): Promise<Lead | null>;

  listLeads(filter?: { status?: Lead["status"] }): Promise<Lead[]>;

  /** Get an indicative price estimate for a move. */
  requestQuote(request: QuoteRequest): Promise<QuoteEstimate>;

  getBooking(id: string): Promise<Booking | null>;

  listBookings(range?: {
    from?: ISODateString;
    to?: ISODateString;
  }): Promise<Booking[]>;
}

/** Thrown when the live client is selected but not usable yet. */
export class MoveproConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoveproConfigError";
  }
}
