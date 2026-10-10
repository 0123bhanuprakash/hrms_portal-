-- Internship end date + conversion
ALTER TABLE "employees" ADD COLUMN "internship_end_date" DATE;
ALTER TABLE "employees" ADD COLUMN "skip_auto_convert" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "company_settings" ADD COLUMN "internship_end_action" TEXT NOT NULL DEFAULT 'remind';
