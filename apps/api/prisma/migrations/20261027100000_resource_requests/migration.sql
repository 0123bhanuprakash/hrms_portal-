-- Resource requests & releases (Lead → PM → Delivery Director → PMO), PMO reporting, skills, tech stack.

-- CreateEnum
CREATE TYPE "ResourceRequestKind" AS ENUM ('REQUEST', 'RELEASE');

-- CreateEnum
CREATE TYPE "ResourceRequestStatus" AS ENUM ('OPEN', 'ON_HOLD', 'AWAITING_CONSENT', 'FILLED', 'REJECTED', 'WITHDRAWN', 'RELEASED', 'REASSIGNED', 'KEPT');

-- CreateEnum
CREATE TYPE "ResourceStep" AS ENUM ('PM', 'DD', 'PMO');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "reports_to_pmo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "delivery_director_id" UUID,
ADD COLUMN     "tech_stack" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "resource_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "kind" "ResourceRequestKind" NOT NULL,
    "status" "ResourceRequestStatus" NOT NULL DEFAULT 'OPEN',
    "step" "ResourceStep" NOT NULL DEFAULT 'PM',
    "raised_by_user_id" UUID,
    "raised_by_employee_id" UUID,
    "reason" TEXT NOT NULL,
    "title" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allocation" INTEGER,
    "from_date" DATE,
    "until_date" DATE,
    "preferred_employee_id" UUID,
    "member_id" UUID,
    "release_employee_id" UUID,
    "last_date" DATE,
    "handover" TEXT,
    "hold_reason" TEXT,
    "held_at" TIMESTAMP(3),
    "held_by_user_id" UUID,
    "remind_at" DATE,
    "reminded_at" TIMESTAMP(3),
    "hold_nudged_at" TIMESTAMP(3),
    "pending_fill" JSONB,
    "filled_employee_id" UUID,
    "filled_allocation" INTEGER,
    "target_project_id" UUID,
    "outcome_note" TEXT,
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMP(3),
    "nudged_at" TIMESTAMP(3),
    "previous_request_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_request_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "project_id" UUID,
    "request_id" UUID,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "allocation" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resource_requests_company_id_status_idx" ON "resource_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "resource_requests_project_id_status_idx" ON "resource_requests"("project_id", "status");

-- CreateIndex
CREATE INDEX "resource_requests_raised_by_user_id_idx" ON "resource_requests"("raised_by_user_id");

-- CreateIndex
CREATE INDEX "resource_request_events_request_id_created_at_idx" ON "resource_request_events"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "assignment_logs_company_id_employee_id_created_at_idx" ON "assignment_logs"("company_id", "employee_id", "created_at");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_delivery_director_id_fkey" FOREIGN KEY ("delivery_director_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_requests" ADD CONSTRAINT "resource_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_request_events" ADD CONSTRAINT "resource_request_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "resource_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- "Open roles" merge into resource requests: each unfilled open role becomes a
-- request waiting for the PMO (the old rows stay as history, no longer shown).
INSERT INTO "resource_requests" ("company_id", "project_id", "kind", "status", "step", "raised_by_user_id", "reason", "title", "allocation", "from_date", "created_at", "updated_at")
SELECT r."company_id", r."project_id", 'REQUEST', 'OPEN', 'PMO', p."created_by_id", 'Moved over from the project''s open roles', r."title", r."allocation", r."from_date", r."created_at", CURRENT_TIMESTAMP
FROM "project_open_roles" r
JOIN "projects" p ON p."id" = r."project_id"
WHERE r."filled_at" IS NULL AND p."status" <> 'COMPLETED';
