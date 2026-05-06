ALTER TABLE "estimate_snapshots" ALTER COLUMN "fiscal_quarter" SET DEFAULT 0;--> statement-breakpoint
UPDATE "estimate_snapshots" SET "fiscal_quarter" = 0 WHERE "fiscal_quarter" IS NULL;--> statement-breakpoint
ALTER TABLE "estimate_snapshots" ALTER COLUMN "fiscal_quarter" SET NOT NULL;
