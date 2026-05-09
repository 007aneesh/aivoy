ALTER TABLE "assistants" ALTER COLUMN "name" SET DEFAULT 'Aivoy';--> statement-breakpoint
ALTER TABLE "integration_tokens" ADD COLUMN "daily_token_cap" integer;--> statement-breakpoint
ALTER TABLE "integration_tokens" ADD COLUMN "per_turn_token_cap" integer;