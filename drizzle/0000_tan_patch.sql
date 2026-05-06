CREATE TYPE "public"."estimate_period_type" AS ENUM('quarter', 'annual');--> statement-breakpoint
CREATE TYPE "public"."ingestion_status" AS ENUM('running', 'succeeded', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."instrument_type" AS ENUM('stock', 'etf', 'index', 'synthetic');--> statement-breakpoint
CREATE TYPE "public"."valuation_method" AS ENUM('quarterly_sum', 'fiscal_year_interpolation', 'unavailable', 'aggregate');--> statement-breakpoint
CREATE TYPE "public"."valuation_source" AS ENUM('fmp_consensus_ntm_private', 'public_model_ntm', 'manual_override', 'vendor_display_license');--> statement-breakpoint
CREATE TABLE "composition_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_instrument_id" uuid NOT NULL,
	"child_instrument_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"weight" numeric NOT NULL,
	"source" text NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "composition_snapshot_unique" UNIQUE("parent_instrument_id","child_instrument_id","snapshot_date","source")
);
--> statement-breakpoint
CREATE TABLE "estimate_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"period_type" "estimate_period_type" NOT NULL,
	"fiscal_year" integer NOT NULL,
	"fiscal_quarter" integer,
	"period_end_date" date NOT NULL,
	"eps_avg" numeric,
	"eps_low" numeric,
	"eps_high" numeric,
	"analyst_count" integer,
	"source" text NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimate_snapshot_unique" UNIQUE("instrument_id","snapshot_date","period_type","fiscal_year","fiscal_quarter","source")
);
--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"effective_date" date NOT NULL,
	"weight" numeric,
	"source" text NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_membership_effective_unique" UNIQUE("group_id","instrument_id","effective_date")
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_date" date NOT NULL,
	"kind" text NOT NULL,
	"status" "ingestion_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"details" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "instrument_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instrument_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"type" "instrument_type" NOT NULL,
	"exchange" text,
	"sector" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instruments_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"price" numeric NOT NULL,
	"source" text NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_snapshot_unique" UNIQUE("instrument_id","snapshot_date","source")
);
--> statement-breakpoint
CREATE TABLE "valuation_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"method" "valuation_method" NOT NULL,
	"source" "valuation_source" NOT NULL,
	"price" numeric,
	"ntm_eps" numeric,
	"earnings_yield" numeric,
	"forward_pe" numeric,
	"estimate_periods" jsonb,
	"analyst_count" integer,
	"fallback_reason" text,
	"unavailable_reason" text,
	"covered_weight" numeric,
	"missing_weight" numeric,
	"quarterly_sum_weight" numeric,
	"fiscal_year_interpolation_weight" numeric,
	"unavailable_weight" numeric,
	"constituent_count" integer,
	"covered_constituent_count" integer,
	"quarterly_sum_count" integer,
	"fiscal_year_interpolation_count" integer,
	"unavailable_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valuation_snapshot_unique" UNIQUE("instrument_id","snapshot_date","method","source")
);
--> statement-breakpoint
ALTER TABLE "composition_snapshots" ADD CONSTRAINT "composition_snapshots_parent_instrument_id_instruments_id_fk" FOREIGN KEY ("parent_instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composition_snapshots" ADD CONSTRAINT "composition_snapshots_child_instrument_id_instruments_id_fk" FOREIGN KEY ("child_instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_snapshots" ADD CONSTRAINT "estimate_snapshots_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_instrument_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."instrument_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_snapshots" ADD CONSTRAINT "valuation_snapshots_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;