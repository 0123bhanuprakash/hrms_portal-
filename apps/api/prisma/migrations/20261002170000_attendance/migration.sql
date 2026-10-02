-- CreateEnum
CREATE TYPE "RegularisationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "check_in_ip" TEXT,
ADD COLUMN     "check_in_source" TEXT,
ADD COLUMN     "check_out_ip" TEXT,
ADD COLUMN     "check_out_source" TEXT,
ADD COLUMN     "late_minutes" INTEGER;

-- CreateTable
CREATE TABLE "attendance_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "work_days" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "shift_start" TEXT NOT NULL DEFAULT '09:30',
    "shift_end" TEXT NOT NULL DEFAULT '18:30',
    "grace_minutes" INTEGER NOT NULL DEFAULT 15,
    "half_day_minutes" INTEGER NOT NULL DEFAULT 240,
    "full_day_minutes" INTEGER NOT NULL DEFAULT 480,
    "regularisation_window_days" INTEGER NOT NULL DEFAULT 30,
    "web_check_in_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_regularisations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "check_in" TIMESTAMP(3) NOT NULL,
    "check_out" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "RegularisationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" UUID,
    "on_behalf_of_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_regularisations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_policies_company_id_key" ON "attendance_policies"("company_id");

-- CreateIndex
CREATE INDEX "attendance_regularisations_company_id_status_idx" ON "attendance_regularisations"("company_id", "status");

-- CreateIndex
CREATE INDEX "attendance_regularisations_company_id_employee_id_date_idx" ON "attendance_regularisations"("company_id", "employee_id", "date");

-- AddForeignKey
ALTER TABLE "attendance_regularisations" ADD CONSTRAINT "attendance_regularisations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularisations" ADD CONSTRAINT "attendance_regularisations_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularisations" ADD CONSTRAINT "attendance_regularisations_on_behalf_of_id_fkey" FOREIGN KEY ("on_behalf_of_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

