-- View settings that follow the person, and company defaults for them
ALTER TABLE "user_preferences" ADD COLUMN "ui_state" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "company_settings" ADD COLUMN "ui_defaults" JSONB NOT NULL DEFAULT '{}';
