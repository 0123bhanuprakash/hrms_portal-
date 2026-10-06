-- AlterEnum
ALTER TYPE "TicketQueue" ADD VALUE 'DEVOPS';

-- CreateTable
CREATE TABLE "helpdesk_teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "queue" "TicketQueue" NOT NULL,
    "head_id" UUID,
    "backup_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "helpdesk_teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "helpdesk_teams_company_id_queue_key" ON "helpdesk_teams"("company_id", "queue");
