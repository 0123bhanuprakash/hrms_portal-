-- AlterTable
ALTER TABLE "approval_delegations" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "company_branding" ADD COLUMN     "logo_dark_url" TEXT,
ADD COLUMN     "sign_in_background" TEXT NOT NULL DEFAULT 'pack',
ADD COLUMN     "sign_in_message" TEXT,
ADD COLUMN     "sign_in_photo_url" TEXT,
ADD COLUMN     "tagline" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "email_held" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "daily_summary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notification_topics" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "quiet_hours" JSONB;

-- CreateTable
CREATE TABLE "seasonal_themes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "preset" TEXT,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "starts_on" TEXT NOT NULL,
    "ends_on" TEXT NOT NULL,
    "every_year" BOOLEAN NOT NULL DEFAULT true,
    "colors" JSONB NOT NULL,
    "decoration" TEXT NOT NULL DEFAULT 'none',
    "greeting" TEXT,
    "on_sign_in" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasonal_themes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seasonal_themes_company_id_starts_on_idx" ON "seasonal_themes"("company_id", "starts_on");

-- AddForeignKey
ALTER TABLE "seasonal_themes" ADD CONSTRAINT "seasonal_themes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

