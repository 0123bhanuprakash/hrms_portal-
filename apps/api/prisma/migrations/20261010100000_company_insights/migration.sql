-- Super Admin: tags and notes on companies; daily active users
CREATE TABLE "company_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_tags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "company_tags_company_id_label_key" ON "company_tags"("company_id", "label");
CREATE INDEX "company_tags_label_idx" ON "company_tags"("label");
ALTER TABLE "company_tags" ADD CONSTRAINT "company_tags_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "company_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "author_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "company_notes_company_id_created_at_idx" ON "company_notes"("company_id", "created_at");
ALTER TABLE "company_notes" ADD CONSTRAINT "company_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_notes" ADD CONSTRAINT "company_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "user_activity_days" (
    "user_id" UUID NOT NULL,
    "company_id" UUID,
    "day" DATE NOT NULL,
    CONSTRAINT "user_activity_days_pkey" PRIMARY KEY ("user_id", "day")
);
CREATE INDEX "user_activity_days_company_id_day_idx" ON "user_activity_days"("company_id", "day");
ALTER TABLE "user_activity_days" ADD CONSTRAINT "user_activity_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from sessions (each sign-in / refresh) and last sign-ins
INSERT INTO "user_activity_days" ("user_id", "company_id", "day")
SELECT DISTINCT t."user_id", u."company_id", (t."created_at")::date FROM "refresh_tokens" t JOIN "users" u ON u."id" = t."user_id"
ON CONFLICT DO NOTHING;
INSERT INTO "user_activity_days" ("user_id", "company_id", "day")
SELECT "id", "company_id", ("last_login_at")::date FROM "users" WHERE "last_login_at" IS NOT NULL
ON CONFLICT DO NOTHING;
