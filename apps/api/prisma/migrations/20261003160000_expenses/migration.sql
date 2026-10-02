-- CreateEnum
CREATE TYPE "ExpenseClaimStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseStage" AS ENUM ('MANAGER', 'FINANCE', 'HR');

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "max_per_item_paise" INTEGER,
    "receipt_required_above_paise" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "project_id" UUID,
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "round" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "paid_by_id" UUID,
    "payment_date" DATE,
    "payment_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "claim_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "approved_paise" INTEGER,
    "adjust_reason" TEXT,
    "adjusted_by_id" UUID,
    "receipt_key" TEXT,
    "receipt_name" TEXT,
    "receipt_mime" TEXT,
    "receipt_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "claim_id" UUID NOT NULL,
    "round" INTEGER NOT NULL,
    "stage" "ExpenseStage" NOT NULL,
    "approver_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "label" TEXT,
    "status" "LeaveApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "acted_by_id" UUID,
    "on_behalf_of_id" UUID,
    "comments" TEXT,
    "acted_at" TIMESTAMP(3),

    CONSTRAINT "expense_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_company_id_name_key" ON "expense_categories"("company_id", "name");

-- CreateIndex
CREATE INDEX "expense_claims_company_id_status_idx" ON "expense_claims"("company_id", "status");

-- CreateIndex
CREATE INDEX "expense_claims_company_id_employee_id_idx" ON "expense_claims"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "expense_items_claim_id_idx" ON "expense_items"("claim_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_approvals_claim_id_round_stage_key" ON "expense_approvals"("claim_id", "round", "stage");

-- AddForeignKey
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approvals" ADD CONSTRAINT "expense_approvals_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

