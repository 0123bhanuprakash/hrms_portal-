-- Helpdesk teams beyond IT / HR / Finance / DevOps.
-- The queue columns change from the TicketQueue enum to text IN PLACE (values kept),
-- so existing tickets, topics and team heads stay where they are.

-- AlterTable: queue enum → text (indexes on these columns are kept)
ALTER TABLE "tickets" ALTER COLUMN "queue" TYPE TEXT USING "queue"::text;
ALTER TABLE "ticket_categories" ALTER COLUMN "queue" TYPE TEXT USING "queue"::text;
ALTER TABLE "helpdesk_teams" ALTER COLUMN "queue" TYPE TEXT USING "queue"::text;

-- DropEnum
DROP TYPE "TicketQueue";

-- AlterTable: company-made teams
ALTER TABLE "helpdesk_teams" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "custom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "emoji" TEXT,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "member_ids" UUID[] DEFAULT ARRAY[]::UUID[];

-- HR may manage helpdesk teams (Company Admin already holds everything).
-- Company HR roles copied from the template get the permission once.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."key" = 'ticket.manage_teams'
WHERE r."key" = 'hr' AND r."company_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id");

-- Signed-in HR users pick the new grant up on their next request
UPDATE "roles" r SET "version" = r."version" + 1
WHERE r."key" = 'hr' AND r."company_id" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "role_permissions" rp JOIN "permissions" p ON p."id" = rp."permission_id" WHERE rp."role_id" = r."id" AND p."key" = 'ticket.manage_teams');
