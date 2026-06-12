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

export const staff = pgTable("staff", {
  id: text("id").primaryKey(), // slug, e.g. "andy"
  name: text("name").notNull(),
  role: role("role").notNull().default("rep"),
  pinHash: text("pin_hash").notNull(),
  /** Fair-share lead weighting from the sheet (v2 lead queue uses it). */
  intakeWeight: numeric("intake_weight").notNull().default("1.0"),
  active: boolean("active").notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
