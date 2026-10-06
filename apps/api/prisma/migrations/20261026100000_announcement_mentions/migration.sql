-- People @mentioned in an announcement (user ids): told when it is published, and if it is deleted.
ALTER TABLE "announcements" ADD COLUMN "mention_ids" UUID[] DEFAULT ARRAY[]::UUID[];
