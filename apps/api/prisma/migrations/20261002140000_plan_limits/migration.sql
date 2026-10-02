-- Plan-level limits (instead of repeating them on every plan feature) and per-company limit overrides
ALTER TABLE "plans" ADD COLUMN "limits" JSONB;
ALTER TABLE "companies" ADD COLUMN "limits" JSONB;

-- Carry existing limits over from plan_features
UPDATE "plans" p
SET "limits" = (SELECT pf."limits" FROM "plan_features" pf WHERE pf."plan_id" = p."id" AND pf."limits" IS NOT NULL LIMIT 1);
UPDATE "plan_features" SET "limits" = NULL;
