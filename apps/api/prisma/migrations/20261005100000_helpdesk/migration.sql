-- CreateEnum
CREATE TYPE "TicketQueue" AS ENUM ('IT', 'HR', 'FINANCE');

-- CreateEnum
CREATE TYPE "TicketMessageKind" AS ENUM ('REPLY', 'NOTE', 'EVENT');

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING';

-- CreateTable
CREATE TABLE "ticket_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "queue" "TicketQueue" NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "queue" "TicketQueue" NOT NULL,
    "category_id" UUID,
    "employee_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignee_id" UUID,
    "first_response_due_at" TIMESTAMP(3) NOT NULL,
    "resolution_due_at" TIMESTAMP(3) NOT NULL,
    "first_responded_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER,
    "rating_comment" TEXT,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_id" UUID,
    "kind" "TicketMessageKind" NOT NULL DEFAULT 'REPLY',
    "body" TEXT NOT NULL,
    "file_key" TEXT,
    "file_name" TEXT,
    "file_mime" TEXT,
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_categories_company_id_queue_name_key" ON "ticket_categories"("company_id", "queue", "name");

-- CreateIndex
CREATE INDEX "tickets_company_id_queue_status_resolution_due_at_idx" ON "tickets"("company_id", "queue", "status", "resolution_due_at");

-- CreateIndex
CREATE INDEX "tickets_company_id_employee_id_created_at_idx" ON "tickets"("company_id", "employee_id", "created_at");

-- CreateIndex
CREATE INDEX "tickets_company_id_assignee_id_status_idx" ON "tickets"("company_id", "assignee_id", "status");

-- CreateIndex
CREATE INDEX "tickets_company_id_status_resolved_at_idx" ON "tickets"("company_id", "status", "resolved_at");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_company_id_number_key" ON "tickets"("company_id", "number");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

