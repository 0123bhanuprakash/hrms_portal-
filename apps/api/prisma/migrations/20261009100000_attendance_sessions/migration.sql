-- Check in and out many times a day: a trail of every tap, sessions on the day record, night shifts per project member
CREATE TYPE "PunchKind" AS ENUM ('IN', 'OUT');

ALTER TABLE "attendance_records" ADD COLUMN "sessions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "break_minutes" INTEGER,
ADD COLUMN "open_since" TIMESTAMP(3),
ADD COLUMN "early_checkout" BOOLEAN NOT NULL DEFAULT false;

-- Existing days: one session; a day still open keeps running from its check-in
UPDATE "attendance_records" SET "sessions" = 1 WHERE "check_in" IS NOT NULL;
UPDATE "attendance_records" SET "open_since" = "check_in" WHERE "check_in" IS NOT NULL AND "check_out" IS NULL;

CREATE TABLE "attendance_punches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "kind" "PunchKind" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'WEB',
    "device_id" TEXT,
    "ip" TEXT,
    "note" TEXT,
    "early" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_punches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "attendance_punches_company_id_employee_id_date_idx" ON "attendance_punches"("company_id", "employee_id", "date");
CREATE INDEX "attendance_punches_record_id_idx" ON "attendance_punches"("record_id");
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trail for existing web check-ins / check-outs
INSERT INTO "attendance_punches" ("company_id", "employee_id", "record_id", "date", "kind", "at", "source", "ip")
SELECT "company_id", "employee_id", "id", "date", 'IN', "check_in", COALESCE("check_in_source", 'WEB'), "check_in_ip" FROM "attendance_records" WHERE "check_in" IS NOT NULL;
INSERT INTO "attendance_punches" ("company_id", "employee_id", "record_id", "date", "kind", "at", "source", "ip")
SELECT "company_id", "employee_id", "id", "date", 'OUT', "check_out", COALESCE("check_out_source", 'WEB'), "check_out_ip" FROM "attendance_records" WHERE "check_out" IS NOT NULL;

ALTER TABLE "project_members" ADD COLUMN "night_shift" BOOLEAN NOT NULL DEFAULT false;
