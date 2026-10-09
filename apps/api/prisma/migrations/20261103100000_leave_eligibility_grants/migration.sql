-- CreateEnum
CREATE TYPE "LeaveAvailability" AS ENUM ('EVERYONE', 'RULES', 'GRANT_ONLY');

-- CreateEnum
CREATE TYPE "LeaveMemberMode" AS ENUM ('INCLUDE', 'EXCLUDE');

-- CreateEnum
CREATE TYPE "LeaveGrantStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "LeaveGrantRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "leave_grant_id" UUID;

-- AlterTable
ALTER TABLE "leave_types" ADD COLUMN     "availability" "LeaveAvailability" NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN     "department_ids" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "designation_ids" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "employment_types" "EmploymentType"[] DEFAULT ARRAY[]::"EmploymentType"[],
ADD COLUMN     "genders" "Gender"[] DEFAULT ARRAY[]::"Gender"[],
ADD COLUMN     "grant_needs_document" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "location_ids" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "manager_deep" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manager_ids" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "min_service_months" INTEGER,
ADD COLUMN     "project_ids" UUID[] DEFAULT ARRAY[]::UUID[];

-- Carry the old single-gender filter over: those types become "only some people"
UPDATE "leave_types" SET "genders" = ARRAY["gender"], "availability" = 'RULES' WHERE "gender" IS NOT NULL;
ALTER TABLE "leave_types" DROP COLUMN "gender";

-- CreateTable
CREATE TABLE "leave_type_members" (
    "leave_type_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "mode" "LeaveMemberMode" NOT NULL,

    CONSTRAINT "leave_type_members_pkey" PRIMARY KEY ("leave_type_id","employee_id")
);

-- CreateTable
CREATE TABLE "leave_grants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "document_key" TEXT,
    "document_name" TEXT,
    "document_mime" TEXT,
    "document_size" INTEGER,
    "granted_by_id" UUID,
    "request_id" UUID,
    "reminded_for" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_grant_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grant_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "days" DOUBLE PRECISION,
    "valid_to" DATE,
    "note" TEXT,
    "by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_grant_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_grant_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "status" "LeaveGrantRequestStatus" NOT NULL DEFAULT 'PENDING',
    "document_key" TEXT,
    "document_name" TEXT,
    "document_mime" TEXT,
    "document_size" INTEGER,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_grant_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_type_members_employee_id_idx" ON "leave_type_members"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_grants_request_id_key" ON "leave_grants"("request_id");

-- CreateIndex
CREATE INDEX "leave_grants_company_id_employee_id_idx" ON "leave_grants"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "leave_grants_company_id_leave_type_id_idx" ON "leave_grants"("company_id", "leave_type_id");

-- CreateIndex
CREATE INDEX "leave_grant_events_grant_id_idx" ON "leave_grant_events"("grant_id");

-- CreateIndex
CREATE INDEX "leave_grant_requests_company_id_status_idx" ON "leave_grant_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "leave_grant_requests_company_id_employee_id_idx" ON "leave_grant_requests"("company_id", "employee_id");

-- AddForeignKey
ALTER TABLE "leave_type_members" ADD CONSTRAINT "leave_type_members_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_type_members" ADD CONSTRAINT "leave_type_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_grants" ADD CONSTRAINT "leave_grants_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_grants" ADD CONSTRAINT "leave_grants_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_grants" ADD CONSTRAINT "leave_grants_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "leave_grant_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_grant_events" ADD CONSTRAINT "leave_grant_events_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "leave_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_grant_requests" ADD CONSTRAINT "leave_grant_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_grant_requests" ADD CONSTRAINT "leave_grant_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_grant_id_fkey" FOREIGN KEY ("leave_grant_id") REFERENCES "leave_grants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

