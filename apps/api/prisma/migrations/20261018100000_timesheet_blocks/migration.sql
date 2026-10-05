-- AlterTable
ALTER TABLE "timesheet_entries" ADD COLUMN     "approver_ids" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "approver_label" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "decided_at" TIMESTAMP(3),
ADD COLUMN     "decided_by_id" UUID,
ADD COLUMN     "decision_note" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "end_min" INTEGER,
ADD COLUMN     "on_behalf_of_id" UUID,
ADD COLUMN     "start_min" INTEGER,
ADD COLUMN     "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "work_type" TEXT;

-- CreateIndex
CREATE INDEX "timesheet_entries_company_id_status_idx" ON "timesheet_entries"("company_id", "status");


-- Existing grid rows take their week's status and approvers
UPDATE "timesheet_entries" e
SET "status" = t."status", "approver_ids" = t."approver_ids", "approver_label" = t."approver_label",
    "submitted_at" = t."submitted_at", "decided_by_id" = t."decided_by_id", "on_behalf_of_id" = t."on_behalf_of_id",
    "decided_at" = t."decided_at", "decision_note" = t."decision_note"
FROM "timesheets" t
WHERE t."id" = e."timesheet_id";

-- Grid placeholders (0 minutes) aren't work
DELETE FROM "timesheet_entries" WHERE "minutes" = 0;
