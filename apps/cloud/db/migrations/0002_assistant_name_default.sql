-- Default assistant name → 'Aivoy' (was 'Assistant'). Backfill rows still
-- on the old default so existing tenants pick it up too. Tenants who
-- explicitly renamed are left alone.

ALTER TABLE "assistants" ALTER COLUMN "name" SET DEFAULT 'Aivoy';--> statement-breakpoint

UPDATE "assistants" SET "name" = 'Aivoy' WHERE "name" = 'Assistant';
