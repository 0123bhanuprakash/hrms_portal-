-- CreateEnum
CREATE TYPE "LeaveAccrual" AS ENUM ('UPFRONT', 'MONTHLY', 'NONE');

-- CreateEnum
CREATE TYPE "HalfDaySession" AS ENUM ('FIRST_HALF', 'SECOND_HALF');

-- AlterEnum
ALTER TYPE "LeaveTypeCategory" ADD VALUE 'WORK_FROM_HOME';

-- DropForeignKey
ALTER TABLE "leave_balances" DROP CONSTRAINT "leave_balances_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "leave_balances" DROP CONSTRAINT "leave_balances_leave_type_id_fkey";

-- DropForeignKey
ALTER TABLE "leave_requests" DROP CONSTRAINT "leave_requests_employee_id_fkey";

-- DropIndex
DROP INDEX "leave_approvals_leave_request_id_idx";

-- AlterTable
ALTER TABLE "leave_approvals" ADD COLUMN     "acted_by_id" UUID,
ADD COLUMN     "on_behalf_of_id" UUID,
ALTER COLUMN "approver_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "leave_balances" DROP COLUMN "total_days",
ADD COLUMN     "adjusted" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "allocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_id" UUID,
ADD COLUMN     "decided_at" TIMESTAMP(3),
ADD COLUMN     "half_day" "HalfDaySession",
ADD COLUMN     "required_levels" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "leave_types" DROP COLUMN "days_allowed_per_year",
DROP COLUMN "max_levels",
DROP COLUMN "requires_approval",
ADD COLUMN     "accrual" "LeaveAccrual" NOT NULL DEFAULT 'UPFRONT',
ADD COLUMN     "allow_half_day" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "annual_quota" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "approval_levels" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#6366F1',
ADD COLUMN     "counts_as_present" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "include_non_working_days" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "max_consecutive_days" INTEGER,
ADD COLUMN     "min_notice_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "max_carry_forward" SET DEFAULT 0,
ALTER COLUMN "max_carry_forward" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "leave_balance_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "balance_id" UUID NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "adjusted_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balance_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_balance_adjustments_balance_id_idx" ON "leave_balance_adjustments"("balance_id");

-- CreateIndex
CREATE INDEX "leave_approvals_approver_id_status_idx" ON "leave_approvals"("approver_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "leave_approvals_leave_request_id_level_key" ON "leave_approvals"("leave_request_id", "level");

-- CreateIndex
CREATE INDEX "leave_requests_company_id_start_date_end_date_idx" ON "leave_requests"("company_id", "start_date", "end_date");

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_adjustments" ADD CONSTRAINT "leave_balance_adjustments_balance_id_fkey" FOREIGN KEY ("balance_id") REFERENCES "leave_balances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_adjustments" ADD CONSTRAINT "leave_balance_adjustments_adjusted_by_id_fkey" FOREIGN KEY ("adjusted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approvals" ADD CONSTRAINT "leave_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approvals" ADD CONSTRAINT "leave_approvals_acted_by_id_fkey" FOREIGN KEY ("acted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approvals" ADD CONSTRAINT "leave_approvals_on_behalf_of_id_fkey" FOREIGN KEY ("on_behalf_of_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

