-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "timesheets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "total_minutes" INTEGER NOT NULL DEFAULT 0,
    "approver_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "approver_label" TEXT,
    "submitted_at" TIMESTAMP(3),
    "decided_by_id" UUID,
    "on_behalf_of_id" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "timesheet_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "project_id" UUID,
    "task" TEXT NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "minutes" INTEGER NOT NULL,
    "line" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "timesheet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timesheets_company_id_status_week_start_idx" ON "timesheets"("company_id", "status", "week_start");

-- CreateIndex
CREATE INDEX "timesheets_company_id_week_start_idx" ON "timesheets"("company_id", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_employee_id_week_start_key" ON "timesheets"("employee_id", "week_start");

-- CreateIndex
CREATE INDEX "timesheet_entries_timesheet_id_idx" ON "timesheet_entries"("timesheet_id");

-- CreateIndex
CREATE INDEX "timesheet_entries_company_id_project_id_date_idx" ON "timesheet_entries"("company_id", "project_id", "date");

-- CreateIndex
CREATE INDEX "timesheet_entries_company_id_employee_id_date_idx" ON "timesheet_entries"("company_id", "employee_id", "date");

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

