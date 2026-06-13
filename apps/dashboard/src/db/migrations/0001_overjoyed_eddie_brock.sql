CREATE TYPE "public"."gender" AS ENUM('f', 'm', 'x');--> statement-breakpoint
CREATE TYPE "public"."team" AS ENUM('orange', 'blue');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" text,
	"source" text
);
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "gender" "gender" DEFAULT 'x' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "team" "team";--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;