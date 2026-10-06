-- AlterTable
ALTER TABLE "attendance_policies" ADD COLUMN     "auto_close_after_minutes" INTEGER,
ADD COLUMN     "correction_alert_at" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "late_alert_at" INTEGER,
ADD COLUMN     "optional_holiday_limit" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "auto_closed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "shift_id" UUID;

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "document_key" TEXT,
ADD COLUMN     "document_mime" TEXT,
ADD COLUMN     "document_name" TEXT,
ADD COLUMN     "document_size" INTEGER;

-- AlterTable
ALTER TABLE "leave_types" ADD COLUMN     "block_during_probation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "carry_expiry" TEXT,
ADD COLUMN     "document_after_days" INTEGER,
ADD COLUMN     "negative_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sandwich_rule" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public_holidays" ADD COLUMN     "location_ids" UUID[] DEFAULT ARRAY[]::UUID[];

-- CreateTable
CREATE TABLE "work_shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#7C3AED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_choices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "holiday_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_choices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_shifts_company_id_idx" ON "work_shifts"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_shifts_company_id_name_key" ON "work_shifts"("company_id", "name");

-- CreateIndex
CREATE INDEX "holiday_choices_company_id_employee_id_idx" ON "holiday_choices"("company_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_choices_employee_id_holiday_id_key" ON "holiday_choices"("employee_id", "holiday_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "work_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_choices" ADD CONSTRAINT "holiday_choices_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_choices" ADD CONSTRAINT "holiday_choices_holiday_id_fkey" FOREIGN KEY ("holiday_id") REFERENCES "public_holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

