-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('COMPANY', 'DEPARTMENTS', 'LOCATIONS');

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "author_id" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'COMPANY',
    "department_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "location_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "requires_ack" BOOLEAN NOT NULL DEFAULT false,
    "send_email" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "attachment_name" TEXT,
    "attachment_mime" TEXT,
    "attachment_size" INTEGER,
    "attachment_key" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("announcement_id","user_id")
);

-- CreateTable
CREATE TABLE "kudos_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kudos_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kudos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "value_id" UUID,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,

    CONSTRAINT "kudos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kudos_recipients" (
    "kudos_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,

    CONSTRAINT "kudos_recipients_pkey" PRIMARY KEY ("kudos_id","employee_id")
);

-- CreateTable
CREATE TABLE "kudos_reactions" (
    "kudos_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kudos_reactions_pkey" PRIMARY KEY ("kudos_id","user_id","emoji")
);

-- CreateIndex
CREATE INDEX "announcements_company_id_published_at_idx" ON "announcements"("company_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "kudos_values_company_id_name_key" ON "kudos_values"("company_id", "name");

-- CreateIndex
CREATE INDEX "kudos_company_id_created_at_idx" ON "kudos"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "kudos_recipients_employee_id_idx" ON "kudos_recipients"("employee_id");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kudos" ADD CONSTRAINT "kudos_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kudos" ADD CONSTRAINT "kudos_value_id_fkey" FOREIGN KEY ("value_id") REFERENCES "kudos_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kudos_recipients" ADD CONSTRAINT "kudos_recipients_kudos_id_fkey" FOREIGN KEY ("kudos_id") REFERENCES "kudos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kudos_recipients" ADD CONSTRAINT "kudos_recipients_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kudos_reactions" ADD CONSTRAINT "kudos_reactions_kudos_id_fkey" FOREIGN KEY ("kudos_id") REFERENCES "kudos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kudos_reactions" ADD CONSTRAINT "kudos_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

