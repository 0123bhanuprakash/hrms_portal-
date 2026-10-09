-- CreateEnum
CREATE TYPE "LeaveAdjustmentKind" AS ENUM ('EXTRA', 'LEND', 'CORRECTION', 'DEDUCTION', 'TAKEN_BACK', 'WAIVED');

-- CreateEnum
CREATE TYPE "ExtraLeaveStatus" AS ENUM ('PENDING', 'LENT', 'GIVEN', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "leave_balance_adjustments" ADD COLUMN     "kind" "LeaveAdjustmentKind" NOT NULL DEFAULT 'CORRECTION',
ADD COLUMN     "lend_limit" DOUBLE PRECISION,
ADD COLUMN     "request_id" UUID;

-- AlterTable
ALTER TABLE "leave_balances" ADD COLUMN     "carried_out" DOUBLE PRECISION,
ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "lapsed" DOUBLE PRECISION,
ADD COLUMN     "lend_limit" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "owed_left" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "owed_out" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "leave_types" ADD COLUMN     "recover_negative" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "extra_leave_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "reason" TEXT NOT NULL,
    "status" "ExtraLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "decided_days" DOUBLE PRECISION,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extra_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extra_leave_requests_company_id_status_idx" ON "extra_leave_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "extra_leave_requests_company_id_employee_id_idx" ON "extra_leave_requests"("company_id", "employee_id");

-- AddForeignKey
ALTER TABLE "extra_leave_requests" ADD CONSTRAINT "extra_leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_leave_requests" ADD CONSTRAINT "extra_leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing manual adjustments: days added = extra, days removed = deduction
UPDATE "leave_balance_adjustments" SET "kind" = CASE WHEN "days" > 0 THEN 'EXTRA'::"LeaveAdjustmentKind" ELSE 'DEDUCTION'::"LeaveAdjustmentKind" END;

-- Years already over are treated as closed, so nothing is taken back from them after the fact
UPDATE "leave_balances" SET "closed_at" = CURRENT_TIMESTAMP WHERE "year" < EXTRACT(YEAR FROM CURRENT_DATE);
