-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "cover_art" TEXT,
ADD COLUMN     "cover_dim" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "cover_focus_x" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "cover_focus_y" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "cover_media_kind" TEXT,
ADD COLUMN     "cover_media_url" TEXT,
ADD COLUMN     "cover_motion" TEXT NOT NULL DEFAULT 'gentle',
ADD COLUMN     "cover_scene" TEXT;

