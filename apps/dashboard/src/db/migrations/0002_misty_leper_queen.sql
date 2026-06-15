CREATE TABLE "rep_live" (
	"staff_id" text PRIMARY KEY NOT NULL,
	"bookings_today" integer DEFAULT 0 NOT NULL,
	"job_codes" jsonb,
	"time_in" text,
	"break_start" text,
	"break_end" text,
	"time_out" text,
	"working_hours" text,
	"as_of_date" date NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rep_live" ADD CONSTRAINT "rep_live_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;