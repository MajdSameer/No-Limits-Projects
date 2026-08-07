CREATE TABLE "game_day_results" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"orange_total" integer NOT NULL,
	"blue_total" integer NOT NULL,
	"winner" "team",
	"top_scorer_ids" jsonb NOT NULL,
	"reps" jsonb NOT NULL,
	"team_prize" integer NOT NULL,
	"top_scorer_prize" integer NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "game_day_results_date_unique" ON "game_day_results" USING btree ("date");