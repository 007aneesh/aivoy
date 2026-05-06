-- Add tenant-level webhook signing secret + drop the per-tool one.
ALTER TABLE "tenants" ADD COLUMN "webhook_signing_secret" text;--> statement-breakpoint

-- Backfill existing rows with a random secret. Uses md5+random for portability
-- (no pgcrypto extension needed). New tenants get a stronger crypto-random
-- secret from application code; this only runs once per migration deploy.
UPDATE "tenants"
SET "webhook_signing_secret" =
  'whsec_'
  || md5(random()::text || clock_timestamp()::text || id::text)
  || md5(random()::text || id::text)
WHERE "webhook_signing_secret" IS NULL;--> statement-breakpoint

ALTER TABLE "tenants" ALTER COLUMN "webhook_signing_secret" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "tools" DROP COLUMN IF EXISTS "webhook_secret";
