/**
 * No Limits Ops data model. Mirrors the decoded Google Sheets semantics:
 * staff intake weights + daily goals (Leaderboard cols A/C), booking rows
 * keyed by MovePro job number, clock events, weekly roster, audit trail.
 * See docs/superpowers/specs/2026-06-12-staff-dashboard-design.md.
 */
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const role = pgEnum("role", ["rep", "manager"]);
export const company = pgEnum("company", ["NL", "PM", "RRR"]);
export const bookingType = pgEnum("booking_type", ["moving", "storage", "cleaning", "car"]);
export const bookingStatus = pgEnum("booking_status", [
  "booked",
  "deposit",
  "confirmed",
  "completed",
  "cancelled",
  "refunded",
]);
export const clockKind = pgEnum("clock_kind", ["in", "break_start", "break_end", "out"]);
/** Drives the board's pink/blue cell colours; "x" = unspecified/neutral. */
export const gender = pgEnum("gender", ["f", "m", "x"]);
/** Game Day team. Null until assigned. */
export const team = pgEnum("team", ["orange", "blue"]);

export const staff = pgTable("staff", {
  id: text("id").primaryKey(), // slug, e.g. "andy"
  name: text("name").notNull(),
  role: role("role").notNull().default("rep"),
  pinHash: text("pin_hash").notNull(),
  /** Fair-share lead weighting from the sheet — drives live allocation. */
  intakeWeight: numeric("intake_weight").notNull().default("1.0"),
  gender: gender("gender").notNull().default("x"),
  team: team("team"),
  active: boolean("active").notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Small key/value store for app-wide flags (e.g. game_day = "on"). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Allocated leads — feeds the live "who's up next" allocator. */
export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  staffId: text("staff_id")
    .notNull()
    .references(() => staff.id),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  assignedBy: text("assigned_by"),
  source: text("source"),
});

export const bookings = pgTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    /** MovePro job number — numeric ("115678") or code ("98RRX") form. */
    jobNumber: text("job_number").notNull(),
    company: company("company").notNull().default("NL"),
    type: bookingType("type").notNull().default("moving"),
    status: bookingStatus("status").notNull().default("booked"),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    customerEmail: text("customer_email"),
    pickup: text("pickup"),
    delivery: text("delivery"),
    state: text("state"),
    moveDate: date("move_date").notNull(),
    value: numeric("value"),
    deposit: numeric("deposit"),
    beds: integer("beds"),
    cubic: integer("cubic"),
    men: integer("men"),
    leadSource: text("lead_source"),
    notes: text("notes"),
    /** Job carried out by a subcontractor (e.g. Domanic), not a floor rep. */
    subcontractor: boolean("subcontractor").notNull().default(false),
    salesRepId: text("sales_rep_id")
      .notNull()
      .references(() => staff.id),
    /** Leaderboard key: Daily/Monthly bucket on this, Sydney time. */
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by")
      .notNull()
      .references(() => staff.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("bookings_job_number_unique").on(t.jobNumber)],
);

export const clockEvents = pgTable("clock_events", {
  id: text("id").primaryKey(),
  staffId: text("staff_id")
    .notNull()
    .references(() => staff.id),
  kind: clockKind("kind").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  /** self | manager | system (midnight auto-close) */
  source: text("source").notNull().default("self"),
  editedBy: text("edited_by"),
  note: text("note"),
});

export const shifts = pgTable("shifts", {
  id: text("id").primaryKey(),
  staffId: text("staff_id")
    .notNull()
    .references(() => staff.id),
  /** 0 = Monday … 6 = Sunday (matches the roster grid). */
  weekday: integer("weekday").notNull(),
  start: time("start").notNull(),
  end: time("end").notNull(),
  note: text("note"),
});

export const timeOff = pgTable("time_off", {
  id: text("id").primaryKey(),
  staffId: text("staff_id")
    .notNull()
    .references(() => staff.id),
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
  reason: text("reason"),
});

export const goals = pgTable("goals", {
  id: text("id").primaryKey(),
  staffId: text("staff_id")
    .notNull()
    .references(() => staff.id),
  dailyTarget: integer("daily_target").notNull(),
  effectiveFrom: date("effective_from").notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull(),
  action: text("action").notNull(), // e.g. "booking.create"
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  diff: jsonb("diff"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Near-real-time mirror of the company "Leaderboard" tab, pushed by the
 * spreadsheet's Apps Script (api/ingest/leaderboard). One row per rep,
 * overwritten on every push. The SHEET stays the source of truth for these
 * volatile floor numbers — this table just reflects them so the board can
 * show them live without the app having to own bookings/clock entry.
 */
export const repLive = pgTable("rep_live", {
  staffId: text("staff_id")
    .primaryKey()
    .references(() => staff.id),
  /** Bookings entered today (Leaderboard "Number of Bookings"). */
  bookingsToday: integer("bookings_today").notNull().default(0),
  /** The individual MovePro job codes behind today's count, in sheet order. */
  jobCodes: jsonb("job_codes").$type<string[]>(),
  /** Clock fields, kept as the sheet's display strings (e.g. "08:00", "06:41"). */
  timeIn: text("time_in"),
  breakStart: text("break_start"),
  breakEnd: text("break_end"),
  timeOut: text("time_out"),
  workingHours: text("working_hours"),
  /** Sydney date this snapshot is for ("yyyy-MM-dd"). */
  asOfDate: date("as_of_date").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Incoming quote leads mirrored from the "Quote Leads" sheet (api/ingest/leads).
 * Deduped on the sheet's own row id. New leads are auto-allocated to the rep
 * who's next up (recorded in `leads`), with allocatedTo set here for display.
 */
export const leadInbox = pgTable(
  "lead_inbox",
  {
    id: text("id").primaryKey(),
    /** Stable id from the sheet (Quote Leads "Auto" col N) — dedup key. */
    sheetId: text("sheet_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source"),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    details: text("details"),
    /** Rep this lead was auto-allocated to (null = awaiting an eligible rep). */
    allocatedTo: text("allocated_to").references(() => staff.id),
    allocatedAt: timestamp("allocated_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("lead_inbox_sheet_id_unique").on(t.sheetId)],
);
