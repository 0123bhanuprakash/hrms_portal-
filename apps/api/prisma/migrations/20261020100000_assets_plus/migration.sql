-- AlterTable
ALTER TABLE "asset_assignments" ADD COLUMN     "due_back" DATE;

-- AlterTable
ALTER TABLE "asset_requests" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'KEEP',
ADD COLUMN     "lead_approver_id" UUID,
ADD COLUMN     "lead_at" TIMESTAMP(3),
ADD COLUMN     "lead_by_id" UUID,
ADD COLUMN     "lead_note" TEXT,
ADD COLUMN     "lead_status" "LeaveApprovalStatus" NOT NULL DEFAULT 'SKIPPED',
ADD COLUMN     "loan_from" DATE,
ADD COLUMN     "loan_until" DATE,
ADD COLUMN     "manager_approver_id" UUID,
ADD COLUMN     "manager_at" TIMESTAMP(3),
ADD COLUMN     "manager_by_id" UUID,
ADD COLUMN     "manager_note" TEXT,
ADD COLUMN     "manager_status" "LeaveApprovalStatus" NOT NULL DEFAULT 'SKIPPED',
ADD COLUMN     "needed_by" DATE,
ADD COLUMN     "requested_by_id" UUID,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'REQUEST',
ADD COLUMN     "stage" TEXT;

-- AlterTable
ALTER TABLE "asset_types" ADD COLUMN     "checklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "description" TEXT,
ADD COLUMN     "fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "icon" TEXT NOT NULL DEFAULT 'box',
ADD COLUMN     "loanable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "max_loan_days" INTEGER,
ADD COLUMN     "min_stock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "replace_after_years" INTEGER,
ADD COLUMN     "requestable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "warranty_months" INTEGER;

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "specs" JSONB;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "asset_id" UUID;

-- CreateTable
CREATE TABLE "asset_repairs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "issue" TEXT NOT NULL,
    "vendor" TEXT,
    "cost_paise" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_id" UUID,

    CONSTRAINT "asset_repairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "due_on" DATE NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "started_by_id" UUID,

    CONSTRAINT "asset_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_check_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "check_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "answer" TEXT NOT NULL,
    "note" TEXT,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_check_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "starter_kit_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_base" BOOLEAN NOT NULL DEFAULT false,
    "role_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "designation_contains" TEXT,
    "department_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "items" JSONB NOT NULL,
    "on_promotion" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "starter_kit_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_repairs_asset_id_idx" ON "asset_repairs"("asset_id");

-- CreateIndex
CREATE INDEX "asset_repairs_company_id_ended_at_idx" ON "asset_repairs"("company_id", "ended_at");

-- CreateIndex
CREATE INDEX "asset_documents_asset_id_idx" ON "asset_documents"("asset_id");

-- CreateIndex
CREATE INDEX "asset_checks_company_id_closed_at_idx" ON "asset_checks"("company_id", "closed_at");

-- CreateIndex
CREATE INDEX "asset_check_answers_check_id_employee_id_idx" ON "asset_check_answers"("check_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_check_answers_check_id_assignment_id_key" ON "asset_check_answers"("check_id", "assignment_id");

-- CreateIndex
CREATE INDEX "starter_kit_rules_company_id_idx" ON "starter_kit_rules"("company_id");

-- AddForeignKey
ALTER TABLE "asset_repairs" ADD CONSTRAINT "asset_repairs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_documents" ADD CONSTRAINT "asset_documents_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_check_answers" ADD CONSTRAINT "asset_check_answers_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "asset_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Pictures and sensible defaults for the built-in types
UPDATE "asset_types" SET "icon" = CASE "prefix"
  WHEN 'LAP' THEN 'laptop' WHEN 'MON' THEN 'monitor' WHEN 'PHN' THEN 'phone' WHEN 'IDC' THEN 'idcard'
  WHEN 'HDS' THEN 'headset' WHEN 'KBM' THEN 'keyboard' WHEN 'SIM' THEN 'sim' ELSE 'box' END;
UPDATE "asset_types" SET "warranty_months" = 12, "replace_after_years" = 4, "loanable" = true, "max_loan_days" = 30,
  "fields" = ARRAY['Processor','Memory','Storage','OS'], "checklist" = ARRAY['Charger','Tag sticker on the base'] WHERE "prefix" = 'LAP';
UPDATE "asset_types" SET "warranty_months" = 36, "replace_after_years" = 6, "loanable" = true, "max_loan_days" = 30, "checklist" = ARRAY['Power and display cables'] WHERE "prefix" = 'MON';
UPDATE "asset_types" SET "warranty_months" = 12, "replace_after_years" = 3, "loanable" = true, "max_loan_days" = 30, "fields" = ARRAY['IMEI'], "checklist" = ARRAY['Charger'] WHERE "prefix" = 'PHN';
UPDATE "asset_types" SET "loanable" = true, "max_loan_days" = 30 WHERE "prefix" = 'HDS';

-- Requests still waiting: put them on the step that's pending
UPDATE "asset_requests" SET "stage" = CASE WHEN "hr_status" = 'PENDING' THEN 'HR' WHEN "it_status" = 'PENDING' THEN 'IT' END WHERE "status" = 'PENDING';
