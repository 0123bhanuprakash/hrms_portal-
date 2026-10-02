-- AlterTable: personal display preferences (Phase 6)
ALTER TABLE "user_preferences" ADD COLUMN     "density" TEXT NOT NULL DEFAULT 'theme',
ADD COLUMN     "text_size" TEXT NOT NULL DEFAULT 'theme',
ADD COLUMN     "reduce_motion" BOOLEAN NOT NULL DEFAULT false;
