/**
 * Domain types for the Movepro adapter.
 *
 * These model OUR view of the moving business, not Movepro's API shapes —
 * when real API access is confirmed, the live client maps Movepro's payloads
 * into these types so app code never changes.
 */

/** ISO 8601 date-time string, e.g. "2026-06-11T09:00:00+10:00" */
export type ISODateString = string;

export interface Address {
  line1?: string;
  suburb: string;
  state: string;
  postcode: string;
}

export interface ContactDetails {
  firstName: string;
  lastName?: string;
  /** E.164 preferred, e.g. "+61412345678" */
  phone: string;
  email?: string;
}

/** Rough size of the move — drives quote estimates and crew planning. */
export type MoveSize =
  | "few-items"
  | "studio"
  | "1-bedroom"
  | "2-bedroom"
  | "3-bedroom"
  | "4-bedroom-plus"
  | "office";

export type LeadStatus = "new" | "contacted" | "quoted" | "won" | "lost";

export interface LeadInput {
  contact: ContactDetails;
  from: Address;
  to: Address;
  size?: MoveSize;
  /** Preferred move date, if the customer has one. */
  moveDate?: ISODateString;
  notes?: string;
  /** Where this lead came from, e.g. "quote-calculator", "landing-page". */
  source: string;
}

export interface Lead extends LeadInput {
  id: string;
  status: LeadStatus;
  createdAt: ISODateString;
}

export interface QuoteRequest {
  from: Address;
  to: Address;
  size: MoveSize;
  moveDate?: ISODateString;
  /** Stairs, lifts, parking, long carries — anything that affects time. */
  accessNotes?: string;
}

/**
 * Shaped after the company's real quote emails: truck size + movers +
 * hourly rate plus GST + callout, with a 2-hour minimum and a refundable
 * deposit to secure the booking.
 */
export interface QuoteEstimate {
  id: string;
  priceRange: {
    min: number;
    max: number;
    /** ISO 4217, e.g. "AUD" */
    currency: string;
  };
  basis: "hourly" | "fixed";
  hourlyRate?: number;
  /** The company quotes hourly rates exclusive of GST. */
  gst?: "inclusive" | "exclusive";
  estimatedHours?: number;
  /** Minimum billable hours (company policy: 2). */
  minimumHours?: number;
  /** Callout charge as quoted, e.g. "45 minutes". */
  callout?: string;
  crewSize?: number;
  /** e.g. "10-tonne" */
  truckSize?: string;
  /** Deposit that secures a booking (refundable per company policy). */
  depositAmount?: number;
  validUntil: ISODateString;
  /** Always show this next to an estimate — it is not a binding quote. */
  disclaimer: string;
}

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in-progress"
  | "completed"
  | "cancelled";

export interface Booking {
  id: string;
  leadId?: string;
  contact: ContactDetails;
  from: Address;
  to: Address;
  status: BookingStatus;
  scheduledAt: ISODateString;
  crewSize: number;
  trucks: number;
  /** Total including GST, in dollars. Unset until priced. */
  totalIncGst?: number;
}
