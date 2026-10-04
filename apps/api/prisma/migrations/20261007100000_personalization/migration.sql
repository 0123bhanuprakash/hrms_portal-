-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "allowed_themes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "default_menu_style" TEXT NOT NULL DEFAULT 'classic',
ADD COLUMN     "personal_menu_style" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "personal_themes" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "color_theme" TEXT,
ADD COLUMN     "menu_style" TEXT;

