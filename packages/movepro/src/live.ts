import { MoveproConfigError, type MoveproClient } from "./client";
import type {
  Booking,
  ISODateString,
  Lead,
  LeadInput,
  QuoteEstimate,
  QuoteRequest,
} from "./types";

export interface LiveMoveproConfig {
  apiKey: string;
  baseUrl: string;
}

/**
 * Placeholder for the real Movepro integration.
 *
 * Movepro API/webhook availability is UNCONFIRMED (see TODO.md for the open
 * questions to put to Movepro). Once access is confirmed:
 *
 *   1. Implement each method below against the real API.
 *   2. Map Movepro's payloads into the types in ./types.ts — do NOT leak
 *      Movepro's shapes into app code.
 *   3. Cover the mapping with a few tests against recorded responses.
 *   4. Flip apps over by setting MOVEPRO_MODE=live + MOVEPRO_API_KEY in
 *      Vercel env vars. No app code changes should be needed.
 */
export class LiveMoveproClient implements MoveproClient {
  readonly mode = "live" as const;

  constructor(private readonly config: LiveMoveproConfig) {}

  async ping(): Promise<{ ok: boolean; mode: "mock" | "live" }> {
    return this.notImplemented("ping");
  }

  async createLead(_input: LeadInput): Promise<Lead> {
    return this.notImplemented("createLead");
  }

  async getLead(_id: string): Promise<Lead | null> {
    return this.notImplemented("getLead");
  }

  async listLeads(_filter?: { status?: Lead["status"] }): Promise<Lead[]> {
    return this.notImplemented("listLeads");
  }

  async requestQuote(_request: QuoteRequest): Promise<QuoteEstimate> {
    return this.notImplemented("requestQuote");
  }

  async getBooking(_id: string): Promise<Booking | null> {
    return this.notImplemented("getBooking");
  }

  async listBookings(_range?: {
    from?: ISODateString;
    to?: ISODateString;
  }): Promise<Booking[]> {
    return this.notImplemented("listBookings");
  }

  private notImplemented(method: string): never {
    throw new MoveproConfigError(
      `LiveMoveproClient.${method} is not implemented — Movepro API access is unconfirmed. ` +
        `Use mock mode (MOVEPRO_MODE=mock or unset), and see TODO.md for the integration plan. ` +
        `(configured baseUrl: ${this.config.baseUrl})`,
    );
  }
}
