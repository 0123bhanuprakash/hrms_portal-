-- AlterEnum
ALTER TYPE "AnnouncementAudience" ADD VALUE 'TEAM';

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "ack_due_at" DATE,
ADD COLUMN     "ack_reminder_sent_at" TIMESTAMP(3),
ADD COLUMN     "allow_reactions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'update',
ADD COLUMN     "cover" TEXT,
ADD COLUMN     "cover_emoji" TEXT,
ADD COLUMN     "event_at" TIMESTAMP(3),
ADD COLUMN     "event_place" TEXT,
ADD COLUMN     "last_nudged_at" TIMESTAMP(3),
ADD COLUMN     "notified_at" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'published',
ADD COLUMN     "team_manager_id" UUID;

-- CreateTable
CREATE TABLE "announcement_reactions" (
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reactions_pkey" PRIMARY KEY ("announcement_id","user_id","emoji")
);

-- CreateTable
CREATE TABLE "announcement_rsvps" (
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "response" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcement_rsvps_pkey" PRIMARY KEY ("announcement_id","user_id")
);

-- CreateTable
CREATE TABLE "kudos_thanks" (
    "kudos_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kudos_thanks_pkey" PRIMARY KEY ("kudos_id","user_id")
);

-- AddForeignKey
ALTER TABLE "announcement_reactions" ADD CONSTRAINT "announcement_reactions_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_rsvps" ADD CONSTRAINT "announcement_rsvps_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kudos_thanks" ADD CONSTRAINT "kudos_thanks_kudos_id_fkey" FOREIGN KEY ("kudos_id") REFERENCES "kudos"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing posts were announced when published
UPDATE "announcements" SET "notified_at" = "published_at" WHERE "notified_at" IS NULL;
