-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "default_backdrop_level" TEXT NOT NULL DEFAULT 'lively',
ADD COLUMN     "default_backdrop_pack" TEXT NOT NULL DEFAULT 'signature';

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "backdrop_level" TEXT,
ADD COLUMN     "backdrop_pack" TEXT;

