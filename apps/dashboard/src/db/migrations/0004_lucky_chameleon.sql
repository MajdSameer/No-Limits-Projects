CREATE TABLE "lead_inbox" (
	"id" text PRIMARY KEY NOT NULL,
	"sheet_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text,
	"contact_name" text,
	"phone" text,
	"email" text,
	"details" text,
	"allocated_to" text,
	"allocated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "lead_inbox" ADD CONSTRAINT "lead_inbox_allocated_to_staff_id_fk" FOREIGN KEY ("allocated_to") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_inbox_sheet_id_unique" ON "lead_inbox" USING btree ("sheet_id");