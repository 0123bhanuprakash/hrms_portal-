-- AlterTable
ALTER TABLE "email_verification_tokens" ADD COLUMN     "new_email" TEXT;

-- AlterTable
ALTER TABLE "sign_in_attempts" ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "user_agent" TEXT;

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "idle_timeout_minutes" INTEGER,
ADD COLUMN     "notify_new_device" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reauth_for_risky" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_changed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "sign_in_attempts_user_id_at_idx" ON "sign_in_attempts"("user_id", "at");


-- Existing accounts: count password age from when the account was created
UPDATE "users" SET "password_changed_at" = "created_at" WHERE "password_changed_at" IS NULL;
