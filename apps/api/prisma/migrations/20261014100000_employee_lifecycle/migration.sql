-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "exit_reason" TEXT;

-- CreateTable
CREATE TABLE "employee_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "from_label" TEXT,
    "to_label" TEXT,
    "effective_on" DATE,
    "note" TEXT,
    "actor_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_checklist_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "done_at" TIMESTAMP(3),
    "done_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_events_company_id_employee_id_created_at_idx" ON "employee_events"("company_id", "employee_id", "created_at");

-- CreateIndex
CREATE INDEX "employee_checklist_items_employee_id_kind_idx" ON "employee_checklist_items"("employee_id", "kind");

-- AddForeignKey
ALTER TABLE "employee_events" ADD CONSTRAINT "employee_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_checklist_items" ADD CONSTRAINT "employee_checklist_items_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

