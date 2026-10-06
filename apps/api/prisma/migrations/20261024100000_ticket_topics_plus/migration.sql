-- AlterTable
ALTER TABLE "ticket_categories" ADD COLUMN     "default_priority" "TicketPriority",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "helped_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "questions" JSONB,
ADD COLUMN     "quick_answer" TEXT,
ADD COLUMN     "route_to_id" UUID;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "answers" JSONB;
