CREATE TYPE "public"."booking_status" AS ENUM('booked', 'deposit', 'confirmed', 'completed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."booking_type" AS ENUM('moving', 'storage', 'cleaning', 'car');--> statement-breakpoint
CREATE TYPE "public"."clock_kind" AS ENUM('in', 'break_start', 'break_end', 'out');--> statement-breakpoint
CREATE TYPE "public"."company" AS ENUM('NL', 'PM', 'RRR');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('rep', 'manager');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"diff" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"job_number" text NOT NULL,
	"company" "company" DEFAULT 'NL' NOT NULL,
	"type" "booking_type" DEFAULT 'moving' NOT NULL,
	"status" "booking_status" DEFAULT 'booked' NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"customer_email" text,
	"pickup" text,
	"delivery" text,
	"state" text,
	"move_date" date NOT NULL,
	"value" numeric,
	"deposit" numeric,
	"beds" integer,
	"cubic" integer,
	"men" integer,
	"lead_source" text,
	"notes" text,
	"sales_rep_id" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "clock_events" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"kind" "clock_kind" NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'self' NOT NULL,
	"edited_by" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"daily_target" integer NOT NULL,
	"effective_from" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start" time NOT NULL,
	"end" time NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" "role" DEFAULT 'rep' NOT NULL,
	"pin_hash" text NOT NULL,
	"intake_weight" numeric DEFAULT '1.0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_off" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_sales_rep_id_staff_id_fk" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_job_number_unique" ON "bookings" USING btree ("job_number");